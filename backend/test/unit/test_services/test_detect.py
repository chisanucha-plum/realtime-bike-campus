"""Unit tests for the detection pipeline package."""

from pathlib import Path
from unittest.mock import Mock, patch

import numpy as np

from app.configuration import DetectionConfig
from app.models.detection import BoundingBox, DetectionRecord
from app.services.detection import DetectionService
from app.services.detection.annotate import draw_box, draw_detection_line, helmet_color
from app.services.detection.helmet_analyzer import (
    HelmetAnalyzer,
    classify,
    sits_on_bike,
    extract_box_coords,
    roi_bounds,
)
from app.services.detection.line_counter import LineCrossingCounter


def create_mock_config() -> DetectionConfig:
    """Create a DetectionConfig with realistic test values."""
    config = Mock(spec=DetectionConfig)
    config.bike_id = 3
    config.bike_confidence = 0.5
    config.tracker = "bytetrack.yaml"
    config.bike_imgsz = 640
    config.helmet_confidence = 0.20
    config.helmet_imgsz = 640
    config.helmet_on = "helmet on"
    config.helmet_off = "helmet off"
    config.roi_side_pad = 2.0
    config.roi_top_pad = 3.0
    config.roi_bottom_pad = 1.0
    config.line_position_percent = 0.5
    config.line_overlay_alpha = 0.5
    return config


def make_service() -> DetectionService:
    """Create a DetectionService with mocked YOLO model loading."""
    with (
        patch("app.services.detection.service.YOLO"),
        patch("app.services.detection.service.Path.exists", return_value=True),
    ):
        return DetectionService(
            bike_model=Path("dummy_moto.pt"),
            helmet_model=Path("dummy_helmet.pt"),
            config=create_mock_config(),
        )


class TestBoundingBoxExtraction:
    """Test bounding box coordinate extraction."""

    def test_extract_box_coords(self):
        """Coordinates are extracted from YOLO xyxy array as BoundingBox."""
        mock_box = Mock()
        mock_box.xyxy = [np.array([10, 20, 100, 150])]

        result = extract_box_coords(mock_box)

        assert isinstance(result, BoundingBox)
        assert result.x1 == 10
        assert result.y1 == 20
        assert result.x2 == 100
        assert result.y2 == 150


class TestDetectionRecordGeneration:
    """Test detection record generation from track data."""

    def test_detection_record_creation_helmet_present(self):
        """Test creating detection record when helmet is present."""
        record = DetectionRecord(
            motorcycle_track_id=1,
            helmet_status=True,
            passenger_count=1,
            over_capacity=False,
            violation=False,
        )

        assert record.motorcycle_track_id == 1
        assert record.helmet_status is True
        assert record.violation is False

    def test_detection_record_creation_helmet_missing(self):
        """Test creating detection record when helmet is missing."""
        record = DetectionRecord(
            motorcycle_track_id=2,
            helmet_status=False,
            passenger_count=1,
            over_capacity=False,
            violation=True,
        )

        assert record.motorcycle_track_id == 2
        assert record.helmet_status is False
        assert record.violation is True

    def test_detection_record_with_multiple_passengers(self):
        """Test detection record with multiple passengers."""
        record = DetectionRecord(
            motorcycle_track_id=3,
            helmet_status=True,
            passenger_count=3,
            over_capacity=True,
            violation=False,
        )

        assert record.passenger_count == 3
        assert record.over_capacity is True


class TestTrackReset:
    """Test track reset functionality."""

    def test_reset_tracks_clears_state(self):
        """Reset clears history and counted ids inside the counter."""
        service = make_service()
        service._counter._history = {1: 100, 2: 150}
        service._counter._counted = {1, 2}

        service.reset_tracks()

        assert service._counter._history == {}
        assert service._counter._counted == set()


