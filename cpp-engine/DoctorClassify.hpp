#pragma once
#include <string>
#include <memory>
#include <opencv2/opencv.hpp>
#include <onnxruntime_cxx_api.h>
#include "ScoutDet.hpp" 

struct ClassificationResult {
    std::string disease_name;
    float confidence;
};

class DoctorClassify {
public:
    DoctorClassify(const std::string& modelPath);
    ClassificationResult classifyCrop(const cv::Mat& original_image, const BBox& bbox);

private:
    Ort::Env env;
    Ort::SessionOptions sessionOptions;
    std::unique_ptr<Ort::Session> session;
};
