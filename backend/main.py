import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.configuration import Configuration
from app.core.exceptions import ServiceError
from app.database.database import init_database
from app.routers.router import get_router
from app.services.frame_storage import frame_storage

config = Configuration.get_config().server
CORS_ALLOWED_ORIGINS = config.cors_allowed_origins
FRAME_RETENTION_DAYS = config.frame_retention_days
CLEANUP_INTERVAL_HOURS = config.cleanup_interval_hours

# Logging
logging.basicConfig(level=logging.WARNING, format="%(message)s")
logger = logging.getLogger(__name__)


async def periodic_frame_cleanup() -> None:
    """Periodically clean up old frames."""
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_HOURS * 3600)
        try:
            deleted = frame_storage.cleanup_old_frames(FRAME_RETENTION_DAYS)
            if deleted > 0:
                logger.info(f"Frame cleanup: deleted {deleted} old frames")
        except Exception:
            logger.exception("Frame cleanup failed")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager.

    Handles startup and shutdown events:
    - Startup: Initialize database tables, start frame cleanup task
    - Shutdown: Cancel frame cleanup task
    """
    cleanup_task: asyncio.Task[None] | None = None

    try:
        logger.info("Initializing database")
        init_database()
        logger.info("Database initialized successfully")

        cleanup_task = asyncio.create_task(periodic_frame_cleanup())
        logger.info(
            f"Frame cleanup task started (retention: {FRAME_RETENTION_DAYS} days)"
        )

    except SQLAlchemyError as e:
        logger.warning(f"Database initialization skipped: {e}")

    yield

    if cleanup_task:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass


# FastAPI app
app = FastAPI(lifespan=lifespan)


@app.exception_handler(ServiceError)
async def service_error_handler(request: Request, exc: ServiceError) -> JSONResponse:
    """Map ServiceError to appropriate HTTP status codes."""
    msg = str(exc)
    status_map = {
        "Invalid credentials": status.HTTP_401_UNAUTHORIZED,
        "User account is disabled": status.HTTP_403_FORBIDDEN,
    }
    code = next(
        (code for key, code in status_map.items() if key in msg),
        status.HTTP_400_BAD_REQUEST,
    )
    return JSONResponse(status_code=code, content={"detail": msg})


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Handle database errors globally."""
    logger.exception("Database error occurred: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Database error occurred"},
    )



# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(get_router())


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