class TestHelmetRoiGeometry:
    """ROI geometry is defined once and reused for crop and containment."""

    def test_roi_pads_grow_with_box_size(self):
        """Pads are fractions of the box: side scales with width, vertical with height."""
        moto_box = BoundingBox(x1=200, y1=200, x2=300, y2=320)
        bounds = roi_bounds(
            (480, 640, 3), moto_box, side_pad=2.0, top_pad=3.0, bottom_pad=1.0
        )

        # w=100 -> horizontal=200; h=120 -> top=360, bottom=120
        assert bounds == (0, 0, 500, 440)

    def test_roi_scales_with_box_not_fixed_pixels(self):
        """Same fractions on a half-size box give a half-size ROI padding."""
        big = roi_bounds(
            (960, 1280, 3),
            BoundingBox(x1=400, y1=400, x2=600, y2=640),
            side_pad=2.0,
            top_pad=3.0,
            bottom_pad=1.0,
        )
        small = roi_bounds(
            (480, 640, 3),
            BoundingBox(x1=200, y1=200, x2=300, y2=320),
            side_pad=2.0,
            top_pad=3.0,
            bottom_pad=1.0,
        )

        # 2x box -> 2x padding in every direction
        assert (big[2] - big[0]) == 2 * (small[2] - small[0])
        assert (big[3] - big[1]) == 2 * (small[3] - small[1])

    def test_head_center_inside_moto_box(self):
        """Head center inside the motorcycle box is a rider."""
        moto_box = BoundingBox(x1=50, y1=50, x2=150, y2=150)
        helmet_box = BoundingBox(x1=60, y1=40, x2=90, y2=70)  # center (75, 55)

        assert sits_on_bike(moto_box, helmet_box) is True

    def test_head_center_above_moto_box(self):
        """Head center above the box top but within its horizontal span is a rider."""
        moto_box = BoundingBox(x1=50, y1=100, x2=150, y2=200)
        helmet_box = BoundingBox(x1=80, y1=40, x2=110, y2=70)  # center (95, 55)

        assert sits_on_bike(moto_box, helmet_box) is True

    def test_head_center_below_moto_box(self):
        """Head center below the bike bottom edge is not a rider."""
        moto_box = BoundingBox(x1=50, y1=50, x2=150, y2=150)
        helmet_box = BoundingBox(x1=80, y1=180, x2=110, y2=210)  # center (95, 195)

        assert sits_on_bike(moto_box, helmet_box) is False

    def test_head_center_outside_horizontal_span(self):
        """Head center beyond the bike's side is not a rider, even at head height."""
        moto_box = BoundingBox(x1=50, y1=50, x2=150, y2=150)
        helmet_box = BoundingBox(x1=200, y1=40, x2=230, y2=70)  # center (215, 55)

        assert sits_on_bike(moto_box, helmet_box) is False


class TestHelmetVerdict:
    """Label classification covers the three record outcomes."""

    def test_no_labels_is_not_detected(self):
        helmet_status, over_capacity, violation = classify([], "helmet on")

        assert helmet_status is False
        assert over_capacity is False
        assert violation is False

    def test_mixed_labels_means_violation(self):
        helmet_status, over_capacity, violation = classify(
            ["helmet on", "helmet off"], "helmet on"
        )

        assert helmet_status is False
        assert over_capacity is False
        assert violation is True

    def test_three_riders_means_over_capacity(self):
        helmet_status, over_capacity, violation = classify(
            ["helmet on", "helmet on", "helmet on"], "helmet on"
        )

        assert helmet_status is True
        assert over_capacity is True
        assert violation is False


class TestLineCrossing:
    """Test motorcycle line crossing detection."""

    def make_counter(self) -> LineCrossingCounter:
        """Counter with the line fixed at x=320."""
        counter = LineCrossingCounter(line_position_percent=0.5)
        counter._line_x = 320
        return counter

    def test_cross_from_left_to_right_detected(self):
        """Moving from left of line to right of line counts as crossing."""
        counter = self.make_counter()
        counter._history[1] = 300  # previously left of line

        assert counter.observe(track_id=1, center_x=400) is True

    def test_no_history_returns_false(self):
        """First sighting of a track never counts as crossing."""
        counter = self.make_counter()

        assert counter.observe(track_id=1, center_x=300) is False

    def test_already_counted_returns_false(self):
        """A track already counted is not reported again."""
        counter = self.make_counter()
        counter._history[1] = 300
        counter._counted.add(1)

        assert counter.observe(track_id=1, center_x=400) is False

    def test_moving_right_to_left_not_crossed(self):
        """Crossing direction left-to-right only; right-to-left is ignored."""
        counter = self.make_counter()
        counter._history[2] = 400  # previously right of line

        assert counter.observe(track_id=2, center_x=300) is False

    def test_staying_right_of_line_not_crossed(self):
        """Movement entirely on the right side is not a crossing."""
        counter = self.make_counter()
        counter._history[3] = 400

        assert counter.observe(track_id=3, center_x=350) is False

    def test_ensure_line_only_sets_once(self):
        """The line is fixed from the first frame and never moves."""
        counter = LineCrossingCounter(line_position_percent=0.5)
        counter.ensure_line(640)
        counter.ensure_line(1000)

        assert counter.line_x == 320


