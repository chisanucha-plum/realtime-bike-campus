"""Unit tests for detection models."""

from app.models.detection import BoundingBox, DetectionRecord


class TestBoundingBox:
    """Test BoundingBox model."""

    def test_bounding_box_creation(self):
        """Test creating a bounding box with coordinates."""
        box = BoundingBox(x1=10, y1=20, x2=100, y2=150)

        assert box.x1 == 10
        assert box.y1 == 20
        assert box.x2 == 100
        assert box.y2 == 150

    def test_bounding_box_center_x(self):
        """Test center_x property calculates horizontal center correctly."""
        box = BoundingBox(x1=10, y1=20, x2=100, y2=150)

        assert box.center_x == 55  # (10 + 100) / 2 = 55

    def test_bounding_box_center_y(self):
        """Test center_y property calculates vertical center correctly."""
        box = BoundingBox(x1=10, y1=20, x2=100, y2=150)

        assert box.center_y == 85  # (20 + 150) / 2 = 85

    def test_bounding_box_width(self):
        """Test width property calculates correct width."""
        box = BoundingBox(x1=10, y1=20, x2=100, y2=150)

        assert box.width == 90  # 100 - 10 = 90

    def test_bounding_box_height(self):
        """Test height property calculates correct height."""
        box = BoundingBox(x1=10, y1=20, x2=100, y2=150)

        assert box.height == 130  # 150 - 20 = 130

    def test_bounding_box_center_with_odd_coordinates(self):
        """Test center calculation with odd numbers."""
        box = BoundingBox(x1=5, y1=15, x2=20, y2=35)

        assert box.center_x == 12  # (5 + 20) / 2 = 12.5 → 12 (int)
        assert box.center_y == 25  # (15 + 35) / 2 = 25


class TestDetectionRecord:
    """Test DetectionRecord model."""

    def test_detection_record_creation_with_helmet(self):
        """Test creating a detection record for motorcycle with helmet."""
        record = DetectionRecord(
            motorcycle_track_id=1,
            helmet_status=True,
            passenger_count=1,
            over_capacity=False,
            violation=False,
        )

        assert record.motorcycle_track_id == 1
        assert record.helmet_status is True
        assert record.passenger_count == 1
        assert record.over_capacity is False
        assert record.violation is False

    def test_detection_record_creation_without_helmet(self):
        """Test creating a detection record for motorcycle without helmet."""
        record = DetectionRecord(
            motorcycle_track_id=2,
            helmet_status=False,
            passenger_count=1,
            over_capacity=False,
            violation=True,
        )

        assert record.motorcycle_track_id == 2
        assert record.helmet_status is False
        assert record.passenger_count == 1
        assert record.over_capacity is False
        assert record.violation is True

    def test_detection_record_over_capacity(self):
        """Test detection record with passengers exceeding capacity."""
        record = DetectionRecord(
            motorcycle_track_id=3,
            helmet_status=True,
            passenger_count=3,
            over_capacity=True,
            violation=False,
        )

        assert record.motorcycle_track_id == 3
        assert record.passenger_count == 3
        assert record.over_capacity is True
        assert record.violation is False

    def test_detection_record_to_dict(self):
        """Test converting DetectionRecord to dictionary."""
        record = DetectionRecord(
            motorcycle_track_id=1,
            helmet_status=True,
            passenger_count=2,
            over_capacity=True,
            violation=False,
        )

        result_dict = record.to_dict()

        assert result_dict["id"] is None
        assert result_dict["motorcycle_track_id"] == 1
        assert result_dict["helmet_status"] is True
        assert result_dict["passenger_count"] == 2
        assert result_dict["over_capacity"] is True
        assert result_dict["violation"] is False
        assert result_dict["timestamp"] is None
        assert result_dict["frame_path"] is None


def test_handle_token_error_returns_401():
    import asyncio
    from unittest.mock import Mock
    from app.core.exceptions import TokenDecodeError
    from main import handle_token_error

    resp = asyncio.run(
        handle_token_error(Mock(), TokenDecodeError("Token has expired."))
    )
    assert resp.status_code == 401
    assert b"Token has expired." in resp.body
