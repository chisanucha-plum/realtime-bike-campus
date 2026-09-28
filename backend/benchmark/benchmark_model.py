#!/usr/bin/env python3
"""Quick benchmark for best_26m (PyTorch + OpenVINO)."""

import time
import sys

sys.path.insert(0, ".")
from ultralytics import YOLO

MODEL_PT = "train/best_26m.pt"
DATA = "config/data.yaml"


def benchmark_acc():
    print("=== Accuracy (test split) ===")
    m = YOLO(MODEL_PT)
    metrics = m.val(data=DATA, split="test", imgsz=640, batch=1, verbose=False)
    print(f"mAP@50: {metrics.box.map:.4f}")
    print(f"mAP@50:95: {metrics.box.map75:.4f}")


def benchmark_speed():
    print("\n=== Speed (batch=1, 640x640, GPU if available) ===")
    m = YOLO(MODEL_PT)
    # warm-up
    for _ in range(5):
        m("data/test/images/sample.jpg", verbose=False)
    times = []
    for _ in range(20):
        t0 = time.perf_counter()
        m("data/test/images/sample.jpg", verbose=False)
        times.append(time.perf_counter() - t0)
    avg = sum(times) / len(times) * 1000
    print(f"Latency: {avg:.1f} ms | FPS: {1000 / avg:.1f}")


if __name__ == "__main__":
    benchmark_acc()
    benchmark_speed()
