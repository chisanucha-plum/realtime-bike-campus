"""Unit tests for email digest service."""

from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.configuration import Configuration, SmtpConfig
from app.database.database import Base
from app.database.history_status import HistoryStatus
from app.services.email_service import (
    build_daily_digest_message,
    calculate_daily_digest_stats,
    send_daily_digest,
)


@pytest.fixture
def db_session():
    """Create a temporary in-memory SQLite database session."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Seed sample history records for 2026-09-30
    records = [
        HistoryStatus(
            id="rec-1",
            track_id=1,
            helmet_status=True,
            passenger_count=1,
            over_capacity=False,
            violation=False,
            timestamp="2026-09-30 08:15:00",
            frame_path=None,
        ),
        HistoryStatus(
            id="rec-2",
            track_id=2,
            helmet_status=False,
            passenger_count=1,
            over_capacity=False,
            violation=True,
            timestamp="2026-09-30 08:45:00",
            frame_path=None,
        ),
        HistoryStatus(
            id="rec-3",
            track_id=3,
            helmet_status=False,
            passenger_count=3,
            over_capacity=True,
            violation=True,
            timestamp="2026-09-30 17:30:00",
            frame_path=None,
        ),
        # Another day - should be excluded
        HistoryStatus(
            id="rec-4",
            track_id=4,
            helmet_status=False,
            passenger_count=1,
            over_capacity=False,
            violation=True,
            timestamp="2026-09-29 12:00:00",
            frame_path=None,
        ),
    ]
    session.add_all(records)
    session.commit()

    try:
        yield session
    finally:
        session.close()


def test_calculate_daily_digest_stats(db_session):
    target = date(2026, 9, 30)
    stats, snapshots, rows = calculate_daily_digest_stats(db_session, target_date=target)

    assert stats["date"] == "2026-09-30"
    assert stats["total_detections"] == 3
    assert stats["total_violations"] == 2
    assert stats["helmet_on"] == 1
    assert stats["helmet_off"] == 2
    assert stats["over_capacity"] == 1
    # 1 helmet on / (1 on + 2 off) = 33.3%
    assert stats["compliance_percent"] == 33.3
    assert (
        "08:00 - 09:00" in stats["peak_hour"] or "17:00 - 18:00" in stats["peak_hour"]
    )
    assert snapshots == []
    assert len(rows) == 3


def test_calculate_daily_digest_stats_empty_day(db_session):
    target = date(2026, 1, 1)
    stats, snapshots, rows = calculate_daily_digest_stats(db_session, target_date=target)

    assert stats["total_detections"] == 0
    assert stats["total_violations"] == 0
    assert stats["compliance_percent"] == 0.0
    assert snapshots == []
    assert rows == []


def test_generate_daily_digest_csv(db_session):
    from app.services.email_service import generate_daily_digest_csv
    target = date(2026, 9, 30)
    _, _, rows = calculate_daily_digest_stats(db_session, target_date=target)
    csv_text = generate_daily_digest_csv(rows)

    assert csv_text.startswith("\ufefftimestamp,track_id,helmet_status,passenger_count,over_capacity,violation,frame_path")
    lines = csv_text.strip().split("\n")
    assert len(lines) == 4  # 1 header + 3 rows
    # Check first row starts with timestamp
    assert lines[1].startswith("2026-09-30 08:15:00,1,helmet on,1,no,no")


def test_build_daily_digest_message():
    stats = {
        "date": "2026-09-30",
        "total_detections": 10,
        "total_violations": 3,
        "helmet_on": 7,
        "helmet_off": 3,
        "over_capacity": 1,
        "compliance_percent": 70.0,
        "peak_hour": "08:00 - 09:00 (2 ครั้ง)",
    }
    msg = build_daily_digest_message(
        stats=stats,
        snapshot_paths=[],
        from_email="system@example.com",
        to_email="chief@example.com",
    )

    assert msg["To"] == "chief@example.com"
    assert "2026-09-30" in msg["Subject"]
    assert "70.0%" in msg.get_body(preferencelist=("plain",)).get_content()


def test_send_daily_digest_dry_run(db_session):
    smtp_mock_config = SmtpConfig(
        host="",
        port=587,
        user="",
        password="",
        from_email="noreply@example.com",
        security_chief_email="chief@example.com",
        digest_enabled=True,
        digest_time="18:00",
    )

    with patch.object(Configuration, "get_config") as mock_cfg:
        mock_cfg.return_value = MagicMock(smtp=smtp_mock_config)
        res = send_daily_digest(
            db_session,
            recipient_email="test@example.com",
            target_date=date(2026, 9, 30),
        )

    assert res["status"] == "dry_run"
    assert res["recipient"] == "test@example.com"
    assert res["summary"]["total_detections"] == 3


def test_send_daily_digest_missing_recipient(db_session):
    smtp_mock_config = SmtpConfig(
        host="",
        port=587,
        user="",
        password="",
        from_email="",
        security_chief_email="",
        digest_enabled=False,
        digest_time="18:00",
    )

    with patch.object(Configuration, "get_config") as mock_cfg:
        mock_cfg.return_value = MagicMock(smtp=smtp_mock_config)
        with pytest.raises(ValueError, match="Recipient email is not configured"):
            send_daily_digest(db_session, recipient_email="")


def test_send_daily_digest_resend_success(db_session):
    smtp_mock_config = SmtpConfig(
        host="",
        port=587,
        user="",
        password="",
        from_email="onboarding@resend.dev",
        security_chief_email="armser44@gmail.com",
        digest_enabled=True,
        digest_time="18:00",
        api_key="re_mock_test_key",
    )

    with (
        patch.object(Configuration, "get_config") as mock_cfg,
        patch("app.services.email_service.send_via_resend") as mock_resend,
    ):
        mock_cfg.return_value = MagicMock(smtp=smtp_mock_config)
        mock_resend.return_value = {"id": "email_test_123"}

        res = send_daily_digest(
            db_session,
            recipient_email="armser44@gmail.com",
            target_date=date(2026, 9, 30),
        )

        assert res["status"] == "sent"
        assert "Resend HTTPS" in res["message"]
        mock_resend.assert_called_once()


def test_send_daily_digest_smtp_success(db_session):
    smtp_mock_config = SmtpConfig(
        host="smtp.mailserver.com",
        port=587,
        user="testuser",
        password="secretpassword",
        from_email="alert@university.ac.th",
        security_chief_email="chief@university.ac.th",
        digest_enabled=True,
        digest_time="18:00",
    )

    with (
        patch.object(Configuration, "get_config") as mock_cfg,
        patch("smtplib.SMTP") as mock_smtp_cls,
    ):
        mock_cfg.return_value = MagicMock(smtp=smtp_mock_config)
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = mock_server

        res = send_daily_digest(
            db_session,
            recipient_email="chief@university.ac.th",
            target_date=date(2026, 9, 30),
        )

        assert res["status"] == "sent"
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_called_once_with("testuser", "secretpassword")
        mock_server.send_message.assert_called_once()


@pytest.mark.asyncio
async def test_send_helmet_digest_router_endpoint(db_session):
    from app.routers.helmet import send_helmet_digest
    from app.schemas.helmet import SendDigestRequest

    mock_user = MagicMock()

    with patch("app.services.email_service.send_daily_digest") as mock_send:
        mock_send.return_value = {
            "status": "sent",
            "message": "Daily digest sent",
            "recipient": "chief@university.ac.th",
            "summary": {"total_detections": 5},
        }

        req = SendDigestRequest(recipient_email="chief@university.ac.th")
        response = await send_helmet_digest(
            request=req, db=db_session, current_user=mock_user
        )

        assert response.success is True
        assert response.status == "sent"
        assert response.recipient == "chief@university.ac.th"
        mock_send.assert_called_once_with(
            db_session, recipient_email="chief@university.ac.th"
        )


def test_send_via_resend_http_request():
    from app.services.email_service import send_via_resend
    import io
    import json

    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps({"id": "email_abc123"}).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = mock_resp

        result = send_via_resend(
            api_key="re_secret_123",
            from_email="onboarding@resend.dev",
            to_email="security@university.ac.th",
            subject="Daily Helmet Digest",
            html="<p>Report</p>",
            snapshot_paths=[],
            csv_content="timestamp,track_id\n2026-09-30 08:00:00,1",
            csv_filename="test.csv",
        )

        assert result["id"] == "email_abc123"
        mock_urlopen.assert_called_once()
        req_arg = mock_urlopen.call_args[0][0]
        assert req_arg.full_url == "https://api.resend.com/emails"
        assert req_arg.headers["Authorization"] == "Bearer re_secret_123"
        payload = json.loads(req_arg.data.decode("utf-8"))
        assert payload["to"] == ["security@university.ac.th"]
        assert len(payload["attachments"]) == 1
        assert payload["attachments"][0]["filename"] == "test.csv"


def test_calculate_daily_digest_stats_malformed_timestamp(db_session):
    record = HistoryStatus(
        id="rec-malformed",
        track_id=99,
        helmet_status=False,
        passenger_count=1,
        over_capacity=False,
        violation=True,
        timestamp="invalid-timestamp",
        frame_path=None,
    )
    db_session.add(record)
    db_session.commit()

    stats, _, _ = calculate_daily_digest_stats(
        db_session, target_date=date(2026, 9, 30)
    )
    # Shouldn't crash and should safely handle non-standard timestamp
    assert stats["peak_hour"] is not None


def test_smtp_config_digest_time_normalization():
    cfg = SmtpConfig.from_dict({"digest_time": " 18:00:00 "})
    assert cfg.digest_time == "18:00"