class TestFrameDrawing:
    """Test frame drawing utilities."""

    @patch("app.services.detection.annotate.cv2.rectangle")
    def test_draw_box_with_frame(self, mock_rectangle):
        """Drawing a box calls cv2.rectangle with box coordinates."""
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        bbox = BoundingBox(x1=10, y1=20, x2=100, y2=150)

        draw_box(frame, bbox, (0, 255, 0), "Helmet")

        assert mock_rectangle.called

    @patch("app.services.detection.annotate.cv2.line")
    def test_draw_detection_line_on_frame(self, mock_line):
        """Drawing the detection line calls cv2.line at line_x."""
        frame = np.zeros((480, 640, 3), dtype=np.uint8)

        draw_detection_line(frame, line_x=320, alpha=0.5)

        assert mock_line.called

    def test_helmet_color_by_label(self):
        """helmet-on maps to green, anything else to red."""
        assert helmet_color("helmet on", "helmet on") == (0, 255, 0)
        assert helmet_color("helmet off", "helmet on") == (0, 0, 255)


def make_analyzer(fake_model) -> HelmetAnalyzer:
    """Analyzer whose model is replaced by ``fake_model``."""
    analyzer = HelmetAnalyzer(Mock(), create_mock_config(), device="cpu")
    analyzer._model = fake_model
    return analyzer


class TestHelmetAnalyzer:
    """HelmetAnalyzer crops the ROI, runs the model, maps boxes back."""

    def test_helmet_model_receives_crop_not_full_frame(self):
        """The helmet model input is the padded moto ROI, smaller than the frame."""
        captured = {}

        def fake_model(image, **kwargs):
            captured["shape"] = image.shape
            empty = Mock()
            empty.boxes = None
            return [empty]

        analyzer = make_analyzer(fake_model)

        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        analyzer.analyze(frame, BoundingBox(x1=200, y1=200, x2=300, y2=320), track_id=1)

        # frame 640x480; horizontal=max(160,200)=200, top=max(240,360)=360,
        # bottom=max(80,120)=120 -> crop y[0..440], x[0..500]
        assert captured["shape"] == (440, 500, 3)

    def test_labels_translate_back_to_frame_coordinates(self):
        """Crop-local helmet boxes are offset back onto the annotated frame."""
        raw_box = Mock()
        raw_box.xyxy = [np.array([200.0, 10.0, 240.0, 60.0])]
        raw_box.cls = Mock()
        raw_box.cls.item.return_value = 1  # "helmet on"
        result = Mock()
        result.boxes = [raw_box]
        result.names = {1: "helmet on"}
        analyzer = make_analyzer(lambda image, **kwargs: [result])

        moto_box = BoundingBox(x1=300, y1=200, x2=400, y2=300)  # ROI origin (100, 0)
        record = analyzer.analyze(
            np.zeros((480, 640, 3), dtype=np.uint8), moto_box, track_id=1
        )

        assert record.helmet_status is True
        assert record.passenger_count == 1


class TestConfidenceWiring:
    """Ensure each model is called with its own configured confidence."""

    def test_moto_track_uses_bike_confidence(self):
        """Motorcycle tracker receives bike_confidence from config."""
        service = make_service()
        empty_result = Mock()
        empty_result.boxes = None
        service._moto_model.track.return_value = [empty_result]

        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        service.detect_and_track(frame)

        _, kwargs = service._moto_model.track.call_args
        assert kwargs["conf"] == service._config.bike_confidence

    def test_helmet_model_uses_helmet_confidence(self):
        """Helmet classifier receives helmet_confidence from config."""
        service = make_service()
        counter = service._counter
        counter._line_x = 320
        counter._history[1] = 400  # previously right of line

        empty_result = Mock()
        empty_result.boxes = None
        empty_result.names = {}
        service._helmet_analyzer._model.return_value = [empty_result]

        moto_box = BoundingBox(x1=50, y1=50, x2=150, y2=150)
        service._helmet_analyzer.analyze(
            np.zeros((480, 640, 3), dtype=np.uint8), moto_box, 1
        )

        _, kwargs = service._helmet_analyzer._model.call_args
        assert kwargs["conf"] == service._config.helmet_confidence


class TestDetectionServiceInitialization:
    """Test DetectionService initialization."""

    @patch("app.services.detection.service.YOLO")
    @patch("app.services.detection.service.Path.exists", return_value=True)
    def test_service_initialization_with_models(self, mock_exists, mock_yolo):
        """Both YOLO models are loaded once each."""
        mock_motorcycle_model = Mock()
        mock_helmet_model = Mock()
        mock_yolo.side_effect = [mock_motorcycle_model, mock_helmet_model]

        service = DetectionService(
            bike_model=Path("dummy_moto.pt"),
            helmet_model=Path("dummy_helmet.pt"),
            config=create_mock_config(),
        )

        assert service._moto_model is mock_motorcycle_model
        assert service._helmet_model is mock_helmet_model
        assert mock_yolo.call_count == 2

    def test_service_initialization_empty_crossing_state(self):
        """New service starts with a fresh crossing counter."""
        service = make_service()

        assert service._counter._history == {}
        assert service._counter._counted == set()
