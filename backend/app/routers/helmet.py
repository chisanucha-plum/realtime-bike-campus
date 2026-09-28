import asyncio
import logging
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Iterator, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.database.history_status import HistoryStatus
from app.schemas.helmet import (
    HelmetStatsResponse,
    HistoryStatusResponse,
    StatsBucketResponse,
    StatsSummaryResponse,
    ViolationTypeCount,
)
from app.services.camera_hub import get_camera_hub
from app.services.frame_storage import frame_storage

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Helmet Detection"])

# Query parameter limits for history endpoint
DEFAULT_HISTORY_LIMIT = 50
MAX_HISTORY_LIMIT = 500

# Date-range limits for the stats endpoint
DEFAULT_STATS_RANGE_DAYS = 7
MAX_STATS_RANGE_DAYS = 92


def _bucket_label(timestamp: str, bucket_size: str) -> str:
    """Extract the aggregation label ("YYYY-MM-DD" or "YYYY-MM-DD HH") from a stored timestamp."""
    return timestamp[:10] if bucket_size == "day" else timestamp[:13]


def _iter_bucket_labels(
    range_from: date, range_to: date, bucket_size: str
) -> Iterator[str]:
    """Yield every bucket label in [range_from, range_to] so charts get zero-filled gaps."""
    current = range_from
    while current <= range_to:
        if bucket_size == "day":
            yield current.isoformat()
        else:
            for hour in range(24):
                yield f"{current.isoformat()} {hour:02d}"
        current += timedelta(days=1)


