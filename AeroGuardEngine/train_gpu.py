import os

import torch
from ultralytics import YOLO


def main():
    data_yaml = "Plant-disease-1/data.yaml"
    if not os.path.exists(data_yaml):
        raise FileNotFoundError(f"Dataset config not found: {os.path.abspath(data_yaml)}")

    print("Starting GPU training pipeline...")
    print(f"PyTorch: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"CUDA version: {torch.version.cuda}")
        print(f"GPU: {torch.cuda.get_device_name(0)}")
    else:
        raise RuntimeError("CUDA is not available. Cannot continue GPU-only run.")

    model = YOLO("yolo11n.pt")
    model.train(
        data=os.path.abspath(data_yaml),
        epochs=50,
        patience=15,
        imgsz=640,
        batch=16,
        device=0,
        name="gpu_run_50ep",
        plots=True,
    )


if __name__ == "__main__":
    main()
