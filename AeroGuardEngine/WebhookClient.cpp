#include "WebhookClient.h"
#include <cpr/cpr.h>
#include <nlohmann/json.hpp>
#include <iostream>

using json = nlohmann::json;

WebhookClient::WebhookClient(const std::string& url) {
    serverUrl = url;
}

bool WebhookClient::sendAlert(const std::string& farmerId, const std::string& disease, double lat, double lon, const std::string& severity, const std::string& pesticide) {
    
    // 1. Serialize the exact JSON structure our Node.js/Flutter stack expects
    json payload = {
        {"type", "DISEASE_ALERT"},
        {"farmer_id", farmerId},
        {"disease", disease},
        {"lat", lat},
        {"long", lon},
        {"severity", severity},
        {"pesticide", pesticide}
    };

    // 2. Fire the POST request to the Node.js Server
    cpr::Response r = cpr::Post(cpr::Url{serverUrl},
                                cpr::Header{{"Content-Type", "application/json"}},
                                cpr::Body{payload.dump()});

    // 3. Error Handling for the Hackathon Demo
    if (r.status_code == 200 || r.status_code == 201) {
        std::cout << "[SUCCESS] Alert pushed to Node.js! FCM triggered for Farmer ID: " << farmerId << "\n";
        return true;
    } else {
        std::cerr << "[FAILED] Webhook drop. Node.js responded with Status: " << r.status_code << "\n";
        std::cerr << "Error Details: " << r.text << "\n";
        return false;
    }
}
