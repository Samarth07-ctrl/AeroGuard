# 🚀 AeroVision
### AI-Powered Drone Crop Disease Detection & Precision Agriculture Platform

<p align="center">
  <img src="https://img.shields.io/badge/AI-YOLOv8-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/C%2B%2B-17-orange?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Node.js-Backend-green?style=for-the-badge" />
  <img src="https://img.shields.io/badge/React-Frontend-61DAFB?style=for-the-badge" />
  <img src="https://img.shields.io/badge/MongoDB-Database-brightgreen?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Docker-Containerized-2496ED?style=for-the-badge" />
</p>

<p align="center">
  <b>Transforming Drone Imagery into Actionable Agricultural Intelligence</b>
</p>

---

## 🌾 Overview

AeroVision is an AI-powered precision agriculture platform that leverages drone imagery, computer vision, and geospatial analytics to detect crop diseases in real time.

The system enables farmers and agronomists to monitor large agricultural fields efficiently, identify disease hotspots, assess severity levels, and receive actionable treatment recommendations.

---

## 🎯 Problem Statement

Plant diseases cause significant crop losses worldwide, often due to delayed detection and inefficient monitoring methods.

Traditional field inspection:

- ❌ Time-consuming
- ❌ Labor-intensive
- ❌ Difficult for large farms
- ❌ Prone to delayed response

AeroVision addresses these challenges by combining drone technology, AI-powered disease detection, and GPS-based mapping to provide real-time agricultural intelligence.

---

# ✨ Key Features

### 🤖 AI Disease Detection
Detects crop diseases using a YOLOv8-powered computer vision engine.

### 🚁 Drone Image Analysis
Processes high-resolution drone imagery for large-scale field monitoring.

### 🗺️ GPS Disease Mapping
Converts detections into real-world GPS coordinates for accurate localization.

### 📊 Risk Prediction
Analyzes environmental and spatial factors to estimate disease spread.

### 🔔 Real-Time Alerts
Generates instant disease alerts and treatment recommendations.

### 👨‍🌾 Farmer Management
OTP and QR-based farmer onboarding and authentication.

### 📦 Batch Processing
Supports large-scale analysis of multiple drone images simultaneously.

### ☁️ Cloud Integration
Stores processed images and analytics securely.

---

# 🏗️ System Architecture

```text
                    Drone Imagery
                           │
                           ▼
               ┌────────────────────┐
               │ AeroVision Engine  │
               │ YOLOv8 + OpenCV    │
               └─────────┬──────────┘
                         │
                         ▼
              Disease Detection Layer
                         │
                         ▼
              GPS Mapping & Analytics
                         │
                         ▼
                 Node.js Backend API
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
      MongoDB       Cloudinary      Alerts
                         │
                         ▼
                  React Dashboard
```

---

# 🧠 AI Pipeline

```text
Drone Image
     │
     ▼
GPS Extraction
     │
     ▼
Image Slicing (SAHI)
     │
     ▼
YOLOv8 Inference
     │
     ▼
Disease Detection
     │
     ▼
Severity Analysis
     │
     ▼
GPS Coordinate Mapping
     │
     ▼
Risk Prediction
     │
     ▼
Dashboard Visualization
```

---

# 🔬 Detectable Diseases

| Disease | Treatment |
|----------|----------|
| Powdery Mildew | Sulfur Dust Treatment |
| Tar Spot | Propiconazole Spray |
| Black Knot | Captan Fungicide |
| Chlorosis | Iron Chelate Supplement |
| Peach Leaf Curl | Chlorothalonil Fungicide |
| Sooty Mold | Neem Oil Application |
| Golden Canker | Copper Hydroxide |
| Elderberry Rust | Mancozeb Spray |
| Gymnosporangium Rusts | Myclobutanil Fungicide |
| Dog Vomit Slime Mold | Potassium Bicarbonate |

---

# 🛠️ Tech Stack

## AI & Computer Vision

- YOLOv8
- OpenCV
- ONNX Runtime
- C++17

## Backend

- Node.js
- Express.js
- MongoDB
- JWT Authentication

## Frontend

- React
- Vite
- Tailwind CSS
- Leaflet Maps

## DevOps & Cloud

- Docker
- Docker Compose
- Cloudinary

## Geospatial Analytics

- GeoJSON
- Haversine Formula
- GPS Coordinate Mapping

---

# 📊 Core Modules

### 🚁 Drone Analytics Engine
Processes drone imagery and performs AI inference.

### 🧠 Disease Intelligence Module
Identifies diseases and determines severity levels.

### 🌍 Geospatial Mapping Module
Maps detections to precise field coordinates.

### 📈 Risk Prediction Engine
Predicts potential disease spread zones.

### 🔔 Alert Management System
Generates and manages disease alerts.

### 👨‍🌾 Farmer Management Portal
Handles onboarding, verification, and monitoring.

---

# 🚀 Installation

## Clone Repository

```bash
git clone https://github.com/your-username/AeroVision.git

cd AeroVision
```

## Backend Setup

```bash
cd server

npm install

npm run dev
```

## Frontend Setup

```bash
cd client

npm install

npm run dev
```

## Docker Setup

```bash
docker-compose up --build
```

---

# 📈 Future Enhancements

- Multi-drone coordination
- Edge AI deployment
- Satellite imagery integration
- Disease forecasting using Deep Learning
- Automated pesticide recommendations
- Mobile farmer application
- Multi-language support

---

# 🏆 Project Highlights

✅ Real-Time Crop Disease Detection

✅ AI-Powered Precision Agriculture

✅ GPS-Based Disease Hotspot Mapping

✅ Risk Prediction Analytics

✅ Full-Stack Web Platform

✅ Scalable Batch Image Processing

✅ Cloud-Integrated Architecture

---

# 👨‍💻 Author

**Samarth Khadse**

Applied Artificial Intelligence & Data Science Student

Passionate about AI, Computer Vision, Agritech, and Full-Stack Development.

---

## ⭐ Support

If you found this project interesting:

- ⭐ Star the repository
- 🍴 Fork the project
- 🚀 Share it with others

---

<p align="center">
  <b>Empowering Agriculture with Artificial Intelligence 🚀🌾</b>
</p>
