"""Unit tests for CameraHub video-source handling."""

from pathlib import Path
from unittest.mock import patch

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


def test_frame_cleanup_disabled_when_days_zero_or_negative(tmp_path):
    from app.services.frame_storage import FrameStorage

    storage = FrameStorage(base_dir=tmp_path)
    test_file = tmp_path / "test.jpg"
    test_file.write_text("dummy")

    assert storage.cleanup_old_frames(days=0) == 0
    assert test_file.exists()
    assert storage.cleanup_old_frames(days=-1) == 0
    assert test_file.exists()


class TestCameraHubSubscriptionLifecycle:
    """Test subscription tracking and idle stopping logic."""

    def test_idle_when_all_unsubscribed(self):
        hub = CameraHub()
        with patch.object(hub, "_ensure_running"):
            q_frame = hub.subscribe_frames()
            q_det = hub.subscribe_detections()
            assert len(hub._frame_subs) == 1
            assert len(hub._detect_subs) == 1
            assert not hub._stop_event.is_set()

            hub.unsubscribe_frames(q_frame)
            assert len(hub._frame_subs) == 0
            assert not hub._stop_event.is_set()  # still has detect_subs

            hub.unsubscribe_detections(q_det)
            assert len(hub._detect_subs) == 0
            assert hub._stop_event.is_set()  # idle now!

    def test_process_frame_does_not_persist_when_no_subscribers(self):
        from unittest.mock import MagicMock
        hub = CameraHub()
        mock_service = MagicMock()
        mock_rec = MagicMock()
        mock_service.detect_and_track.return_value = (None, [mock_rec])

        with patch.object(hub._executor, "submit") as mock_submit:
            hub._process_frame(object(), mock_service, jpeg_quality=80)
            mock_submit.assert_not_called()

    def test_ensure_running_clears_stop_event_if_alive(self):
        from unittest.mock import MagicMock
        hub = CameraHub()
        mock_thread = MagicMock()
        mock_thread.is_alive.return_value = True
        hub._thread = mock_thread
        hub._stop_event.set()

        hub._ensure_running()
        assert not hub._stop_event.is_set()


