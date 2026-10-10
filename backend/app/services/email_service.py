"""Email service for sending daily security digests to the Security Chief.

Supports:
1. Resend REST API via HTTPS (Port 443, firewall-safe) using Python standard library.
2. Standard SMTP (STARTTLS) fallback.
3. Dry-run mode when no credentials are configured.
"""

import base64
import csv
from datetime import date, timedelta
from email.message import EmailMessage
import io
import json
import logging
from pathlib import Path
import smtplib
from typing import Any
import urllib.error
import urllib.request

from sqlalchemy.orm import Session

from app.configuration import Configuration
from app.database.history_status import HistoryStatus
from app.services.frame_storage import frame_storage

logger = logging.getLogger(__name__)


def calculate_daily_digest_stats(
    db: Session, target_date: date | None = None
) -> tuple[dict[str, Any], list[Path], list[HistoryStatus]]:
    """Aggregate detection statistics for a given day, collect sample violation snapshots, and history rows."""
    target_date = target_date or date.today()
    day_str = target_date.isoformat()
    next_day_str = (target_date + timedelta(days=1)).isoformat()

    rows: list[HistoryStatus] = (
        db.query(HistoryStatus)
        .filter(
            HistoryStatus.timestamp >= f"{day_str} 00:00:00",
            HistoryStatus.timestamp < f"{next_day_str} 00:00:00",
        )
        .order_by(HistoryStatus.timestamp.asc())
        .all()
    )

    total_detections = len(rows)
    violations = sum(1 for r in rows if r.violation)
    helmet_on = sum(1 for r in rows if r.helmet_status is True)
    helmet_off = sum(1 for r in rows if r.helmet_status is False)
    over_capacity = sum(1 for r in rows if r.over_capacity)

    denom = helmet_on + helmet_off
    compliance_percent = round((helmet_on / denom) * 100, 1) if denom > 0 else 0.0

    # Calculate peak violation hour
    hour_counts: dict[str, int] = {}
    for r in rows:
        if (
            r.violation
            and r.timestamp
            and len(r.timestamp) >= 13
            and r.timestamp[11:13].isdigit()
        ):
            hour = r.timestamp[11:13]
            hour_counts[hour] = hour_counts.get(hour, 0) + 1

    if hour_counts:
        peak_h = max(hour_counts, key=hour_counts.get)
        peak_hour_str = f"{peak_h}:00 - {(int(peak_h)+1) % 24:02d}:00 ({hour_counts[peak_h]} ครั้ง)"
    else:
        peak_hour_str = "ไม่มีการกระทำผิด (0 ครั้ง)"

    # Collect up to 3 valid recent violation snapshot paths
    valid_snapshot_paths: list[Path] = []
    for r in reversed(rows):
        if r.violation and r.frame_path:
            p = Path(r.frame_path)
            if not p.is_file():
                p = frame_storage.base_dir / r.frame_path
            if p.is_file():
                valid_snapshot_paths.append(p)
            if len(valid_snapshot_paths) >= 3:
                break

    stats: dict[str, Any] = {
        "date": day_str,
        "total_detections": total_detections,
        "total_violations": violations,
        "helmet_on": helmet_on,
        "helmet_off": helmet_off,
        "over_capacity": over_capacity,
        "compliance_percent": compliance_percent,
        "peak_hour": peak_hour_str,
        "snapshots_count": len(valid_snapshot_paths),
    }

    return stats, valid_snapshot_paths, rows


def generate_daily_digest_csv(rows: list[HistoryStatus]) -> str:
    """Generate CSV text with UTF-8 BOM, standardized columns starting with timestamp."""
    output = io.StringIO()
    # Write UTF-8 BOM so Excel opens Thai characters correctly
    output.write("\ufeff")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow([
        "timestamp",
        "track_id",
        "helmet_status",
        "passenger_count",
        "over_capacity",
        "violation",
        "frame_path",
    ])

    for r in rows:
        helmet_str = (
            "helmet on"
            if r.helmet_status is True
            else ("helmet off" if r.helmet_status is False else "unknown")
        )
        writer.writerow([
            r.timestamp or "",
            r.track_id if r.track_id is not None else "",
            helmet_str,
            r.passenger_count if r.passenger_count is not None else 0,
            "yes" if r.over_capacity else "no",
            "yes" if r.violation else "no",
            r.frame_path or "",
        ])

    return output.getvalue()


