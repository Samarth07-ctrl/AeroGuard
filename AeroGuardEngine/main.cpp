#include <iostream>
#include <filesystem>
#include <algorithm>
#include <cstdlib>
#include <opencv2/opencv.hpp>
#include <opencv2/dnn.hpp>
#include <nlohmann/json.hpp>
#include <exiv2/exiv2.hpp>
#include "Slicer.h"
#include "GSDCalculator.h"
#include "WebhookClient.h"

namespace fs = std::filesystem;

// ── Disease class names from Roboflow training (must match data.yaml order) ──
const std::vector<std::string> CLASS_NAMES = {
    "Black_knot", "Chlorosis", "Dog_vomit_slime_mold", "Elderberry_rust",
    "Golden_canker", "Gymnosporangium_Rusts", "Powdery_Mildew",
    "Sooty_Mold", "Tar_Spot", "Peach_leaf_curl"
};

// ── Pesticide lookup table (matched to each disease) ──
const std::vector<std::string> PESTICIDE_MAP = {
    "Captan Fungicide",          // Black_knot
    "Iron Chelate Supplement",   // Chlorosis
    "Potassium Bicarbonate",     // Dog_vomit_slime_mold
    "Mancozeb Spray",            // Elderberry_rust
    "Copper Hydroxide",          // Golden_canker
    "Myclobutanil Fungicide",    // Gymnosporangium_Rusts
    "Sulfur Dust Treatment",     // Powdery_Mildew
    "Neem Oil Application",      // Sooty_Mold
    "Propiconazole Spray",       // Tar_Spot
    "Chlorothalonil Fungicide"   // Peach_leaf_curl
};

// ── EXIF GPS parser ──
double parseExifGPS(const Exiv2::ExifData& exifData, const std::string& key) {
    Exiv2::ExifData::const_iterator it = exifData.findKey(Exiv2::ExifKey(key));
    if (it != exifData.end() && it->count() == 3) {
        return it->toFloat(0) + (it->toFloat(1) / 60.0) + (it->toFloat(2) / 3600.0);
    }
    return 0.0;
}

// ── YOLO Post-Processing with NMS ──
struct Detection {
    int classId;
    float confidence;
    cv::Rect box;
};

std::vector<Detection> postProcessYOLO(cv::Mat& output, int imgWidth, int imgHeight, float confThreshold = 0.25f, float nmsThreshold = 0.45f) {
    std::vector<Detection> detections;
    std::vector<int> classIds;
    std::vector<float> confidences;
    std::vector<cv::Rect> boxes;

    // YOLOv8 output shape: [1, numClasses+4, numDetections]
    // Transpose to [numDetections, numClasses+4]
    int rows = output.size[2];
    int dimensions = output.size[1];

    cv::Mat data = output.reshape(1, dimensions).t(); // Transpose

    for (int i = 0; i < rows; i++) {
        float* row = data.ptr<float>(i);
        // First 4 values: cx, cy, w, h
        float cx = row[0];
        float cy = row[1];
        float w  = row[2];
        float h  = row[3];

        // Remaining values: class scores
        float maxScore = 0;
        int maxClassId = 0;
        for (int j = 4; j < dimensions; j++) {
            if (row[j] > maxScore) {
                maxScore = row[j];
                maxClassId = j - 4;
            }
        }

        if (maxScore >= confThreshold) {
            // Scale bounding box back to original image dimensions
            int left   = static_cast<int>((cx - w / 2.0f) * imgWidth / 640.0f);
            int top    = static_cast<int>((cy - h / 2.0f) * imgHeight / 640.0f);
            int width  = static_cast<int>(w * imgWidth / 640.0f);
            int height = static_cast<int>(h * imgHeight / 640.0f);

            classIds.push_back(maxClassId);
            confidences.push_back(maxScore);
            boxes.push_back(cv::Rect(left, top, width, height));
        }
    }

    // Apply Non-Maximum Suppression
    std::vector<int> indices;
    cv::dnn::NMSBoxes(boxes, confidences, confThreshold, nmsThreshold, indices);

    for (int idx : indices) {
        detections.push_back({ classIds[idx], confidences[idx], boxes[idx] });
    }

    return detections;
}

