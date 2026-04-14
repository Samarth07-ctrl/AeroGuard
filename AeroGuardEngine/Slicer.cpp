#include "Slicer.h"
#include <algorithm>

Slicer::Slicer() {}

std::vector<cv::Rect> Slicer::getSlices(const cv::Mat& image, int sliceWidth, int sliceHeight, double overlap) {
    std::vector<cv::Rect> slices;
    
    // Safety check
    if (image.empty() || sliceWidth <= 0 || sliceHeight <= 0 || overlap >= 1.0 || overlap < 0.0) {
        return slices;
    }

    int imgWidth = image.cols;
    int imgHeight = image.rows;

    // Calculate step distance based on overlap
    int stepX = static_cast<int>(sliceWidth * (1.0 - overlap));
    int stepY = static_cast<int>(sliceHeight * (1.0 - overlap));

    for (int y = 0; y < imgHeight; y += stepY) {
        for (int x = 0; x < imgWidth; x += stepX) {
            
            int x1 = x;
            int y1 = y;
            int x2 = x + sliceWidth;
            int y2 = y + sliceHeight;

            // Shift box backwards if we overflow the right/bottom edge
            // to avoid black-padding and keep slice sizes consistent for neural net
            if (x2 > imgWidth) {
                x1 = std::max(0, imgWidth - sliceWidth);
            }
            if (y2 > imgHeight) {
                y1 = std::max(0, imgHeight - sliceHeight);
            }

            // Constrain rect to image bounds
            int rectWidth = std::min(sliceWidth, imgWidth - x1);
            int rectHeight = std::min(sliceHeight, imgHeight - y1);
            
            slices.emplace_back(cv::Rect(x1, y1, rectWidth, rectHeight));

            if (x2 >= imgWidth) break; // Finished row
        }
        if (y + sliceHeight >= imgHeight) break; // Finished columns
    }

    return slices;
}
