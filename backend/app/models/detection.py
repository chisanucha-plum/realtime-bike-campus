from dataclasses import dataclass
from typing import Any


@dataclass
class BoundingBox:
    """Bounding box coordinates."""

    x1: int  # Top-left x
    y1: int  # Top-left y
    x2: int  # Bottom-right x
    y2: int  # Bottom-right y

    @property
    def center_x(self) -> int:
        """Horizontal center of bounding box."""
        return (self.x1 + self.x2) // 2

    @property
    def center_y(self) -> int:
        """Vertical center of bounding box."""
        return (self.y1 + self.y2) // 2


    @property
    def width(self) -> int:
        """Width of bounding box."""
        return self.x2 - self.x1

    @property
    def height(self) -> int:
        """Height of bounding box."""
        return self.y2 - self.y1


@dataclass
class DetectionRecord:
    """Structured result of a single motorcycle track detection with helmet analysis.

    Represents the outcome of detecting a motorcycle crossing the detection line
    and analyzing whether the rider was wearing a helmet.
    """

    motorcycle_track_id: int
    helmet_status: bool
    passenger_count: int
    over_capacity: bool
    violation: bool
    frame_path: str | None = None  # Frame snapshot path (optional)
    camera_id: str = "camera-1"  # Camera identifier

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "motorcycle_track_id": self.motorcycle_track_id,
            "helmet_status": self.helmet_status,
            "passenger_count": self.passenger_count,
            "over_capacity": self.over_capacity,
            "violation": self.violation,
            "frame_path": self.frame_path,
            "camera_id": self.camera_id,
        }