@router.get("/stream", status_code=status.HTTP_200_OK)
async def helmet_video_stream(
    camera_id: str = Query(default="camera-1", pattern=r"^camera-1$"),
) -> StreamingResponse:
    """Return MJPEG video stream with YOLO detection annotations."""
    logger.info("Video stream client connected")
    q = get_camera_hub(camera_id).subscribe_frames()

    async def generate() -> Any:
        try:
            while True:
                frame_bytes: bytes = await q.get()
                yield (
                    b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                    + frame_bytes
                    + b"\r\n"
                )
        except asyncio.CancelledError:
            logger.info("Video stream client disconnected")
        finally:
            get_camera_hub(camera_id).unsubscribe_frames(q)

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get("/events", status_code=status.HTTP_200_OK)
async def helmet_detection_events(
    camera_id: str = Query(default="camera-1", pattern=r"^camera-1$"),
) -> StreamingResponse:
    """Return Server-Sent Events stream for detection records.

    Emits detection JSON payload whenever motorcycle crosses detection line.

    Example payload:
        {"motorcycle_track_id": 1, "helmet_status": true, "violation": false, ...}
    """
    logger.info("Detection events stream client connected")
    queue = get_camera_hub(camera_id).subscribe_detections()

    async def generate() -> Any:
        pending: dict[asyncio.Task[str], asyncio.Queue[str]] = {
            asyncio.create_task(queue.get()): queue
        }
        try:
            while True:
                done, _ = await asyncio.wait(
                    pending,
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for task in done:
                    result_queue = pending.pop(task)
                    yield f"data: {task.result()}\n\n"
                    pending[asyncio.create_task(result_queue.get())] = result_queue
        except asyncio.CancelledError:
            logger.info("Detection events stream client disconnected")
        finally:
            # Cancel all pending tasks and wait for them to finish cleanly
            for task in list(pending):
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
            get_camera_hub(camera_id).unsubscribe_detections(queue)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/history", response_model=list[HistoryStatusResponse])
async def get_history_records(
    limit: int = Query(default=DEFAULT_HISTORY_LIMIT, ge=1, le=MAX_HISTORY_LIMIT),
    db: Session = Depends(get_db),
) -> list[HistoryStatusResponse]:
    """Get recent detection history records from database.

    Args:
        limit: Number of records to return (1-500, default 50)
        db: Database session

    Returns:
        List of detection history records sorted by timestamp descending
    """
    logger.info(f"Fetching {limit} detection history records")
    return (
        db.query(HistoryStatus)
        .order_by(desc(HistoryStatus.timestamp))
        .limit(limit)
        .all()
    )


def _parse_date_range(from_date: str | None, to_date: str | None) -> tuple[date, date]:
    """Resolve the inclusive [from, to] date window, applying defaults and validation.

    Args:
        from_date: Range start ISO date (default: DEFAULT_STATS_RANGE_DAYS back from to_date)
        to_date: Range end ISO date (default: today)

    Returns:
        Validated (range_from, range_to) tuple

    Raises:
        HTTPException: 422 on malformed, inverted or oversized ranges
    """
    try:
        range_to = date.fromisoformat(to_date) if to_date else date.today()
        range_from = (
            date.fromisoformat(from_date)
            if from_date
            else range_to - timedelta(days=DEFAULT_STATS_RANGE_DAYS - 1)
        )
    except ValueError as e:
        raise HTTPException(422, f"Invalid date: {e}") from e

    if range_from > range_to:
        raise HTTPException(422, "'from' must not be after 'to'")
    if (range_to - range_from).days + 1 > MAX_STATS_RANGE_DAYS:
        raise HTTPException(
            422,
            f"Date range exceeds {MAX_STATS_RANGE_DAYS} days",
        )
    return range_from, range_to


def _load_rows_in_range(
    db: Session, range_from: date, range_to: date
) -> list[HistoryStatus]:
    """Load history rows whose stored timestamp falls within [range_from, range_to].

    Timestamps are stored as "YYYY-MM-DD HH:MM:SS" strings, so plain string
    comparison against ISO dates filters the range correctly.
    """
    return (
        db.query(HistoryStatus)
        .filter(
            HistoryStatus.timestamp >= range_from.isoformat(),
            HistoryStatus.timestamp < (range_to + timedelta(days=1)).isoformat(),
        )
        .all()
    )


@dataclass
class _StatsTotals:
    """Period-wide counters folded out of history rows."""

    helmet_on: int = 0
    helmet_off: int = 0
    excess: int = 0


def _accumulate_buckets(
    buckets: dict[str, StatsBucketResponse],
    rows: list[HistoryStatus],
    bucket_size: Literal["hour", "day"],
) -> _StatsTotals:
    """Fold rows into their buckets and return the period-wide totals."""
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


@router.get("/stats", response_model=HelmetStatsResponse)
async def get_helmet_stats(
    from_date: str | None = Query(
        default=None, alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"
    ),
    to_date: str | None = Query(
        default=None, alias="to", pattern=r"^\d{4}-\d{2}-\d{2}$"
    ),
    bucket: Literal["hour", "day"] = Query(default="day"),
    db: Session = Depends(get_db),
) -> HelmetStatsResponse:
    """Aggregate detection statistics over an inclusive date range.

    Args:
        from_date: Range start ISO date (default: 7 days back from to_date)
        to_date: Range end ISO date (default: today)
        bucket: Time-series granularity

    Returns:
        Summary totals, zero-filled series and violation breakdown
    """
    range_from, range_to = _parse_date_range(from_date, to_date)
    rows = _load_rows_in_range(db, range_from, range_to)

    buckets = {
        label: StatsBucketResponse(label=label)
        for label in _iter_bucket_labels(range_from, range_to, bucket)
    }
    totals = _accumulate_buckets(buckets, rows, bucket)
    violations = sum(entry.violations for entry in buckets.values())

    denominator = totals.helmet_on + totals.helmet_off
    summary = StatsSummaryResponse(
        total_detections=len(rows),
        total_violations=violations,
        helmet_on=totals.helmet_on,
        helmet_off=totals.helmet_off,
        excess_passengers=totals.excess,
        compliance_percent=round(totals.helmet_on / denominator * 100, 1)
        if denominator
        else 0.0,
    )

    logger.info(f"Stats {range_from}..{range_to} ({bucket}): {len(rows)} records")
    return HelmetStatsResponse(
        range_from=range_from.isoformat(),
        range_to=range_to.isoformat(),
        bucket_size=bucket,
        summary=summary,
        series=list(buckets.values()),
        violation_types=[
            ViolationTypeCount(type="no_helmet", count=totals.helmet_off),
            ViolationTypeCount(type="over_capacity", count=totals.excess),
        ],
    )


@router.get("/frame/{date}/{filename}")
async def get_frame(date: str, filename: str) -> FileResponse:
    """Get saved frame image by date and filename.

    Args:
        date: Date folder (YYYY-MM-DD)
        filename: Filename in format track_{id}_{status}_{timestamp}.jpg

    Returns:
        JPEG image file
    """
    base_dir = frame_storage.base_dir.resolve()
    filepath = (frame_storage.base_dir / date / filename).resolve()

    if not filepath.is_relative_to(base_dir) or not filepath.is_file():
        raise HTTPException(status_code=404, detail="Frame not found")

    logger.debug(f"Serving frame: {filepath}")
    return FileResponse(filepath, media_type="image/jpeg")
