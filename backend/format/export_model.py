import logging
from pathlib import Path
from ultralytics import YOLO

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

TRAIN_DIR = Path(__file__).resolve().parent.parent / "train"
MODELS = ["yolov8n.pt", "epoch250.pt"]

for name in MODELS:
    pt_path = TRAIN_DIR / name
    if not pt_path.exists():
        logger.warning("not found: %s", pt_path)
        continue
    logger.info("export: %s", pt_path)
    YOLO(str(pt_path)).export(format="openvino", imgsz=640)
