import os
import shutil
from ultralytics import YOLO

def main():
    print("====================================")
    print("🚀 AeroGuard AI Production Trainer (YOLOv11)")
    print("====================================\n")

    data_yaml_path = "Plant-disease-1/data.yaml"
    
    if not os.path.exists(data_yaml_path):
        print(f"Error: {data_yaml_path} not found. Please ensure the path is correct.")
        return

    # Initialize YOLO11n
    print("[1] Initializing YOLO11n architecture...")
    model = YOLO('yolo11n.pt') 

    # Run the training
    print("[2] Starting Production Training (100 Epochs, Patience 15, Batch 16)...")
    results = model.train(
        data=os.path.abspath(data_yaml_path),
        epochs=100,
        patience=15,
        imgsz=640,
        batch=16,
        plots=False,
        name="production_run" # Save to runs/detect/production_run
    )

    # Export to ONNX
    print("\n[3] Exporting trained model to ONNX format...")
    exported_path = model.export(format='onnx')
    
    if exported_path and os.path.exists(exported_path):
        # Move it to the root AeroGuardEngine directory
        target_path = os.path.join(os.getcwd(), "best.onnx")
        if os.path.exists(target_path):
            os.remove(target_path)
            
        shutil.move(exported_path, target_path)
        print(f"\n✅ SUCCESS! Production ONNX exported and moved to: {target_path}")
        print("Ready for C++ engine!")
    else:
        print("\n❌ Failed to export ONNX file.")

if __name__ == "__main__":
    main()
