from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


class HistoryStatusResponse(BaseModel):
    """API response for a single detection history record.

    Contains the detection results of a motorcycle that crossed the
    detection line, including helmet status and passenger information.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str  # Unique record ID
    track_id: Optional[int] = None  # Motorcycle track ID
    helmet_status: Optional[bool] = None  # True if helmet detected
    passenger_count: Optional[int] = None  # Number of passengers
    over_capacity: Optional[bool] = None  # True if >2 passengers
    violation: Optional[bool] = None  # True if helmet missing
    timestamp: Optional[str] = None  # Detection timestamp
    frame_path: Optional[str] = None  # Path to saved frame image


class StatsBucketResponse(BaseModel):
    """Aggregated detection counts for one time bucket (hour or day)."""

    label: str  # "2026-08-23" (day) or "2026-08-23 14" (hour)
    total: int = 0
    violations: int = 0


class ViolationTypeCount(BaseModel):
    """Count of one violation category within the period."""

    type: Literal["no_helmet", "over_capacity"]
    count: int


class StatsSummaryResponse(BaseModel):
    """Period totals feeding the dashboard cards and pie chart."""

    total_detections: int
    total_violations: int  # helmet violations ("violation" flag)
    helmet_on: int
    helmet_off: int
    excess_passengers: int
    compliance_percent: float


class HelmetStatsResponse(BaseModel):
    """Aggregated statistics over an inclusive date range, bucketed for charting."""

    range_from: str  # ISO date, inclusive
    range_to: str  # ISO date, inclusive
    bucket_size: Literal["hour", "day"]
    summary: StatsSummaryResponse
    series: list[StatsBucketResponse]
    violation_types: list[ViolationTypeCount]


class SendDigestRequest(BaseModel):
    """Request schema for on-demand daily digest triggering."""

    recipient_email: Optional[str] = None


class SendDigestResponse(BaseModel):
    """Response schema for on-demand daily digest triggering."""

    success: bool
    status: str
    message: str
    recipient: Optional[str] = None
    summary: Optional[dict] = None

