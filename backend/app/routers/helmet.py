import asyncio
import logging
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Annotated, Any, Iterator, Literal

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.auth import CurrentUserDep
from app.database.database import DbSession
from app.database.history_status import HistoryStatus
from app.schemas.helmet import (
    HelmetStatsResponse,
    HistoryStatusResponse,
    SendDigestRequest,
    SendDigestResponse,
    StatsBucketResponse,
    StatsSummaryResponse,
    ViolationTypeCount,
)
from app.services import email_service
from app.services.camera_hub import get_camera_hub
from app.services.frame_storage import frame_storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/helmet", tags=["Helmet Detection"])

DEFAULT_LIMIT = 50
MAX_LIMIT = 500
DEFAULT_DAYS = 7
MAX_DAYS = 92

CameraIdQuery = Annotated[str, Query(pattern=r"^camera-1$")]


def _bucket_label(timestamp: str, bucket_size: str) -> str:
    """Extract aggregation label ('YYYY-MM-DD' or 'YYYY-MM-DD HH') from stored timestamp."""
    return timestamp[:10] if bucket_size == "day" else timestamp[:13]


def _bucket_labels(start: date, end: date, bucket_size: str) -> Iterator[str]:
    """Yield every bucket label in [start, end] so charts get zero-filled gaps."""
    cur = start
    while cur <= end:
        if bucket_size == "day":
            yield cur.isoformat()
        else:
            for hour in range(24):
                yield f"{cur.isoformat()} {hour:02d}"
        cur += timedelta(days=1)


@router.get("/stream")
async def stream_video(
    request: Request,
    camera_id: CameraIdQuery = "camera-1",
) -> StreamingResponse:
    """Return MJPEG video stream with YOLO detection annotations."""
    logger.info("Video stream client connected")
    q = get_camera_hub(camera_id).subscribe_frames()

    async def generate() -> Any:
        try:
            while not await request.is_disconnected():
                try:
                    frame: bytes = await asyncio.wait_for(q.get(), timeout=1.0)
                    yield (
                        b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                        + frame
                        + b"\r\n"
                    )
                except asyncio.TimeoutError:
                    continue
        except (asyncio.CancelledError, GeneratorExit):
            logger.info("Video stream client disconnected")
        finally:
            get_camera_hub(camera_id).unsubscribe_frames(q)

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache, no-store", "X-Accel-Buffering": "no"},
    )


@router.get("/events")
async def stream_events(
    request: Request,
    camera_id: CameraIdQuery = "camera-1",
) -> StreamingResponse:
    """Return Server-Sent Events stream for line-crossing detection records."""
    logger.info("Detection events stream client connected")
    q = get_camera_hub(camera_id).subscribe_detections()

    async def generate() -> Any:
        try:
            while not await request.is_disconnected():
                try:
                    payload: str = await asyncio.wait_for(q.get(), timeout=1.0)
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        except (asyncio.CancelledError, GeneratorExit):
            logger.info("Detection events stream client disconnected")
        finally:
            get_camera_hub(camera_id).unsubscribe_detections(q)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/history", response_model=list[HistoryStatusResponse])
def get_history(
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
) -> list[HistoryStatus]:
    return (
        db.query(HistoryStatus)
        .order_by(desc(HistoryStatus.timestamp))
        .limit(limit)
        .all()
    )


def _parse_date_range(from_date: str | None, to_date: str | None) -> tuple[date, date]:
    try:
        end = date.fromisoformat(to_date) if to_date else date.today()
        start = (
            date.fromisoformat(from_date)
            if from_date
            else end - timedelta(days=DEFAULT_DAYS - 1)
        )
    except ValueError as e:
        raise HTTPException(422, f"Invalid date: {e}") from e

    if start > end:
        raise HTTPException(422, "'from' must not be after 'to'")
    if (end - start).days + 1 > MAX_DAYS:
        raise HTTPException(422, f"Date range exceeds {MAX_DAYS} days")
    return start, end


@dataclass
class _StatsTotals:
    helmet_on: int = 0
    helmet_off: int = 0
    excess: int = 0


def _fill_buckets(
    buckets: dict[str, StatsBucketResponse],
    rows: list[HistoryStatus],
    bucket_size: Literal["hour", "day"],
) -> _StatsTotals:
    totals = _StatsTotals()
    for row in rows:
        entry = buckets.get(_bucket_label(row.timestamp or "", bucket_size))
        if entry is None:
            continue
        entry.total += 1
        if row.violation:
            entry.violations += 1
        if row.helmet_status is True:
            totals.helmet_on += 1
        elif row.helmet_status is False:
            totals.helmet_off += 1
        if row.over_capacity:
            totals.excess += 1
    return totals


@router.get("/stats")
def get_stats(
    db: DbSession,
    from_date: Annotated[
        str | None, Query(alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$")
    ] = None,
    to_date: Annotated[
        str | None, Query(alias="to", pattern=r"^\d{4}-\d{2}-\d{2}$")
    ] = None,
    bucket: Annotated[Literal["hour", "day"], Query()] = "day",
) -> HelmetStatsResponse:
    start, end = _parse_date_range(from_date, to_date)
    rows = (
        db.query(HistoryStatus)
        .filter(
            HistoryStatus.timestamp >= start.isoformat(),
            HistoryStatus.timestamp < (end + timedelta(days=1)).isoformat(),
        )
        .all()
    )

    buckets = {
        label: StatsBucketResponse(label=label)
        for label in _bucket_labels(start, end, bucket)
    }
    totals = _fill_buckets(buckets, rows, bucket)
    violations = sum(entry.violations for entry in buckets.values())

    total_riders = totals.helmet_on + totals.helmet_off
    summary = StatsSummaryResponse(
        total_detections=len(rows),
        total_violations=violations,
        helmet_on=totals.helmet_on,
        helmet_off=totals.helmet_off,
        excess_passengers=totals.excess,
        compliance_percent=round(totals.helmet_on / total_riders * 100, 1)
        if total_riders
        else 0.0,
    )

    return HelmetStatsResponse(
        range_from=start.isoformat(),
        range_to=end.isoformat(),
        bucket_size=bucket,
        summary=summary,
        series=list(buckets.values()),
        violation_types=[
            ViolationTypeCount(type="no_helmet", count=totals.helmet_off),
            ViolationTypeCount(type="over_capacity", count=totals.excess),
        ],
    )


@router.get("/frame/{date}/{filename}")
def get_frame(date: str, filename: str) -> FileResponse:
    base_dir = frame_storage.base_dir.resolve()
    filepath = (frame_storage.base_dir / date / filename).resolve()

    if not filepath.is_relative_to(base_dir) or not filepath.is_file():
        raise HTTPException(status_code=404, detail="Frame not found")

    return FileResponse(filepath, media_type="image/jpeg")


@router.post("/send-digest")
async def send_digest(
    db: DbSession,
    current_user: CurrentUserDep,
    request: SendDigestRequest | None = None,
) -> SendDigestResponse:
    recipient = str(request.recipient_email) if request and request.recipient_email else None
    try:
        result = await asyncio.to_thread(
            email_service.send_daily_digest, db, recipient_email=recipient
        )
        return SendDigestResponse(
            success=True,
            status=result["status"],
            message=result["message"],
            recipient=result.get("recipient"),
            summary=result.get("summary"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        logger.exception("Unexpected error sending daily digest")
        raise HTTPException(status_code=500, detail=f"Failed to process daily digest: {e}") from e

