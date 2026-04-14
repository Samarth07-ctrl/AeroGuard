cmake_minimum_required(VERSION 3.14)
project(AeroGuardEngine CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find OpenCV
find_package(OpenCV REQUIRED)

# Find ONNX Runtime (Usually requires setting ONNXRUNTIME_DIR or having it globally)
find_package(onnxruntime QUIET)
if (NOT onnxruntime_FOUND)
    message(WARNING "onnxruntime not found via find_package. Using manual link if needed. Ensure it is installed.")
endif()

# Find libcurl
find_package(CURL REQUIRED)

# Fetch nlohmann/json as a dependency
include(FetchContent)
FetchContent_Declare(json
  URL https://github.com/nlohmann/json/releases/download/v3.11.2/json.tar.xz
)
FetchContent_MakeAvailable(json)

add_executable(aeroguard_engine
    main.cpp
    ScoutDet.cpp
    DoctorClassify.cpp
    GeoMath.cpp
)

target_link_libraries(aeroguard_engine
    PRIVATE
    ${OpenCV_LIBS}
    ${CURL_LIBRARIES}
    nlohmann_json::nlohmann_json
)

# Only link onnxruntime if found, otherwise assume user handles linking it or it's header-only for mock.
if (onnxruntime_FOUND)
    target_link_libraries(aeroguard_engine PRIVATE onnxruntime::onnxruntime)
else()
    # Assuming onnxruntime is installed system-wide.
    target_link_libraries(aeroguard_engine PRIVATE onnxruntime)
endif()
