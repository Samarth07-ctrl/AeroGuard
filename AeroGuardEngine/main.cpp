#include <iostream>
#include <filesystem>
#include <opencv2/opencv.hpp>
#include <nlohmann/json.hpp>
#include <exiv2/exiv2.hpp>
#include "Slicer.h"
#include "GSDCalculator.h"
#include "WebhookClient.h"

namespace fs = std::filesystem;

// Helper to convert Exiv2 GPS Rational to Double
double parseExifGPS(const Exiv2::ExifData& exifData, const std::string& key) {
    Exiv2::ExifData::const_iterator it = exifData.findKey(Exiv2::ExifKey(key));
    if (it != exifData.end() && it->count() == 3) {
        return it->toFloat(0) + (it->toFloat(1) / 60.0) + (it->toFloat(2) / 3600.0);
    }
    return 0.0;
}

int main() {
    std::cout << "==========================================\n";
    std::cout << "🚀 AeroGuard Engine - End-to-End Test Run \n";
    std::cout << "==========================================\n\n";

    std::string datasetPath = "D:\\Projects\\hackathons\\mit_Hacathon\\dataset\\extracted";
    std::string targetImage = "";

    // 1. Find the first image in the dataset
    std::cout << "[1] Scanning dataset folder: " << datasetPath << "\n";
    if (!fs::exists(datasetPath)) {
        std::cerr << "Dataset path doesn't exist yet! Is extraction still running?\n";
        return 1;
    }

    for (const auto& entry : fs::recursive_directory_iterator(datasetPath)) {
        if (entry.path().extension() == ".jpg" || entry.path().extension() == ".png" || entry.path().extension() == ".jpeg") {
            targetImage = entry.path().string();
            break;
        }
    }

    if (targetImage.empty()) {
        std::cerr << "Could not find any images in the dataset folder!\n";
        return 1;
    }

    std::cout << "    Found Image: " << targetImage << "\n\n";

    // 2. Fetch Real EXIF GPS Data using exiv2
    double droneLat = 42.3601; // Fallback (MIT)
    double droneLong = -71.0589; // Fallback (MIT)
    std::cout << "[2] Attempting to read EXIF GPS Data...\n";
    try {
        auto image = Exiv2::ImageFactory::open(targetImage);
        image->readMetadata();
        Exiv2::ExifData& exifData = image->exifData();
        if (exifData.empty()) {
            std::cout << "    ⚠️ No EXIF data found in this Kaggle image. Using Fallback GPS.\n";
        } else {
            double parsedLat = parseExifGPS(exifData, "Exif.GPSInfo.GPSLatitude");
            double parsedLong = parseExifGPS(exifData, "Exif.GPSInfo.GPSLongitude");
            if (parsedLat != 0.0 && parsedLong != 0.0) {
                droneLat = parsedLat;
                droneLong = parsedLong; // Note: You'd technically check GPSLatitudeRef (N/S) and GPSLongitudeRef (E/W) for negative signs in a prod setting
                std::cout << "    🛰️ SUCCESS: Found Real Drone EXIF Coordinates: " << droneLat << ", " << droneLong << "\n";
            } else {
                std::cout << "    ⚠️ EXIF data found, but no GPS tags exist. Using Fallback GPS.\n";
            }
        }
    } catch (Exiv2::Error& e) {
        std::cout << "    ⚠️ Error parsing EXIF: " << e.what() << ". Using Fallback GPS.\n";
    }
    std::cout << "\n";

    // 3. Load the Image using OpenCV
    std::cout << "[3] Loading Image (cv::imread) -> Memory\n";
    cv::Mat farmImage = cv::imread(targetImage, cv::IMREAD_COLOR);
    if (farmImage.empty()) {
        std::cerr << "OpenCV failed to parse the image.\n";
        return 1;
    }
    std::cout << "    Loaded successfully! Dimensions: " << farmImage.cols << "x" << farmImage.rows << "\n\n";

    // 3. Run SAHI Slicer
    std::cout << "[3] Running SAHI Image Slicer...\n";
    Slicer imageSlicer;
    auto slices = imageSlicer.getSlices(farmImage, 640, 640, 0.2); // 640x640 slices with 20% overlap
    std::cout << "    Generated " << slices.size() << " overlapping bounding boxes for AI inference.\n\n";

    // 4. Simulate AI Detection (e.g. YOLO/EfficientNet detects a disease on the middle slice)
    std::cout << "[4] Simulating Inference and Geospatial Projection...\n";
    int detectedIndex = slices.size() / 2; // Arbitrary slice where disease is found
    cv::Rect diseasedRegion = slices[detectedIndex];
    
    GSDCalculator gsdCalc;
    // Assuming 5 cm per pixel GSD
    auto [targetLat, targetLong] = gsdCalc.calculateLatLong(droneLat, droneLong, diseasedRegion.x, diseasedRegion.y, 0.05);

    std::cout << "    ⚠️ DETECTED: 'Leaf Blight' at Pixel Coordinate X:" << diseasedRegion.x << " Y:" << diseasedRegion.y << "\n";
    std::cout << "    Calculated Real-World GPS Hit -> Lat: " << targetLat << " , Long: " << targetLong << "\n\n";

    // 5. Fire Webhook to Node.js backend
    std::cout << "[5] dispatching Webhook to Node.js Command Center (localhost:5000)...\n";
    WebhookClient client("http://localhost:5000/api/alerts");
    
    bool sendStatus = client.sendAlert(
        "FARMER-884A",        // Farmer ID
        "Late Leaf Blight",   // Disease 
        targetLat,            // Latitude 
        targetLong,           // Longitude
        "HIGH",               // Severity
        "Copper Fungicide"    // Pesticide Recommendation
    );

    if (sendStatus) {
        std::cout << "\n✅ Pipeline test complete. Your Node.js terminal should now show the intercept!\n";
    }

    return 0;
}
