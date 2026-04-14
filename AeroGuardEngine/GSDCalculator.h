#pragma once
#include <utility>

class GSDCalculator {
public:
    GSDCalculator();
    // Returns {Latitude, Longitude} projected from the focal point
    // Assumes baseLat/baseLong are the drone's center coordinates and pixelX/Y are offsets from the center.
    std::pair<double, double> calculateLatLong(double baseLat, double baseLong, int pixelOffsetX, int pixelOffsetY, double gsdMetersPerPixel);
};
