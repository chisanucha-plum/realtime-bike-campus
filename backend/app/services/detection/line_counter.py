"""Crossing state for the detection line — owns all counting state."""

import logging

logger = logging.getLogger(__name__)


class LineCrossingCounter:
    """Reports each left-to-right line crossing once per motorcycle track.

    Owns every piece of crossing state (line position, per-track history,
    already-counted ids) so the detection service stays stateless about it.
    """

    def __init__(self, line_position_percent: float) -> None:
        """Create a counter whose line sits at ``line_position_percent`` of width.

        Args:
            line_position_percent: Line x-position as a fraction of frame width
        """
        self._line_position_percent = line_position_percent
        self._line_x: int | None = None
        self._history: dict[int, int] = {}  # {track_id: last_center_x}
        self._counted: set[int] = set()  # Track IDs already reported

    @property
    def line_x(self) -> int | None:
        """Fixed x-position of the detection line (None before first frame)."""
        return self._line_x

    def ensure_line(self, frame_width: int) -> None:
        """Fix the line position from the first frame's width."""
        if self._line_x is None:
            self._line_x = int(frame_width * self._line_position_percent)
            logger.info(
                f"Detection line set to x={self._line_x} "
                f"({self._line_position_percent * 100:.0f}% of width {frame_width})"
            )

    def observe(self, track_id: int, center_x: int) -> bool:
        """Record a motorcycle position; True when it just crossed left-to-right.

        A track is reported at most once until ``reset``. The first sighting
        never counts as a crossing (no previous side to compare against).

        Args:
            track_id: Motorcycle track ID
            center_x: Current horizontal center of the motorcycle box

        Returns:
            True only on the single observation that crosses the line
        """
        prev_center_x = self._history.get(track_id)
        crossed = (
            self._line_x is not None
            and track_id not in self._counted
            and prev_center_x is not None
            and prev_center_x < self._line_x
            and center_x >= self._line_x
        )
        if crossed:
            self._counted.add(track_id)
            logger.info(
                f"Motorcycle ID:{track_id} crossed detection line at x={center_x}"
            )
        self._history[track_id] = center_x
        return crossed

    def reset(self) -> None:
        """Forget history and counted ids (new video / stream reconnect)."""
        self._history.clear()
        self._counted.clear()
        logger.debug("Track history reset")
