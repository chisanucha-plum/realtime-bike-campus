from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr


class HistoryStatusResponse(BaseModel):
    """API response for a single detection history record."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    track_id: int | None = None
    helmet_status: bool | None = None
    passenger_count: int | None = None
    over_capacity: bool | None = None
    violation: bool | None = None
    timestamp: str | None = None
    frame_path: str | None = None
    confidence: float | None = None


class StatsBucketResponse(BaseModel):
    """Aggregated detection counts for one time bucket (hour or day)."""

    label: str
    total: int = 0
    violations: int = 0


class ViolationTypeCount(BaseModel):
    """Count of one violation category within the period."""

    type: Literal["no_helmet", "over_capacity"]
    count: int


class StatsSummaryResponse(BaseModel):
    """Period totals feeding the dashboard cards and pie chart."""

    total_detections: int
    total_violations: int
    helmet_on: int
    helmet_off: int
    excess_passengers: int
    compliance_percent: float


class HelmetStatsResponse(BaseModel):
    """Aggregated statistics over an inclusive date range, bucketed for charting."""

    range_from: str
    range_to: str
    bucket_size: Literal["hour", "day"]
    summary: StatsSummaryResponse
    series: list[StatsBucketResponse]
    violation_types: list[ViolationTypeCount]


class SendDigestRequest(BaseModel):
    """Request schema for on-demand daily digest triggering."""

    recipient_email: EmailStr | None = None


class SendDigestResponse(BaseModel):
    """Response schema for on-demand daily digest triggering."""

    success: bool
    status: str
    message: str
    recipient: str | None = None
    summary: dict[str, Any] | None = None

