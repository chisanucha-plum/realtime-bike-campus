"""Detection orchestration: motorcycle tracking loop over the helmet stage."""

import logging
from pathlib import Path
from typing import Any

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
        self._pending_evaluations: dict[int, dict[str, Any]] = {}

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
        """Track motorcycles; evaluate helmets across a tight window upon line crossing."""
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
            self._finalize_stale_evaluations(active_track_ids=set(), records=records)
            return records

        boxes_list = list(result.boxes)  # type: ignore[arg-type]
        active_track_ids: set[int] = set()
        eval_window = getattr(self._config, "eval_window_frames", 3)
        early_exit_conf = getattr(self._config, "early_exit_conf", 0.70)

        for box in boxes_list:
            if box.id is None:
                continue

            track_id = int(box.id.item())
            active_track_ids.add(track_id)
            moto_box = extract_box_coords(box)

            # Start evaluation window when motorcycle crosses the detection line
            if self._counter.observe(track_id, moto_box.center_x):
                self._pending_evaluations[track_id] = {
                    "remaining": eval_window,
                    "best_record": None,
                }

            # If track is in evaluation window, run lightweight helmet analysis
            if track_id in self._pending_evaluations:
                pending = self._pending_evaluations[track_id]
                pending["remaining"] -= 1

                record = self._helmet_analyzer.analyze(frame, moto_box, track_id)
                self._update_best_candidate(pending, record)

                # Early exit on high-confidence rider detection or window exhaustion
                if (
                    record.passenger_count > 0 and record.confidence >= early_exit_conf
                ) or pending["remaining"] <= 0:
                    best = pending["best_record"]
                    if best is not None:
                        records.append(best)
                    del self._pending_evaluations[track_id]

            draw_box(frame, moto_box, MOTO_COLOR, f"ID:{track_id}")

        self._finalize_stale_evaluations(
            active_track_ids=active_track_ids, records=records
        )
        return records

    @staticmethod
    def _update_best_candidate(
        pending: dict[str, Any], candidate: DetectionRecord
    ) -> None:
        """Keep the best detection record for the track during its evaluation window."""
        current = pending.get("best_record")
        if current is None or (candidate.passenger_count, candidate.confidence) > (
            current.passenger_count,
            current.confidence,
        ):
            pending["best_record"] = candidate

    def _finalize_stale_evaluations(
        self, active_track_ids: set[int], records: list[DetectionRecord]
    ) -> None:
        """Finalize pending tracks that disappeared before their window expired."""
        stale_ids = [
            tid for tid in self._pending_evaluations if tid not in active_track_ids
        ]
        for tid in stale_ids:
            best = self._pending_evaluations[tid].get("best_record")
            if best is not None:
                records.append(best)
            del self._pending_evaluations[tid]

    def reset_tracks(self) -> None:
        """Forget crossing state (new video / stream reconnect)."""
        self._counter.reset()
        self._pending_evaluations.clear()
