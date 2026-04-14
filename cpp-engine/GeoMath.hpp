#pragma once

struct GPSCoordinate {
    double latitude;
    double longitude;
};

class GeoMath {
public:
    // Initialize with mock EXIF drone location variables
    GeoMath(double center_lat, double center_lon, double altitude_m, double fov_degrees);

    // Converts pixel coordinates from the image array into a GPS latitude and longitude
    GPSCoordinate pixelToGPS(int x, int y, int image_width, int image_height);

private:
    double center_lat_;
    double center_lon_;
    double altitude_m_;
    double fov_degrees_;
};
