#pragma once
#include <opencv2/opencv.hpp>
#include <vector>

class Slicer {
public:
    Slicer();
    // Performs SAHI (Slicing Aided Hyper Inference) mathematics to slice massive 4K images
    std::vector<cv::Rect> getSlices(const cv::Mat& image, int sliceWidth, int sliceHeight, double overlap);
};
