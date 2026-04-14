#include "GSDCalculator.h"
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// Earth's mean radius in meters
const double EARTH_RADIUS_M = 6378137.0;

GSDCalculator::GSDCalculator() {}

std::pair<double, double> GSDCalculator::calculateLatLong(double baseLat, double baseLong, int pixelOffsetX, int pixelOffsetY, double gsdMetersPerPixel) {
    // 1. Convert pixel offsets into real-world physical distance from the drone center (in meters)
    double distanceX = static_cast<double>(pixelOffsetX) * gsdMetersPerPixel; 
    double distanceY = static_cast<double>(pixelOffsetY) * gsdMetersPerPixel; 

    // 2. Calculate the change in coordinates in radians
    // Latitude shift is based purely on vertical movement (Y / R)
    double latOffsetRadians = distanceY / EARTH_RADIUS_M;
    
    // Longitude shift must account for the shrinking radius of the earth as you move away from the equator
    double baseLatRadians = baseLat * (M_PI / 180.0);
    double lonOffsetRadians = distanceX / (EARTH_RADIUS_M * std::cos(baseLatRadians));

    // 3. Convert radians back to degrees and apply to base coordinate
    double newLat = baseLat + (latOffsetRadians * (180.0 / M_PI));
    double newLong = baseLong + (lonOffsetRadians * (180.0 / M_PI));

    return {newLat, newLong};
}
