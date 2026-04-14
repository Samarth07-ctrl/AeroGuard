#include "GeoMath.hpp"
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// Approximate conversion: meters per degree of latitude & longitude near equator
const double METERS_PER_DEG_LAT = 111320.0;

GeoMath::GeoMath(double center_lat, double center_lon, double altitude_m, double fov_degrees)
    : center_lat_(center_lat), center_lon_(center_lon), altitude_m_(altitude_m), fov_degrees_(fov_degrees) {
}

GPSCoordinate GeoMath::pixelToGPS(int x, int y, int image_width, int image_height) {
    // 1. Calculate GSD (Ground Sample Distance) in meters per pixel.
    // We treat the field of view as horizontal span for a basic pinhole projection assumption.
    double sensor_width_m = 2.0 * altitude_m_ * tan((fov_degrees_ / 2.0) * (M_PI / 180.0));
    double gsd_x = sensor_width_m / (double)image_width;
    double gsd_y = gsd_x; // Assuming square pixels

    // 2. Calculate the offset from the optical center (which is aligned to drone center GPS)
    double cx = image_width / 2.0;
    double cy = image_height / 2.0;
    
    // X distance from center (East/West)
    double dx_pixels = x - cx;
    
    // Images have origin y=0 at the top, so we reverse it (cy - y makes "North / Up" positive)
    double dy_pixels = cy - y; 

    // 3. Convert absolute pixel offsets to meters
    double dx_meters = dx_pixels * gsd_x;
    double dy_meters = dy_pixels * gsd_y;

    // 4. Map the cartesian offset to lat/lon coordinate offsets
    // Compensate for converging meridians based on drone latitude
    double meters_per_deg_lon = METERS_PER_DEG_LAT * cos(center_lat_ * (M_PI / 180.0));

    double dLat = dy_meters / METERS_PER_DEG_LAT;
    double dLon = dx_meters / meters_per_deg_lon;

    GPSCoordinate gps;
    gps.latitude = center_lat_ + dLat;
    gps.longitude = center_lon_ + dLon;

    return gps;
}
