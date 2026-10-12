from app.database.database import Base
from sqlalchemy import Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column


class HistoryStatus(Base):
    """Database model for storing historical motorcycle helmet detection events."""

    __tablename__ = "history_status"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    track_id: Mapped[int] = mapped_column(Integer, nullable=True, index=True)
    helmet_status: Mapped[bool] = mapped_column(Boolean, nullable=True)
    passenger_count: Mapped[int] = mapped_column(Integer, nullable=True)
    over_capacity: Mapped[bool] = mapped_column(Boolean, nullable=True)
    violation: Mapped[bool] = mapped_column(Boolean, nullable=True)
    timestamp: Mapped[str] = mapped_column(String, nullable=True, index=True)
    frame_path: Mapped[str] = mapped_column(String, nullable=True)  # Path to saved frame image
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)


