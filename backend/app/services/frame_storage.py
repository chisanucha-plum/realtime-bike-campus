"""Frame storage service for saving detected frames as images."""

import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parents[2]


class FrameStorage:
    """Save frames to disk with organized directory structure."""

    def __init__(self, base_dir: str | Path = "frames_storage") -> None:
        """Initialize frame storage.
        
        Args:
            base_dir: Base directory for storing frames (default: frames_storage)
        """
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
    ) -> Optional[str]:
        """Save frame to disk.

        Args:
            frame: OpenCV frame (numpy array)
            track_id: Motorcycle track ID
            violation: Whether helmet violation detected
            quality: JPEG quality (0-100)
            jpeg_bytes: Optional pre-encoded JPEG bytes to avoid re-encoding

        Returns:
            Relative path to saved image, or None if failed
        """
        try:
            # Create directory: frames_storage/YYYY-MM-DD
            date_dir = self.base_dir / datetime.now().strftime("%Y-%m-%d")
            date_dir.mkdir(exist_ok=True)

            # Filename: track_{id}_{violation}_{timestamp}.jpg
            status = "violation" if violation else "normal"
            timestamp = datetime.now().strftime("%H%M%S%f")[:-3]  # HHmmssSSS
            filename = f"track_{track_id}_{status}_{timestamp}.jpg"
            filepath = date_dir / filename

            # Save frame
            if jpeg_bytes is not None:
                data = jpeg_bytes
            else:
                ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
                if not ok:
                    logger.warning("Failed to encode frame to JPEG")
                    return None
                data = buf.tobytes()

            filepath.write_bytes(data)
            # Use forward slash for URL compatibility
            rel_path = str(filepath.relative_to(self.base_dir)).replace("\\", "/")
            logger.info(f"Frame saved: {rel_path}")
            return rel_path

        except Exception as e:
            logger.error(f"Failed to save frame: {e}", exc_info=True)
            return None

    def cleanup_old_frames(self, days: int = 7) -> int:
        """Remove frames older than N days.

        Args:
            days: Number of days to keep

        Returns:
            Number of files deleted
        """
        cutoff_date = datetime.now() - timedelta(days=days)
        deleted_count = 0

        try:
            for filepath in self.base_dir.rglob("*.jpg"):
                if datetime.fromtimestamp(filepath.stat().st_mtime) < cutoff_date:
                    filepath.unlink()
                    deleted_count += 1

            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} old frames")
        except Exception as e:
            logger.error(f"Failed to cleanup frames: {e}")

        return deleted_count


# Module-level singleton
frame_storage = FrameStorage()
