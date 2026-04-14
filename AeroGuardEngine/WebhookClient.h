#pragma once
#include <string>

class WebhookClient {
private:
    std::string serverUrl;

public:
    // Initialize with your Node.js server endpoint
    WebhookClient(const std::string& url);

    // The payload function perfectly matched to our Flutter App UI
    bool sendAlert(const std::string& farmerId, 
                   const std::string& disease, 
                   double lat, 
                   double lon, 
                   const std::string& severity, 
                   const std::string& pesticide);
};
