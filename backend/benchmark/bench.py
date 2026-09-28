"""
OpenVINO Inference Benchmark
==============================
วัดความเร็ว inference (FPS / latency) ของโมเดล YOLO ที่ export เป็น OpenVINO IR
บน Intel hardware (เช่น Intel IrisXe iGPU) ตาม methodology ที่ระบุใน Section III.E:
    - resolution 640x640, batch size 1
    - warm-up 10 iterations
    - เฉลี่ยจาก 200 runs

วิธีใช้:
    1. Export โมเดลเป็น OpenVINO IR ก่อน (ตัวอย่างใช้ Ultralytics):
         from ultralytics import YOLO
         model = YOLO("best.pt")
         model.export(format="openvino", imgsz=640)                 # FP32
         model.export(format="openvino", half=True, imgsz=640)      # FP16
         model.export(format="openvino", int8=True, data="data.yaml", imgsz=640)  # INT8 (PTQ)

    2. รันสคริปต์นี้กับแต่ละ IR model:
         python benchmark_openvino.py --model yolo26m_openvino_model/yolo26m.xml \
             --precision INT8 --device GPU

       --device เลือกได้: CPU, GPU (สำหรับ Intel iGPU เช่น IrisXe), AUTO

Requirements:
    pip install openvino numpy --break-system-packages
    (รันบนเครื่องที่มี Intel CPU/iGPU จริง พร้อม OpenVINO runtime ติดตั้งแล้ว)
"""

import argparse
import time
import json
import numpy as np

try:
    import openvino as ov
except ImportError as e:
    raise SystemExit(
        "ต้องติดตั้ง openvino ก่อนรันสคริปต์นี้ "
        "(pip install openvino --break-system-packages)\n"
        f"ImportError: {e}"
    )


def build_dummy_input(input_shape):
    """สร้าง dummy tensor ขนาด (1,3,640,640) แบบสุ่ม, dtype float32."""
    shape = [1 if d == -1 else d for d in input_shape]
    return np.random.rand(*shape).astype(np.float32)


def run_benchmark(model_path: str, device: str, warmup: int, n_runs: int):
    core = ov.Core()
    print(f"[OpenVINO] Available devices: {core.available_devices}")

    model = core.read_model(model_path)
    compiled_model = core.compile_model(model, device_name=device)

    input_layer = compiled_model.input(0)
    input_shape = list(input_layer.shape)
    print(
        f"[OpenVINO] Model: {model_path}  |  Device: {device}  |  Input shape: {input_shape}"
    )

    infer_request = compiled_model.create_infer_request()
    latencies_ms = []

    for i in range(warmup + n_runs):
        dummy_input = build_dummy_input(input_shape)

        start = time.perf_counter()
        infer_request.infer({input_layer.any_name: dummy_input})
        end = time.perf_counter()

        if i >= warmup:
            latencies_ms.append((end - start) * 1000.0)

    return latencies_ms


def summarize(latencies_ms, precision: str, model_path: str, device: str):
    arr = np.array(latencies_ms)
    mean_ms = float(arr.mean())
    p50 = float(np.percentile(arr, 50))
    p95 = float(np.percentile(arr, 95))
    fps = 1000.0 / mean_ms

    return {
        "model": model_path,
        "precision": precision,
        "device": device,
        "n_runs": len(latencies_ms),
        "mean_latency_ms": round(mean_ms, 2),
        "p50_latency_ms": round(p50, 2),
        "p95_latency_ms": round(p95, 2),
        "fps": round(fps, 1),
    }


def main():
    parser = argparse.ArgumentParser(
        description="OpenVINO inference benchmark (640x640, batch=1)"
    )
    parser.add_argument("--model", required=True, help="Path to OpenVINO .xml IR file")
    parser.add_argument("--precision", default="INT8", choices=["FP32", "FP16", "INT8"])
    parser.add_argument(
        "--device", default="GPU", help="CPU, GPU (Intel iGPU e.g. IrisXe), or AUTO"
    )
    parser.add_argument(
        "--warmup", type=int, default=10, help="Warm-up iterations (paper: 10)"
    )
    parser.add_argument(
        "--runs", type=int, default=200, help="Timed runs to average (paper: 200)"
    )
    parser.add_argument("--output", default="openvino_benchmark_result.json")
    args = parser.parse_args()

    latencies_ms = run_benchmark(args.model, args.device, args.warmup, args.runs)
    result = summarize(latencies_ms, args.precision, args.model, args.device)

    print("\n=== Result ===")
    print(json.dumps(result, indent=2))

    with open(args.output, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nSaved to {args.output}")


if __name__ == "__main__":
    main()
