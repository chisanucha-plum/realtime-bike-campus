import json
import logging
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

logger = logging.getLogger(__name__)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name, "").strip().lower()
    if raw in ("true", "1", "yes"):
        return True
    if raw in ("false", "0", "no"):
        return False
    return default


def _parse_int(value: Any, default: int) -> int:
    try:
        return int(value) if value is not None and value != "" else default
    except (ValueError, TypeError):
        return default


@dataclass
class DetectionConfig:
    """Per-stage thresholds and scale-invariant ROI geometry for detection."""

    # Motorcycle tracking (stage 1)
    bike_id: int
    bike_confidence: float
    tracker: str
    bike_imgsz: int

    # Helmet classification (stage 2)
    helmet_confidence: float
    helmet_imgsz: int
    helmet_on: str
    helmet_off: str

    # Shared geometry / rendering
    line_position_percent: float
    roi_side_pad: float
    roi_top_pad: float
    roi_bottom_pad: float
    line_overlay_alpha: float
    eval_window_frames: int = 5
    early_exit_conf: float = 0.70

    @staticmethod
    def from_dict(data: dict) -> "DetectionConfig":
        return DetectionConfig(
            bike_id=data.get("bike_id", 3),
            bike_confidence=data.get("bike_confidence"),
            tracker=data.get("tracker", "bytetrack.yaml"),
            bike_imgsz=data.get("bike_imgsz"),
            helmet_confidence=data.get("helmet_confidence"),
            helmet_imgsz=data.get("helmet_imgsz"),
            helmet_on=data.get("helmet_on", "helmet on"),
            helmet_off=data.get("helmet_off", "helmet off"),
            line_position_percent=data.get("line_position_percent"),
            roi_side_pad=data.get("roi_side_pad"),
            roi_top_pad=data.get("roi_top_pad"),
            roi_bottom_pad=data.get("roi_bottom_pad"),
            line_overlay_alpha=data.get("line_overlay_alpha"),
            eval_window_frames=data.get("eval_window_frames", 5),
            early_exit_conf=data.get("early_exit_conf", 0.70),
        )


@dataclass
class ModelSettingsConfig:
    bike_model: str
    helmet_model: str
    jpeg_quality: int

    @staticmethod
    def from_dict(data: dict) -> "ModelSettingsConfig":
        return ModelSettingsConfig(
            bike_model=data.get("bike_model", "yolov8n"),
            helmet_model=data["helmet_model"],
            jpeg_quality=data.get("jpeg_quality"),
        )


@dataclass
class ApplicationSettingsConfig:
    video_path: str
    use_webcam: bool
    webcam_id: int
    rtsp_transport: str = "tcp"
    rtsp_buffer_size: int = 1024
    reconnect_delay_seconds: float = 2.0
    open_timeout_ms: int = 10000
    read_timeout_ms: int = 10000

    @staticmethod
    def from_dict(data: dict) -> "ApplicationSettingsConfig":
        rtsp_override = os.environ.get("RTSP_VIDEO_PATH", "").strip()
        use_webcam = _env_bool("USE_WEBCAM", bool(data["use_webcam"]))

        return ApplicationSettingsConfig(
            video_path=rtsp_override or data["video_path"],
            use_webcam=False if rtsp_override else use_webcam,
            webcam_id=data.get("webcam_id", 0),
            rtsp_transport=str(data.get("rtsp_transport", "tcp")),
            rtsp_buffer_size=int(data.get("rtsp_buffer_size", 1024)),
            reconnect_delay_seconds=float(data.get("reconnect_delay_seconds", 2.0)),
            open_timeout_ms=int(data.get("open_timeout_ms", 10000)),
            read_timeout_ms=int(data.get("read_timeout_ms", 10000)),
        )


@dataclass
class PostgresConfig:
    database_url: str | None
    host: str
    port: int
    user: str
    password: str
    database: str

    @staticmethod
    def from_env() -> "PostgresConfig":
        database_url = os.environ.get("DATABASE_URL") or os.environ.get(
            "SUPABASE_DB_URL"
        )
        port_raw = os.environ.get("DATABASE_PORT", os.environ.get("port", "5432"))

        return PostgresConfig(
            database_url=database_url,
            host=os.environ.get("DATABASE_HOST", os.environ.get("host", "localhost")),
            port=_parse_int(port_raw, 5432),
            user=os.environ.get("DATABASE_USER", os.environ.get("user", "postgres")),
            password=os.environ.get(
                "DATABASE_PASSWORD", os.environ.get("password", "")
            ),
            database=os.environ.get(
                "DATABASE_NAME", os.environ.get("dbname", "postgres")
            ),
        )


@dataclass
class ServerConfig:
    cors_allowed_origins: list[str]
    frame_retention_days: int
    cleanup_interval_hours: int

    @staticmethod
    def from_env() -> "ServerConfig":
        return ServerConfig(
            cors_allowed_origins=os.environ.get(
                "ALLOWED_ORIGINS",
                "http://localhost:3000,"
                "http://localhost:3001,"
                "http://localhost:8000,"
                "http://127.0.0.1:3000,"
                "http://127.0.0.1:3001",
            ).split(","),
            frame_retention_days=int(os.environ.get("FRAME_RETENTION_DAYS", "7")),
            cleanup_interval_hours=int(os.environ.get("CLEANUP_INTERVAL_HOURS", "24")),
        )


