#pragma once
#include <string>
#include <vector>
#include <memory>
#include <opencv2/opencv.hpp>
#include <onnxruntime_cxx_api.h>

struct BBox {
    int x; // top-left x relative to original image
    int y; // top-left y relative to original image
    int w; // width
    int h; // height
    float confidence;
};

class ScoutDet {
public:
    ScoutDet(const std::string& modelPath);
    std::vector<BBox> runInference(const cv::Mat& image);

private:
    Ort::Env env;
    Ort::SessionOptions sessionOptions;
    // unique_ptr to handle the session
    std::unique_ptr<Ort::Session> session;
};
