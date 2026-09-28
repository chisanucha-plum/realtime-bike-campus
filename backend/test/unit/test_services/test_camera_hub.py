"""Unit tests for CameraHub video-source handling."""

from pathlib import Path
from unittest.mock import Mock, patch

import cv2

from app.configuration import ApplicationSettingsConfig
from app.services.camera_hub import CameraHub, _is_stream_url


def make_settings(**overrides) -> ApplicationSettingsConfig:
    """Build application settings with test defaults."""
    values = dict(video_path="src/case/case_03.mp4", use_webcam=False, webcam_id=0)
    values.update(overrides)
    return ApplicationSettingsConfig(**values)



class TestIsStreamUrl:
    """Test network-stream URL classification."""

    def test_rtsp_url_is_stream(self):
        assert _is_stream_url("rtsp://user:pass@host:554/stream2") is True

    def test_rtsps_http_https_are_streams(self):
        assert _is_stream_url("rtsps://host/s") is True
        assert _is_stream_url("http://host/live") is True
        assert _is_stream_url("https://host/live") is True

    def test_file_paths_not_streams(self):
        assert _is_stream_url("src/case/case_03.mp4") is False
        assert _is_stream_url("C:/videos/cam.mp4") is False

    def test_scheme_case_insensitive(self):
        assert _is_stream_url("RTSP://host/s") is True


class TestOpenCapture:
    """Lock how each source type reaches cv2.VideoCapture."""

    def test_stream_url_passed_unmodified(self):
        hub = CameraHub()
        url = "rtsp://user:pass@host:554/stream2"
        settings = make_settings(video_path=url)

        with patch("app.services.camera_hub.cv2.VideoCapture") as mock_ctor:
            hub._open_capture(settings)

        mock_ctor.assert_called_once_with(url, cv2.CAP_FFMPEG)

    def test_file_path_normalized_via_pathlib(self):
        hub = CameraHub()
        path_str = "src/case/case_03.mp4"
        settings = make_settings(video_path=path_str)

        with patch("app.services.camera_hub.cv2.VideoCapture") as mock_ctor:
            hub._open_capture(settings)

        expected = str(Path(path_str))
        mock_ctor.assert_called_once_with(expected)

    def test_webcam_uses_directshow_backend(self):
        hub = CameraHub()
        settings = make_settings(use_webcam=True, webcam_id=0)

        with patch("app.services.camera_hub.cv2.VideoCapture") as mock_ctor:
            hub._open_capture(settings)

        mock_ctor.assert_called_once_with(0, cv2.CAP_DSHOW)


class TestPopLatestFrame:
    """Latest-frame slot hands each frame out once."""

    def test_empty_slot_returns_none(self):
        assert CameraHub()._pop_latest_frame() is None

    def test_frame_handed_out_exactly_once(self):
        hub = CameraHub()
        frame = object()
        hub._latest_frame = frame

        assert hub._pop_latest_frame() is frame
        assert hub._pop_latest_frame() is None
