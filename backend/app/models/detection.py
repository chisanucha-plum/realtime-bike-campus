from dataclasses import dataclass, field
from typing import Any


@dataclass
class BoundingBox:
    """Bounding box coordinates."""

    x1: int
    y1: int
    x2: int
    y2: int

    @property
    def center_x(self) -> int:
        return (self.x1 + self.x2) // 2

    @property
    def center_y(self) -> int:
        return (self.y1 + self.y2) // 2

    @property
    def width(self) -> int:
        return self.x2 - self.x1

    @property
    def height(self) -> int:
        return self.y2 - self.y1


@dataclass
class DetectionRecord:
    """Outcome of a motorcycle crossing the detection line."""

    motorcycle_track_id: int
    helmet_status: bool
    passenger_count: int
    over_capacity: bool
    violation: bool
    frame_path: str | None = None
    camera_id: str = "camera-1"
    confidence: float = 0.0
    id: str | None = None
    timestamp: str | None = None
    riders: list[tuple[float, str, float]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "motorcycle_track_id": self.motorcycle_track_id,
            "helmet_status": self.helmet_status,
            "passenger_count": self.passenger_count,
            "over_capacity": self.over_capacity,
            "violation": self.violation,
            "timestamp": self.timestamp,
            "frame_path": self.frame_path,
            "camera_id": self.camera_id,
            "confidence": self.confidence,
        }
