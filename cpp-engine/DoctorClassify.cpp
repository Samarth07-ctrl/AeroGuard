#include "DoctorClassify.hpp"
#include <iostream>

DoctorClassify::DoctorClassify(const std::string& modelPath) 
    : env(ORT_LOGGING_LEVEL_WARNING, "DoctorClassify") {
    // MOCK ONNX initialization
    // session = std::make_unique<Ort::Session>(env, modelPath.c_str(), sessionOptions);
    std::cout << "[Doctor] EfficientNet Model loaded (Mock) from " << modelPath << std::endl;
}

ClassificationResult DoctorClassify::classifyCrop(const cv::Mat& original_image, const BBox& bbox) {
    // Crop the specific bounding box region from the full 4K image
    cv::Rect crop_region(bbox.x, bbox.y, bbox.w, bbox.h);
    
    // Ensure boundaries are safely within the image dimensions
    crop_region &= cv::Rect(0, 0, original_image.cols, original_image.rows);
    
    cv::Mat crop = original_image(crop_region);
    
    // Resize the crop to the required CNN input resolution (e.g., 224x224 for EfficientNet)
    cv::Mat resized_crop;
    if (!crop.empty()) {
        cv::resize(crop, resized_crop, cv::Size(224, 224));
    }

    // ----------------------------------------------------
    // MOCK INFERENCE ONNX
    // ----------------------------------------------------
    // In reality: 
    // 1. Process resized_crop into NCHW float tensor.
    // 2. Perform Session Onnx inference.
    // 3. Get argmax and confidence level from softmax scores.

    std::cout << "[Doctor] Cropped and resized region at (" << bbox.x << ", " << bbox.y << ")" << std::endl;
    
    ClassificationResult result;
    // Mock logic based on coordinates to simulate finding different diseases
    if (bbox.x > 1500) {
        result.disease_name = "Yellow Rust";
        result.confidence = 0.95f;
    } else {
        result.disease_name = "Healthy";
        result.confidence = 0.89f;
    }

    std::cout << "[Doctor] Classification Output: " << result.disease_name << " (" << result.confidence * 100 << "%)" << std::endl;
    return result;
}
