"""Detection orchestration: motorcycle tracking loop over the helmet stage."""

from dataclasses import replace
import logging
from pathlib import Path
from typing import Any

import numpy as np
import torch
from ultralytics import YOLO

from app.configuration import Configuration, DetectionConfig
from app.models.detection import DetectionRecord
from app.services.detection.annotate import MOTO_COLOR, draw_box, draw_detection_line
from app.services.detection.helmet_analyzer import (
    HelmetAnalyzer,
    classify,
    extract_box_coords,
)
from app.services.detection.line_counter import LineCrossingCounter

logger = logging.getLogger(__name__)

# Relative horizontal separation (fraction of bike width) separating distinct riders
SLOT_MERGE_RX = 0.14


class DetectionService:
    """Two-stage pipeline: track motorcycles across a line, then check helmets."""

    def __init__(
        self,
        bike_model: Path,
        helmet_model: Path,
        config: DetectionConfig | None = None,
    ) -> None:
        config = config or Configuration.get_config().detection
        if not Path(bike_model).exists():
            raise FileNotFoundError(f"Motorcycle model not found: {bike_model}")
        if not Path(helmet_model).exists():
            raise FileNotFoundError(f"Helmet model not found: {helmet_model}")

        self._device: str = "cuda:0" if torch.cuda.is_available() else "cpu"
        self._moto_model: YOLO = YOLO(str(bike_model))
        self._helmet_model: YOLO = YOLO(str(helmet_model))

        # Exported runtimes (ONNX/OpenVINO) pick their execution provider themselves
        self._moto_is_pt = not str(bike_model).lower().endswith((".onnx", "_openvino_model"))
        self._helmet_is_pt = not str(helmet_model).lower().endswith((".onnx", "_openvino_model"))
        if self._moto_is_pt:
            self._moto_model.to(self._device)
        if self._helmet_is_pt:
            self._helmet_model.to(self._device)

        self._config: DetectionConfig = config
        self._counter = LineCrossingCounter(config.line_position_percent)
        self._helmet_analyzer = HelmetAnalyzer(
            self._helmet_model, config, self._device, is_pt=self._helmet_is_pt
        )
        self._pending: dict[int, dict[str, Any]] = {}

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
        """Run both stages on one frame."""
        if frame is None or frame.size == 0:
            raise ValueError("Invalid or empty frame provided")

        self._counter.ensure_line(frame.shape[1])
        records = self._track_frame(frame)
        if self._counter.line_x is not None:
            draw_detection_line(frame, self._counter.line_x, self._config.line_overlay_alpha)
        return frame, records

    def _track_frame(self, frame: np.ndarray) -> list[DetectionRecord]:
        """Track motorcycles; evaluate helmets across a tight window upon line crossing."""
        records: list[DetectionRecord] = []

        try:
            with torch.inference_mode():
                track_kwargs: dict[str, object] = {
                    "conf": self._config.bike_confidence,
                    "persist": True,
                    "tracker": self._config.tracker,
                    "classes": [self._config.bike_id],
                    "imgsz": self._config.bike_imgsz,
                    "verbose": False,
                }
                if self._moto_is_pt:
                    track_kwargs["device"] = self._device
                result = self._moto_model.track(frame, **track_kwargs)[0]  # type: ignore[arg-type]
        except Exception as e:
            logger.error(f"Motorcycle tracking failed: {e}")
            return records

        if not result.boxes:
            self._flush_stale(active_ids=set(), records=records)
            return records

        active_ids: set[int] = set()
        eval_window = self._config.eval_window_frames
        early_exit_conf = self._config.early_exit_conf
        on_label = self._config.helmet_on

        for box in result.boxes:  # type: ignore[union-attr]
            if box.id is None:
                continue

            track_id = int(box.id.item())
            active_ids.add(track_id)
            moto_box = extract_box_coords(box)

            if self._counter.observe(track_id, moto_box.center_x):
                self._pending[track_id] = {
                    "remaining": eval_window,
                    "best_record": None,
                    "slots": [],
                }

            if track_id in self._pending:
                pending = self._pending[track_id]
                pending["remaining"] -= 1

                record = self._helmet_analyzer.analyze(frame, moto_box, track_id)
                self._merge_candidate(pending, record, on_label)
                best = pending["best_record"]

                # Wait out window for single riders so occluded pillion riders are not cut off
                if (
                    best is not None
                    and best.passenger_count >= 2
                    and best.confidence >= early_exit_conf
                ) or pending["remaining"] <= 0:
                    if best is not None:
                        records.append(best)
                    del self._pending[track_id]

            draw_box(frame, moto_box, MOTO_COLOR, f"ID:{track_id}")

        self._flush_stale(active_ids=active_ids, records=records)
        return records

    @staticmethod
    def _merge_candidate(
        pending: dict[str, Any],
        candidate: DetectionRecord,
        on_label: str = "helmet on",
    ) -> None:
        """Fuse distinct rider slots across the evaluation window and keep best record."""
        slots: list[tuple[float, str, float]] = pending.setdefault("slots", [])
        if candidate.riders:
            for rx, label, conf in candidate.riders:
                idx = min(
                    range(len(slots)),
                    key=lambda i: abs(rx - slots[i][0]),
                    default=None,
                )
                if idx is not None and abs(rx - slots[idx][0]) < SLOT_MERGE_RX:
                    if conf > slots[idx][2]:
                        slots[idx] = (rx, label, conf)
                else:
                    slots.append((rx, label, conf))

            helmet_status, over_capacity, violation = classify(
                [s[1] for s in slots], on_label
            )
            pending["best_record"] = replace(
                candidate,
                helmet_status=helmet_status,
                passenger_count=len(slots),
                over_capacity=over_capacity,
                violation=violation,
                confidence=max(s[2] for s in slots),
                riders=list(slots),
            )
            return

        current = pending.get("best_record")
        if current is None or (
            candidate.passenger_count,
            candidate.violation,
            candidate.confidence,
        ) > (
            current.passenger_count,
            current.violation,
            current.confidence,
        ):
            pending["best_record"] = candidate

    def _flush_stale(
        self, active_ids: set[int], records: list[DetectionRecord]
    ) -> None:
        """Finalize pending tracks that disappeared before their window expired."""
        for tid in [t for t in self._pending if t not in active_ids]:
            best = self._pending.pop(tid).get("best_record")
            if best is not None:
                records.append(best)

    def reset_tracks(self) -> None:
        """Forget crossing state (new video / stream reconnect)."""
        self._counter.reset()
        self._pending.clear()
