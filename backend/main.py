import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.configuration import Configuration
from app.core.exceptions import ServiceError, TokenDecodeError
from app.database.database import SessionLocal, init_database
from app.routers.router import get_router
from app.services.email_service import send_daily_digest
from app.services.frame_storage import frame_storage

config = Configuration.get_config().server

logging.basicConfig(level=logging.WARNING, format="%(message)s")
logger = logging.getLogger(__name__)


async def cleanup_loop() -> None:
    """Periodically clean up old frames. Disabled when frame_retention_days <= 0."""
    if config.frame_retention_days <= 0:
        logger.info("Frame cleanup disabled; preserving all snapshots.")
        return

    while True:
        await asyncio.sleep(config.cleanup_interval_hours * 3600)
        try:
            deleted = await asyncio.to_thread(
                frame_storage.cleanup_old_frames, config.frame_retention_days
            )
            if deleted > 0:
                logger.info(f"Frame cleanup: deleted {deleted} old frames")
        except Exception:
            logger.exception("Frame cleanup failed")


async def digest_loop() -> None:
    """Check every 30 seconds if it's time to send daily digest to Security Chief."""
    last_sent: str | None = None
    while True:
        try:
            await asyncio.sleep(30)
            smtp = Configuration.get_config().smtp
            if not smtp or not smtp.digest_enabled or not smtp.security_chief_email:
                continue

            now = datetime.now()
            today = now.strftime("%Y-%m-%d")
            hm = now.strftime("%H:%M")

            if hm == smtp.digest_time and last_sent != today:
                def _send() -> None:
                    with SessionLocal() as db:
                        logger.info("Executing scheduled daily digest email to security chief")
                        send_daily_digest(db)

                await asyncio.to_thread(_send)
                last_sent = today
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Error running periodic daily digest scheduler")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize database and background schedulers on startup; cancel on shutdown."""
    cleanup_task: asyncio.Task[None] | None = None
    digest_task: asyncio.Task[None] | None = None

    try:
        init_database()
        cleanup_task = asyncio.create_task(cleanup_loop())
        digest_task = asyncio.create_task(digest_loop())
    except SQLAlchemyError as e:
        logger.warning(f"Database initialization skipped: {e}")

    yield

    for task in (cleanup_task, digest_task):
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


app = FastAPI(lifespan=lifespan)


@app.exception_handler(TokenDecodeError)
async def handle_token_error(
    request: Request, exc: TokenDecodeError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": str(exc)},
    )


@app.exception_handler(ServiceError)
async def handle_service_error(request: Request, exc: ServiceError) -> JSONResponse:
    msg = str(exc)
    status_map = {
        "Invalid credentials": status.HTTP_401_UNAUTHORIZED,
        "Invalid token": status.HTTP_401_UNAUTHORIZED,
        "User not found": status.HTTP_401_UNAUTHORIZED,
        "User account is disabled": status.HTTP_403_FORBIDDEN,
    }
    code = next(
        (code for key, code in status_map.items() if key in msg),
        status.HTTP_400_BAD_REQUEST,
    )
    return JSONResponse(status_code=code, content={"detail": msg})


@app.exception_handler(SQLAlchemyError)
async def handle_db_error(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    logger.exception("Database error occurred: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Database error occurred"},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(get_router())


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
