"""Frame storage service for saving detected frames as images."""

import logging
from datetime import datetime, timedelta
from pathlib import Path

import cv2
import numpy as np

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parents[2]


class FrameStorage:
    """Save frames to disk with organized directory structure."""

    def __init__(self, base_dir: str | Path = "frames_storage") -> None:
        # Anchor relative paths to backend/ so the location doesn't depend on CWD
        self.base_dir = BACKEND_DIR / base_dir
        self.base_dir.mkdir(exist_ok=True)
        logger.info(f"Frame storage initialized at {self.base_dir}")

    def save_frame(
        self,
        frame: np.ndarray,
        track_id: int,
        violation: bool,
        quality: int = 80,
        jpeg_bytes: bytes | None = None,
    ) -> str | None:
        """Save frame to disk and return relative URL path."""
        try:
            now = datetime.now()
            date_dir = self.base_dir / now.strftime("%Y-%m-%d")
            date_dir.mkdir(exist_ok=True)

            status = "violation" if violation else "normal"
            timestamp = now.strftime("%H%M%S%f")[:-3]
            filepath = date_dir / f"track_{track_id}_{status}_{timestamp}.jpg"

            if jpeg_bytes is not None:
                data = jpeg_bytes
            else:
                ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
                if not ok:
                    logger.warning("Failed to encode frame to JPEG")
                    return None
                data = buf.tobytes()

            filepath.write_bytes(data)
            rel_path = str(filepath.relative_to(self.base_dir)).replace("\\", "/")
            logger.info(f"Frame saved: {rel_path}")
            return rel_path

        except Exception as e:
            logger.error(f"Failed to save frame: {e}", exc_info=True)
            return None

    def cleanup_old_frames(self, days: int = 7) -> int:
        """Remove frames older than N days (<= 0 disables cleanup)."""
        if days <= 0:
            return 0

        cutoff = datetime.now() - timedelta(days=days)
        deleted = 0

        try:
            for filepath in self.base_dir.rglob("*.jpg"):
                if datetime.fromtimestamp(filepath.stat().st_mtime) < cutoff:
                    filepath.unlink()
                    deleted += 1

            if deleted > 0:
                logger.info(f"Cleaned up {deleted} old frames")
        except Exception as e:
            logger.error(f"Failed to cleanup frames: {e}")

        return deleted


frame_storage = FrameStorage()
