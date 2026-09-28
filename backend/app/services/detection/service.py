"""Detection orchestration: motorcycle tracking loop over the helmet stage."""

import logging
from pathlib import Path

import numpy as np
import torch
from ultralytics import YOLO

from app.configuration import Configuration, DetectionConfig
from app.models.detection import DetectionRecord
from app.services.detection.annotate import MOTO_COLOR, draw_box, draw_detection_line
from app.services.detection.helmet_analyzer import HelmetAnalyzer, extract_box_coords
from app.services.detection.line_counter import LineCrossingCounter

logger = logging.getLogger(__name__)


class DetectionService:
    """Two-stage pipeline: track motorcycles across a line, then check helmets.

    Stage 1 tracks motorcycles and counts line crossings (see LineCrossingCounter).
    Each first-time crossing triggers stage 2 (see HelmetAnalyzer) which produces
    one DetectionRecord. This class only wires the models and orchestrates the
    loop — counting state, ROI geometry, verdicts, and drawing live elsewhere.
    """

    def __init__(
        self,
        bike_model: Path,
        helmet_model: Path,
        config: DetectionConfig | None = None,
    ) -> None:
        """Load both models and prepare the crossing counter and analyzer.

        Args:
            bike_model: Path to motorcycle model (.pt / .onnx / OpenVINO dir)
            helmet_model: Path to helmet model (any supported format)
            config: Detection configuration (optional, uses global config if None)

        Raises:
            FileNotFoundError: If a model file does not exist
        """
        config = config or Configuration.get_config().detection
        if not Path(bike_model).exists():
            raise FileNotFoundError(f"Motorcycle model not found: {bike_model}")
        if not Path(helmet_model).exists():
            raise FileNotFoundError(f"Helmet model not found: {helmet_model}")

        self._device: str = "cuda:0" if torch.cuda.is_available() else "cpu"
        self._moto_model: YOLO = YOLO(str(bike_model))
        self._helmet_model: YOLO = YOLO(str(helmet_model))

        # Exported formats (ONNX/OpenVINO/TensorRT...) reject torch-style
        # .to()/device= — their runtime picks the execution provider itself
        self._moto_is_pt = (
            not str(bike_model).lower().endswith((".onnx", "_openvino_model"))
        )
        self._helmet_is_pt = (
            not str(helmet_model).lower().endswith((".onnx", "_openvino_model"))
        )
        if self._moto_is_pt:
            self._moto_model.to(self._device)
        if self._helmet_is_pt:
            self._helmet_model.to(self._device)

        self._config: DetectionConfig = config
        self._counter = LineCrossingCounter(config.line_position_percent)
        self._helmet_analyzer = HelmetAnalyzer(
            self._helmet_model, config, self._device, is_pt=self._helmet_is_pt
        )

        logger.info(
            "DetectionService initialized",
            extra={
                "device": self._device,
                "roi_side_pad": config.roi_side_pad,
                "roi_top_pad": config.roi_top_pad,
                "roi_bottom_pad": config.roi_bottom_pad,
                "line_position_percent": config.line_position_percent,
            },
        )

    def detect_and_track(
        self, frame: np.ndarray
    ) -> tuple[np.ndarray, list[DetectionRecord]]:
        """Run both stages on one frame.

        Args:
            frame: Input frame (BGR format from OpenCV)

        Returns:
            (annotated_frame, detection_records) — records appear only when a
            motorcycle crosses the detection line in this frame

        Raises:
            ValueError: If frame is invalid or empty
        """
        if frame is None or frame.size == 0:
            raise ValueError("Invalid or empty frame provided")

        self._counter.ensure_line(frame.shape[1])
        records = self._process_motorcycle_tracks(frame)
        line_x = self._counter.line_x
        if line_x is not None:
            draw_detection_line(
                frame, line_x, self._config.line_overlay_alpha
            )
        return frame, records

    def _process_motorcycle_tracks(self, frame: np.ndarray) -> list[DetectionRecord]:
        """Track motorcycles; analyze helmets for each first-time crossing."""
        records: list[DetectionRecord] = []

        try:
            with torch.inference_mode():
                track_kwargs: dict[str, object] = {
                    "conf": self._config.bike_confidence,
                    "persist": True,
                    "tracker": self._config.tracker,
                    "classes": [self._config.bike_id],
                    "imgsz": getattr(self._config, "bike_imgsz", 640),
                    "verbose": False,
                }
                if self._moto_is_pt:
                    track_kwargs["device"] = self._device
                results = self._moto_model.track(frame, **track_kwargs)  # type: ignore[arg-type]
                result = results[0]
        except Exception as e:
            logger.error(f"Motorcycle tracking failed: {e}")
            return records

        if result.boxes is None or len(result.boxes) == 0:
            return records

        boxes_list = list(result.boxes)  # type: ignore[arg-type]
        for box in boxes_list:
            if box.id is None:
                continue

            track_id = int(box.id.item())
            moto_box = extract_box_coords(box)

            # Analyze on clean crop before drawing motorcycle box onto frame
            if self._counter.observe(track_id, moto_box.center_x):
                records.append(self._helmet_analyzer.analyze(frame, moto_box, track_id))

            draw_box(frame, moto_box, MOTO_COLOR, f"ID:{track_id}")

        return records

    def reset_tracks(self) -> None:
        """Forget crossing state (new video / stream reconnect)."""
        self._counter.reset()
