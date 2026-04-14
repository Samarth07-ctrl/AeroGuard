#include "ScoutDet.hpp"
#include <iostream>
#include <algorithm>

ScoutDet::ScoutDet(const std::string& modelPath) 
    : env(ORT_LOGGING_LEVEL_WARNING, "ScoutDet") {
    // Note: MOCK ONNX initialization
    // Uncomment when actual ONNX model is present
    // session = std::make_unique<Ort::Session>(env, modelPath.c_str(), sessionOptions);
    std::cout << "[Scout] YOLOv11 Model loaded (Mock) from " << modelPath << std::endl;
}

std::vector<BBox> ScoutDet::runInference(const cv::Mat& image) {
    std::vector<BBox> all_detections;
    
    // SAHI parameters for slicing
    int tile_size = 640;
    int overlap = 128; 
    int step = tile_size - overlap;

    std::cout << "[Scout] Slicing 4K image (" << image.cols << "x" << image.rows << ") into " << tile_size << "x" << tile_size << " tiles..." << std::endl;

    for (int y = 0; y < image.rows; y += step) {
        for (int x = 0; x < image.cols; x += step) {
            // Calculate tile boundaries ensuring we don't exceed image dimensions
            int x1 = x;
            int y1 = y;
            int x2 = std::min(x + tile_size, image.cols);
            int y2 = std::min(y + tile_size, image.rows);

            // Extract the SAHI tile
            cv::Rect tile_rect(x1, y1, x2 - x1, y2 - y1);
            cv::Mat tile = image(tile_rect);

            // ----------------------------------------------------
            // MOCK INFERENCE ONNX
            // ----------------------------------------------------
            // In reality: 
            // 1. Convert cv::Mat to Ort::Value tensor (NCHW format, normalized).
            // 2. Run session->Run().
            // 3. Apply NMS (Non-Maximum Suppression) per tile.
            
            // Mocking detections in specific locations
            if (x1 == step * 2 && y1 == step * 2) {
                BBox det;
                det.x = x1 + 100; // Map back to absolute original coordinates
                det.y = y1 + 150; 
                det.w = 40;
                det.h = 50;
                det.confidence = 0.94f;
                all_detections.push_back(det);
            }
            if (x1 == step * 5 && y1 == step * 3) {
                BBox det;
                det.x = x1 + 200;
                det.y = y1 + 50;
                det.w = 60;
                det.h = 60;
                det.confidence = 0.88f;
                all_detections.push_back(det);
            }
        }
    }
    
    // Output number of detections post-slicing
    std::cout << "[Scout] Found " << all_detections.size() << " potential anomalies across all tiles." << std::endl;
    return all_detections;
}
