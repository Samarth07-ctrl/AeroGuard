const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads dir
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// --- 1. The C++ Webhook Catcher (Phase 4 perfectly synchronized) ---
app.post('/api/alerts', async (req, res) => {
    try {
        const payload = req.body;
        
        console.log("\n🚨 [NEW ALERT RECEIVED FROM C++ ENGINE] 🚨");
        console.log(`👨‍🌾 Farmer ID: ${payload.farmer_id}`);
        console.log(`🦠 Disease: ${payload.disease} (Severity: ${payload.severity})`);
        console.log(`📍 GPS Location: Lat ${payload.lat}, Lon ${payload.long}`);
        console.log(`💊 Action Required: ${payload.pesticide}`);

        // --- REAL STEP: Save to MongoDB and release React app UI ---
        const ScanSession = require('./models/ScanSession');
        
        // Find the most recent session that the UI is currently polling
        const session = await ScanSession.findOne({ status: 'processing' }).sort({ createdAt: -1 });

        if (session) {
            // Push the C++ result straight into the UI's database object
            session.results.push({
                lat: payload.lat,
                long: payload.long,
                disease: payload.disease,
                severity: payload.severity
            });
            // Mark it as completed. This immediately tells the React UI to hide the loading spinner and show the real data!
            session.status = 'completed';
            await session.save();
            console.log(`✅ [MongoDB] Result bound to UI Session ID: ${session.sessionId}`);
        } else {
            console.log(`⚠️ [WARNING] C++ Webhook received, but the React UI doesn't have an active 'processing' session right now.`);
        }

        res.status(200).json({ message: "Alert received and mapped to UI successfully." });

    } catch (error) {
        console.error("[ERROR] Failed to process webhook:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Routes
const indexRoutes = require('./routes/index');
app.use('/api', indexRoutes);

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/aeroguard')
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error('MongoDB connection error:', err));