@dataclass
class RefreshTokenCookie:
    cookie_name: str
    legacy_cookie_name: str
    httponly: bool
    secure: bool
    max_age: int
    path: str
    domain: str | None
    samesite: Literal["lax", "strict", "none"] = "lax"

    @staticmethod
    def from_dict(obj: Any) -> "RefreshTokenCookie":
        samesite_value = obj.get("samesite", "lax")
        if samesite_value not in ("lax", "strict", "none"):
            samesite_value = "lax"

        return RefreshTokenCookie(
            cookie_name=str(obj.get("cookie_name", "")),
            legacy_cookie_name=str(obj.get("legacy_cookie_name", "")),
            httponly=bool(obj.get("httponly", False)),
            secure=bool(obj.get("secure", False)),
            samesite=samesite_value,
            max_age=_parse_int(obj.get("max_age"), 2592000),
            path=str(obj.get("path", "/")),
            domain=obj.get("domain"),
        )


@dataclass
class Key:
    secret_key: str
    algorithm: str = "HS256"
    access_token_minutes: int = 30

    @staticmethod
    def from_dict(obj: Any) -> "Key":
        secret_key = os.environ.get("SECRET_KEY") or str(obj.get("secret_key", ""))
        algorithm = os.environ.get("ALGORITHM") or str(obj.get("algorithm", "HS256"))
        access_token_minutes = int(
            os.environ.get("ACCESS_TOKEN_MINUTES") or obj.get("access_token_minutes", 30)
        )
        return Key(
            secret_key=secret_key,
            algorithm=algorithm,
            access_token_minutes=access_token_minutes,
        )


@dataclass
class SmtpConfig:
    host: str
    port: int
    user: str
    password: str
    from_email: str
    security_chief_email: str
    digest_enabled: bool
    digest_time: str
    api_key: str = ""

    @staticmethod
    def from_dict(data: dict) -> "SmtpConfig":
        port_raw = os.environ.get("SMTP_PORT") or data.get("port", 587)
        digest_enabled = _env_bool(
            "DIGEST_ENABLED", bool(data.get("digest_enabled", False))
        )
        api_key = os.environ.get("RESEND_API_KEY") or str(data.get("api_key", ""))

        return SmtpConfig(
            host=os.environ.get("SMTP_HOST") or str(data.get("host", "")),
            port=_parse_int(port_raw, 587),
            user=os.environ.get("SMTP_USER") or str(data.get("user", "")),
            password=os.environ.get("SMTP_PASSWORD") or str(data.get("password", "")),
            from_email=os.environ.get("RESEND_FROM")
            or os.environ.get("SMTP_FROM")
            or os.environ.get("SMTP_USER")
            or str(data.get("from_email", "")),
            security_chief_email=os.environ.get("SECURITY_CHIEF_EMAIL")
            or str(data.get("security_chief_email", "")),
            digest_enabled=digest_enabled,
            digest_time=(
                os.environ.get("DIGEST_TIME")
                or str(data.get("digest_time", "18:00"))
            ).strip()[:5],
            api_key=api_key,
        )


@dataclass
class Configuration:
    models: ModelSettingsConfig
    application_settings: ApplicationSettingsConfig
    postgres: PostgresConfig
    server: ServerConfig
    refresh_token_cookie: RefreshTokenCookie
    key: Key
    detection: DetectionConfig
    smtp: SmtpConfig | None = None

    @staticmethod
    def from_dict(data: dict) -> "Configuration":
        return Configuration(
            models=ModelSettingsConfig.from_dict(data["models"]),
            application_settings=ApplicationSettingsConfig.from_dict(
                data["application_settings"]
            ),
            postgres=PostgresConfig.from_env(),
            server=ServerConfig.from_env(),
            refresh_token_cookie=RefreshTokenCookie.from_dict(
                data["refresh_token_cookie"]
            ),
            key=Key.from_dict(data["key"]),
            detection=DetectionConfig.from_dict(data.get("detection", {})),
            smtp=SmtpConfig.from_dict(data.get("smtp") or {}),
        )

    @staticmethod
    @lru_cache
    def get_config() -> "Configuration":
        """Load and cache configuration from ``config.<SITE>.json`` (default: development)."""
        site = os.environ.get("SITE", "development")
        filename = f"config.{site}.json"

        candidate_paths = [
            Path(filename),
            Path(__file__).resolve().parent.parent / filename,
            Path.cwd() / "backend" / filename,
        ]
        config_path = next((p for p in candidate_paths if p.is_file()), Path(filename))

        with open(config_path, encoding="utf-8") as f:
            data = json.load(f)

        config = Configuration.from_dict(data)
        src = config.application_settings
        source_desc = (
            f"webcam id={src.webcam_id}"
            if src.use_webcam
            else f"RTSP: {src.video_path}"
        )
        logger.info(f"Video source: {source_desc}")
        return config
