import os
import sys
import subprocess

# Auto-install dependencies if missing
try:
    from roboflow import Roboflow
    from ultralytics import YOLO
except ImportError:
    print("Installing required dependencies (Roboflow, Ultralytics)...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "roboflow", "ultralytics"])
    from roboflow import Roboflow
    from ultralytics import YOLO

def main():
    print("====================================")
    print("🚀 AeroGuard AI Trainer pipeline")
    print("====================================\n")

    # 1. Download Dataset from Roboflow
    print("[1] Downing YOLOv8 Annotated Dataset from Roboflow...")
    rf = Roboflow(api_key="pD6KFjJYptGqdt2gYnHN")
    project = rf.workspace("capstone-u7skk").project("plant-disease-6ex9f")
    version = project.version(1)
    dataset = version.download("yolov8")
    
    print(f"\n[+] Dataset downloaded successfully to: {dataset.location}\n")

    # 2. Train YOLO model
    print("[2] Initializing YOLOv8n architecture and starting PyTorch Training...")
    print("    Note: Training for 3 epochs to generate a rapid prototype deployment weight.")
    model = YOLO('yolov8n.pt') # Load pre-trained nano model for speed
    
    # Run the training
    data_yaml_path = os.path.join(dataset.location, "data.yaml")
    results = model.train(data=data_yaml_path, epochs=3, imgsz=640, plots=False)

    # 3. Export to ONNX (Open Neural Network Exchange)
    # This is crucial so our C++ OpenCV dnn::readNetFromONNX can ingest it
    print("\n[3] Exporting trained model to ONNX format...")
    exported_path = model.export(format='onnx')
    
    print(f"\n✅ SUCCESS! YOLO Model trained and exported to: {exported_path}")
    print("The .onnx file is ready to be linked into AeroGuard C++ Engine.")

if __name__ == "__main__":
    main()
