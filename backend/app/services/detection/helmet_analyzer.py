"""Helmet stage: ROI geometry, helmet inference, and the violation verdict."""

import logging

import numpy as np
import torch
from ultralytics.engine.results import Boxes


from app.configuration import DetectionConfig
from app.models.detection import BoundingBox, DetectionRecord
from app.services.detection.annotate import draw_box, helmet_color

logger = logging.getLogger(__name__)

# A motorcycle seat legally fits a rider plus one pillion
MAX_PASSENGERS = 2


def extract_box_coords(box: Boxes) -> BoundingBox:
    """Extract integer bounding box coordinates from a YOLO box object."""
    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
    return BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2)


def roi_bounds(
    frame_shape: tuple[int, ...],
    moto_box: BoundingBox,
    side_pad: float,
    top_pad: float,
    bottom_pad: float,
) -> tuple[int, int, int, int]:
    """Scale-invariant ROI around a motorcycle as (x1, y1, x2, y2)."""
    height, width = frame_shape[:2]
    pad_x = side_pad * moto_box.width
    top = top_pad * moto_box.height
    bottom = bottom_pad * moto_box.height
    return (
        int(max(0, moto_box.x1 - pad_x)),
        int(max(0, moto_box.y1 - top)),
        int(min(width, moto_box.x2 + pad_x)),
        int(min(height, moto_box.y2 + bottom)),
    )


def sits_on_bike(moto_box: BoundingBox, box: BoundingBox) -> bool:
    """Reject pedestrian/neighbouring heads outside 30% horizontal margin or below bike."""
    margin = 0.3 * moto_box.width
    return (moto_box.x1 - margin) <= box.center_x <= (moto_box.x2 + margin) and box.center_y <= moto_box.y2


def same_head(
    box: BoundingBox, kept_boxes: list[BoundingBox], moto_box: BoundingBox
) -> bool:
    """True when box center overlaps an already-accepted head on the same bike."""
    tol_x = 0.12 * max(moto_box.width, 1)
    tol_y = 0.12 * max(moto_box.height, 1)
    return any(
        abs(box.center_x - prev.center_x) < tol_x
        and abs(box.center_y - prev.center_y) < tol_y
        for prev in kept_boxes
    )


def classify(labels: list[str], on_label: str) -> tuple[bool, bool, bool]:
    """Reduce helmet labels to (helmet_status, over_capacity, violation)."""
    helmet_status = all(label == on_label for label in labels) if labels else False
    violation = bool(labels) and not helmet_status
    return helmet_status, len(labels) > MAX_PASSENGERS, violation


class HelmetAnalyzer:
    """Runs the helmet model on a motorcycle ROI and builds the record."""

    def __init__(
        self,
        model: object,
        config: DetectionConfig,
        device: str,
        is_pt: bool = True,
    ) -> None:
        self._model = model
        self._config = config
        self._device = device
        self._is_pt = is_pt

    def analyze(
        self, frame: np.ndarray, moto_box: BoundingBox, track_id: int
    ) -> DetectionRecord:
        """Detect helmets around one motorcycle and classify the outcome."""
        record = DetectionRecord(
            motorcycle_track_id=track_id,
            helmet_status=False,
            passenger_count=0,
            over_capacity=False,
            violation=False,
        )

        x1, y1, x2, y2 = roi_bounds(
            frame.shape,
            moto_box,
            self._config.roi_side_pad,
            self._config.roi_top_pad,
            self._config.roi_bottom_pad,
        )
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            logger.warning(f"Empty motorcycle crop for track {track_id}, skipping")
            return record

        try:
            device_kw = {"device": self._device} if self._is_pt else {}
            with torch.inference_mode():
                result = self._model(
                    crop,
                    conf=self._config.helmet_confidence,
                    imgsz=self._config.helmet_imgsz,
                    verbose=False,
                    **device_kw,
                )[0]
        except Exception as e:
            logger.error(f"Helmet detection failed for track {track_id}: {e}")
            record.violation = True
            return record

        candidates: list[tuple[float, str, BoundingBox]] = []
        for hbox in result.boxes or []:
            raw = extract_box_coords(hbox)
            hbox_global = BoundingBox(raw.x1 + x1, raw.y1 + y1, raw.x2 + x1, raw.y2 + y1)
            if not sits_on_bike(moto_box, hbox_global):
                continue
            try:
                conf = float(hbox.conf.item())
            except Exception:
                conf = 0.0
            label = result.names[int(hbox.cls.item())]
            candidates.append((conf, label, hbox_global))

        candidates.sort(key=lambda item: item[0], reverse=True)
        kept_boxes: list[BoundingBox] = []
        riders: list[tuple[float, str, float]] = []
        moto_w = max(moto_box.width, 1)

        for conf, label, hbox_global in candidates:
            if same_head(hbox_global, kept_boxes, moto_box):
                continue
            kept_boxes.append(hbox_global)
            riders.append(((hbox_global.center_x - moto_box.x1) / moto_w, label, conf))
            draw_box(
                frame,
                hbox_global,
                helmet_color(label, self._config.helmet_on),
                label,
            )

        labels = [label for _, label, _ in riders]
        record.passenger_count = len(riders)
        record.confidence = riders[0][2] if riders else 0.0
        record.riders = riders
        record.helmet_status, record.over_capacity, record.violation = classify(
            labels, self._config.helmet_on
        )

        logger.info(
            f"Detection ID:{track_id} | "
            f"Helmets:{labels} | "
            f"Status:{'OK' if record.helmet_status else 'VIOLATION' if record.violation else 'NOT_DETECTED'}"
        )
        return record
