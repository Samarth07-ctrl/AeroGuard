cmake_minimum_required(VERSION 3.15)
project(AeroGuardEngine)

set(CMAKE_CXX_STANDARD 17)

# Find packages installed via vcpkg
find_package(OpenCV REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)
find_package(cpr CONFIG REQUIRED)
find_package(exiv2 CONFIG REQUIRED)

# Add our source files
add_executable(AeroGuardEngine
    main.cpp
    Slicer.cpp
    GSDCalculator.cpp
    WebhookClient.cpp
)

# Link the libraries dynamically to our executable
target_link_libraries(AeroGuardEngine PRIVATE 
    ${OpenCV_LIBS}
    nlohmann_json::nlohmann_json
    cpr::cpr
    Exiv2::exiv2lib
)