int main(int argc, char* argv[]) {
    std::cout << "=============================================\n";
    std::cout << " AeroGuard AI Engine v2.0 - YOLO + GSD + CPR \n";
    std::cout << "=============================================\n\n";

    if (argc < 3) {
        std::cerr << "Usage: AeroGuardEngine.exe <image_path> <session_id>\n";
        return 1;
    }

    // ── CONFIG ──
    std::string modelPath   = (fs::current_path() / "best.onnx").string();
    std::string webhookUrl  = "http://localhost:5000/api/alerts";
    std::string farmerId    = "FARMER-884A";
    std::string imagePath = argv[1];
    std::string sessionId = argv[2];

    // ── 1. Load YOLO ONNX Model ──
    std::cout << "[1] Loading YOLO ONNX Model...\n";
    std::cout << "    Model path: " << modelPath << "\n";
    std::cout << "    Session ID: " << sessionId << "\n";
    cv::dnn::Net net;
    try {
        net = cv::dnn::readNetFromONNX(modelPath);
        net.setPreferableBackend(cv::dnn::DNN_BACKEND_OPENCV);
        net.setPreferableTarget(cv::dnn::DNN_TARGET_CPU);
        std::cout << "    Model loaded successfully! (" << CLASS_NAMES.size() << " disease classes)\n\n";
    } catch (cv::Exception& e) {
        std::cerr << "    FATAL: Failed to load model: " << e.what() << "\n";
        return 1;
    }

    // ── 2. Validate single input image path ──
    std::cout << "[2] Using single input image...\n";
    std::cout << "    Image path: " << imagePath << "\n\n";
    if (!fs::exists(imagePath)) {
        std::cerr << "    Input image not found: " << imagePath << "\n";
        return 1;
    }

    // ── 3. Initialize components ──
    Slicer slicer;
    GSDCalculator gsdCalc;
    WebhookClient webhook(webhookUrl);
    int totalDetections = 0;

    // ── 4. Process only the requested image ──
    std::cout << "── Processing single image: " << fs::path(imagePath).filename().string() << "\n";

    // Load image
    cv::Mat image = cv::imread(imagePath, cv::IMREAD_COLOR);
    if (image.empty()) {
        std::cerr << "    [FAIL] Unable to load image.\n";
        return 1;
    }

        // ── Read EXIF GPS ──
        double baseLat = 18.5204;  // Pune fallback
        double baseLong = 73.8567;
        try {
            auto exifImg = Exiv2::ImageFactory::open(imagePath);
            exifImg->readMetadata();
            Exiv2::ExifData& exifData = exifImg->exifData();
            if (!exifData.empty()) {
                double lat = parseExifGPS(exifData, "Exif.GPSInfo.GPSLatitude");
                double lon = parseExifGPS(exifData, "Exif.GPSInfo.GPSLongitude");
                if (lat != 0.0 && lon != 0.0) {
                    baseLat = lat;
                    baseLong = lon;
                    std::cout << "    [EXIF] Real GPS: " << baseLat << ", " << baseLong << "\n";
                }
            }
        } catch (...) {
            // Silently use fallback
        }

        // ── SAHI Slice ──
        auto slices = slicer.getSlices(image, 640, 640, 0.2);
        if (slices.empty()) {
            // If image is smaller than 640x640, treat the whole image as one slice
            slices.push_back(cv::Rect(0, 0, image.cols, image.rows));
        }

        // ── Run inference on each slice ──
        for (size_t s = 0; s < slices.size(); s++) {
            cv::Rect roi = slices[s];
            // Clamp ROI to image boundaries
            roi &= cv::Rect(0, 0, image.cols, image.rows);
            if (roi.width <= 0 || roi.height <= 0) continue;

            cv::Mat slice = image(roi);

            // Prepare blob for YOLO (640x640 normalized)
            cv::Mat blob;
            cv::dnn::blobFromImage(slice, blob, 1.0 / 255.0, cv::Size(640, 640),
                                   cv::Scalar(0, 0, 0), true, false);
            net.setInput(blob);

            // Forward pass
            cv::Mat output = net.forward();

            // Post-process detections
            auto detections = postProcessYOLO(output, roi.width, roi.height, 0.25f, 0.45f);

            for (const auto& det : detections) {
                totalDetections++;

                // Calculate center of bounding box in full-image pixel space
                int globalCx = roi.x + det.box.x + det.box.width / 2;
                int globalCy = roi.y + det.box.y + det.box.height / 2;

                // Pixel offset from image center
                int offsetX = globalCx - image.cols / 2;
                int offsetY = globalCy - image.rows / 2;

                // GSD projection (5cm per pixel assumed for drone at 30m altitude)
                auto [hitLat, hitLong] = gsdCalc.calculateLatLong(baseLat, baseLong, offsetX, offsetY, 0.05);

                // Determine severity from confidence
                std::string severity = "Low";
                if (det.confidence >= 0.8f) severity = "Severe";
                else if (det.confidence >= 0.6f) severity = "High";
                else if (det.confidence >= 0.4f) severity = "Medium";

                // Get disease name and pesticide recommendation
                std::string diseaseName = (det.classId < (int)CLASS_NAMES.size()) ? CLASS_NAMES[det.classId] : "Unknown";
                std::string pesticide = (det.classId < (int)PESTICIDE_MAP.size()) ? PESTICIDE_MAP[det.classId] : "Consult Agronomist";

                std::cout << "    >> DETECTION: " << diseaseName
                          << " | Conf: " << (det.confidence * 100.0f) << "%"
                          << " | GPS: " << hitLat << ", " << hitLong
                          << " | Severity: " << severity << "\n";

                // Fire webhook to Node.js Command Center
                bool sent = webhook.sendAlert(sessionId, farmerId, diseaseName, hitLat, hitLong, severity, pesticide);
                if (!sent) {
                    std::cerr << "    [!] Webhook delivery failed for this detection.\n";
                }
            }
        }
    std::cout << "\n";

    std::cout << "=============================================\n";
    std::cout << " PIPELINE COMPLETE: " << totalDetections << " total disease detections dispatched.\n";
    std::cout << "=============================================\n";

    return 0;
}