def generate_daily_digest_text(stats: dict[str, Any]) -> str:
    """Generate plain-text digest fallback."""
    return (
        f"=========================================\n"
        f"รายงานสรุปการตรวจจับการสวมหมวกนิรภัยประจำวัน\n"
        f"วันที่: {stats['date']}\n"
        f"=========================================\n\n"
        f"• ยานพาหนะผ่านจุดตรวจทั้งหมด: {stats['total_detections']} คัน\n"
        f"• อัตราการสวมหมวกนิรภัย: {stats['compliance_percent']}%\n"
        f"• สวมหมวกนิรภัย: {stats['helmet_on']} คน\n"
        f"• ไม่สวมหมวกนิรภัย: {stats['helmet_off']} คน\n"
        f"• บรรทุกผู้โดยสารเกินกำหนด: {stats['over_capacity']} ครั้ง\n"
        f"• รวมการกระทำผิดทั้งหมด: {stats['total_violations']} ครั้ง\n"
        f"• ช่วงเวลาที่พบการกระทำผิดสูงสุด: {stats['peak_hour']}\n\n"
        f"ระบบตรวจสอบความปลอดภัยการสวมหมวกนิรภัยอัตโนมัติ (Helmet Detection AI)\n"
    )


def generate_daily_digest_html(
    stats: dict[str, Any], snapshot_paths: list[Path]
) -> str:
    """Generate responsive HTML security digest report."""
    image_sections = []
    for idx, path in enumerate(snapshot_paths):
        cid = f"snapshot_{idx}"
        image_sections.append(
            f'<div style="margin-bottom: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); text-align: left;">'
            f'  <div style="background: #f8fafc; padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #1e293b;">'
            f'    <span style="display: inline-block; width: 8px; height: 8px; background: #ef4444; border-radius: 50%; margin-right: 6px;"></span>'
            f'    ภาพหลักฐานที่ {idx + 1}: <span style="font-family: monospace; font-size: 12px; color: #64748b;">{path.name}</span>'
            f'  </div>'
            f'  <div style="padding: 12px; background: #0f172a; text-align: center;">'
            f'    <img src="cid:{cid}" alt="หลักฐาน {path.name}" style="width: 100%; max-width: 520px; height: auto; border-radius: 6px; display: block; margin: 0 auto;" />'
            f'  </div>'
            f'</div>'
        )
    snapshots_html = (
        "".join(image_sections)
        if image_sections
        else '<p style="color: #94a3b8; font-size: 13px;">ไม่มีภาพบันทึกการกระทำผิดในวันนี้</p>'
    )

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
    .header {{ background: #0f172a; color: #ffffff; padding: 24px; text-align: center; }}
    .badge {{ display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 600; border-radius: 9999px; background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.3); margin-bottom: 8px; }}
    .title {{ font-size: 20px; font-weight: 700; margin: 0; color: #ffffff; }}
    .date {{ font-size: 13px; color: #94a3b8; margin-top: 4px; }}
    .content {{ padding: 24px; }}
    .grid {{ display: table; width: 100%; border-collapse: separate; border-spacing: 12px; margin-bottom: 16px; }}
    .card {{ display: table-cell; width: 50%; padding: 16px; border-radius: 12px; background: #f1f5f9; vertical-align: top; }}
    .card-label {{ font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }}
    .card-value {{ font-size: 24px; font-weight: 800; color: #0f172a; }}
    .val-good {{ color: #16a34a; }}
    .val-bad {{ color: #dc2626; }}
    .section-title {{ font-size: 15px; font-weight: 700; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin: 20px 0 12px 0; }}
    table.breakdown {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
    table.breakdown td {{ padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }}
    table.breakdown td:last-child {{ text-align: right; font-weight: 600; }}
    .snapshots {{ text-align: center; padding: 8px 0; }}
    .footer {{ background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">SECURITY CHIEF DAILY DIGEST</div>
      <h1 class="title">รายงานสรุปการตรวจจับหมวกนิรภัย</h1>
      <div class="date">ประจำวันที่: {stats['date']}</div>
    </div>
    <div class="content">
      <div class="grid">
        <div class="card">
          <div class="card-label">ยานพาหนะผ่านจุดตรวจ</div>
          <div class="card-value">{stats['total_detections']} <span style="font-size: 13px; font-weight: normal; color: #64748b;">คัน</span></div>
        </div>
        <div class="card">
          <div class="card-label">อัตราการสวมหมวก</div>
          <div class="card-value val-good">{stats['compliance_percent']}%</div>
        </div>
      </div>
      <div class="grid">
        <div class="card">
          <div class="card-label">รวมการกระทำผิด</div>
          <div class="card-value val-bad">{stats['total_violations']} <span style="font-size: 13px; font-weight: normal; color: #64748b;">ครั้ง</span></div>
        </div>
        <div class="card">
          <div class="card-label">บรรทุกเกินกำหนด</div>
          <div class="card-value">{stats['over_capacity']} <span style="font-size: 13px; font-weight: normal; color: #64748b;">ครั้ง</span></div>
        </div>
      </div>

      <div class="section-title">รายละเอียดสถิติประจำวัน</div>
      <table class="breakdown">
        <tr>
          <td>ผู้ขับขี่/ผู้โดยสารสวมหมวกนิรภัย</td>
          <td style="color: #16a34a;">{stats['helmet_on']} คน</td>
        </tr>
        <tr>
          <td>ไม่สวมหมวกนิรภัย</td>
          <td style="color: #dc2626;">{stats['helmet_off']} คน</td>
        </tr>
        <tr>
          <td>ช่วงเวลาที่พบการกระทำผิดสูงสุด</td>
          <td>{stats['peak_hour']}</td>
        </tr>
      </table>

      <div class="section-title">หลักฐานภาพถ่ายการกระทำผิด ({len(snapshot_paths)} รายการล่าสุด)</div>
      <div class="snapshots">
        {snapshots_html}
      </div>
    </div>
    <div class="footer">
      ส่งโดยระบบตรวจจับหมวกนิรภัยอัตโนมัติ AI Helmet Detection System<br>
      แจ้งเตือนหัวหน้าชุดรักษาความปลอดภัยและจราจร
    </div>
  </div>
</body>
</html>
"""


def digest_subject(stats: dict[str, Any]) -> str:
    """Subject line shared by the SMTP and Resend delivery paths."""
    return f"[Helmet Alert] รายงานสรุปความปลอดภัยประจำวัน - วันที่ {stats['date']}"


def build_daily_digest_message(
    stats: dict[str, Any],
    snapshot_paths: list[Path],
    from_email: str,
    to_email: str,
    csv_content: str | None = None,
) -> EmailMessage:
    """Build a multipart MIME email message with HTML summary, snapshot attachments, and CSV report."""
    msg = EmailMessage()
    msg["Subject"] = digest_subject(stats)
    msg["From"] = from_email or "helmet-detection-system@local"
    msg["To"] = to_email

    msg.set_content(generate_daily_digest_text(stats))
    msg.add_alternative(
        generate_daily_digest_html(stats, snapshot_paths), subtype="html"
    )

    # Attach images with CID and attachment headers
    for idx, path in enumerate(snapshot_paths):
        try:
            with open(path, "rb") as f:
                img_data = f.read()
            cid = f"snapshot_{idx}"
            msg.get_payload()[1].add_related(
                img_data,
                maintype="image",
                subtype="jpeg",
                cid=f"<{cid}>",
                filename=path.name,
            )
        except Exception as e:
            logger.warning(f"Could not attach snapshot {path}: {e}")

    # Attach CSV report
    if csv_content:
        csv_filename = f"helmet-digest-{stats['date']}.csv"
        msg.add_attachment(
            csv_content.encode("utf-8"),
            maintype="text",
            subtype="csv",
            filename=csv_filename,
        )

    return msg


def send_via_resend(
    api_key: str,
    from_email: str,
    to_email: str,
    subject: str,
    html: str,
    snapshot_paths: list[Path],
    csv_content: str | None = None,
    csv_filename: str | None = None,
) -> dict[str, Any]:
    """Send email via Resend REST API over HTTPS port 443 (firewall-safe)."""
    payload: dict[str, Any] = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }

    attachments: list[dict[str, Any]] = []
    if snapshot_paths:
        for idx, path in enumerate(snapshot_paths):
            try:
                with open(path, "rb") as f:
                    b64_content = base64.b64encode(f.read()).decode("utf-8")
                attachments.append(
                    {
                        "filename": path.name,
                        "content": b64_content,
                        "content_id": f"snapshot_{idx}",
                    }
                )
            except Exception as e:
                logger.warning(f"Could not read attachment {path} for Resend: {e}")

    if csv_content:
        fname = csv_filename or "helmet-digest.csv"
        b64_csv = base64.b64encode(csv_content.encode("utf-8")).decode("utf-8")
        attachments.append(
            {
                "filename": fname,
                "content": b64_csv,
            }
        )

    if attachments:
        payload["attachments"] = attachments

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "resend-python/2.0.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {"id": "ok"}
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="replace")
        logger.error(f"Resend API error {e.code}: {err_msg}")
        raise RuntimeError(f"Resend API error ({e.code}): {err_msg}") from e
    except Exception as e:
        logger.exception("Failed to connect to Resend API")
        raise RuntimeError(f"Resend HTTPS connection failed: {e}") from e


def send_daily_digest(
    db: Session,
    recipient_email: str | None = None,
    target_date: date | None = None,
) -> dict[str, Any]:
    """Generate and send or dry-run daily digest email.

    Tries Resend HTTPS API first if api_key is configured, then SMTP host, then dry-run.
    """
    config = Configuration.get_config().smtp
    target_recipient = (
        recipient_email.strip()
        if recipient_email and recipient_email.strip()
        else (
            config.security_chief_email.strip()
            if config and config.security_chief_email
            else ""
        )
    )

    if not target_recipient:
        raise ValueError("Recipient email is not configured. Please provide an email address.")

    stats, snapshot_paths, rows = calculate_daily_digest_stats(db, target_date)
    csv_content = generate_daily_digest_csv(rows)
    csv_filename = f"helmet-digest-{stats['date']}.csv"

    # 1. Resend API via HTTPS (Port 443)
    if config and config.api_key:
        res = send_via_resend(
            api_key=config.api_key,
            from_email=config.from_email or "onboarding@resend.dev",
            to_email=target_recipient,
            subject=digest_subject(stats),
            html=generate_daily_digest_html(stats, snapshot_paths),
            snapshot_paths=snapshot_paths,
            csv_content=csv_content,
            csv_filename=csv_filename,
        )
        msg_id = res.get("id", "ok")
        logger.info(f"Resend email sent successfully to {target_recipient}, id={msg_id}")
        return {
            "status": "sent",
            "message": f"ส่งรายงานสรุปผ่าน Resend HTTPS ไปยัง {target_recipient} สำเร็จ (ID: {msg_id})",
            "recipient": target_recipient,
            "summary": stats,
        }

    # 2. SMTP Protocol (Ports 587/465/25)
    if config and config.host:
        from_email = config.from_email or "helmet-system@university.ac.th"
        msg = build_daily_digest_message(
            stats=stats,
            snapshot_paths=snapshot_paths,
            from_email=from_email,
            to_email=target_recipient,
            csv_content=csv_content,
        )
        try:
            smtp_cls = smtplib.SMTP_SSL if config.port == 465 else smtplib.SMTP
            with smtp_cls(config.host, config.port, timeout=10) as server:
                if config.port != 465:
                    server.starttls()
                if config.user and config.password:
                    server.login(config.user, config.password)
                server.send_message(msg)

            logger.info(f"Successfully sent daily digest via SMTP to {target_recipient}")
            return {
                "status": "sent",
                "message": f"ส่งรายงานสรุปประจำวันไปยัง {target_recipient} เรียบร้อยแล้ว",
                "recipient": target_recipient,
                "summary": stats,
            }
        except Exception as e:
            logger.exception(f"Failed to send email via SMTP {config.host}:{config.port}: {e}")
            raise RuntimeError(f"SMTP send failed: {e}") from e

    # 3. Dry-run fallback
    logger.info(
        f"Neither Resend API key nor SMTP host configured. Dry-run daily digest created for {target_recipient}."
    )
    return {
        "status": "dry_run",
        "message": f"จำลองการส่งรายงานสำเร็จ (ยังไม่ได้ตั้งค่า API Key หรือ SMTP Host) ข้อมูลส่งไปยัง {target_recipient}",
        "recipient": target_recipient,
        "summary": stats,
    }
