const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── In-memory live alerts array (populated by C++ Engine webhooks) ──
let liveAlerts = [];

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads dir
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// ══════════════════════════════════════════════════
// POST /api/alerts — C++ Webhook Catcher
// Iron Gate: confidence >= 0.60 OR severity High/Severe.
// Session Isolation: diseases array is OVERWRITTEN per sessionId, never merged.
// Micro-GPS: bbox offset applied to each detection before saving.
// Healthy Fallback: zero-pass sessions get "Healthy Field / No Anomalies Found".
// ══════════════════════════════════════════════════
app.post('/api/alerts', async (req, res) => {
    try {
        const payload = req.body;
        const sessionId = payload.sessionId;
        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required in alert payload." });
        }

        console.log("\n🚨 [C++ ENGINE ALERT]");
        console.log(`   Session : ${sessionId.slice(0, 12)}…`);
        console.log(`   Disease : ${payload.disease}  Severity: ${payload.severity}  Conf: ${payload.confidence ?? payload.conf ?? 'N/A'}`);
        console.log(`   GPS     : ${payload.lat}, ${payload.long}  BBox: ${JSON.stringify(payload.bbox ?? null)}`);

        // ── IRON GATE: 60% confidence threshold ──
        const rawConf = payload.confidence ?? payload.conf;
        let confidence = rawConf !== undefined ? parseFloat(rawConf) : null;
        if (confidence !== null && confidence > 1) confidence = confidence / 100; // normalise 0–100 → 0–1

        const severityRaw = String(payload.severity || '').toLowerCase();
        const isHighSeverity = ['high', 'severe'].includes(severityRaw);
        const passesGate = isHighSeverity || (confidence !== null && confidence >= 0.60);

        if (!passesGate) {
            console.log(`   🔇 GATE DROPPED — conf=${confidence?.toFixed(2) ?? '?'} sev=${payload.severity}`);
            return res.status(200).json({ message: "Detection filtered by confidence gate." });
        }
        console.log(`   ✅ GATE PASSED`);

        // ── MICRO-GPS: use EXIF-extracted base coords + bbox offset ──
        // Prefer the baseLat/baseLon stored on the AnalysisSession (extracted at
        // upload time from real EXIF data, or Pune fallback). Only use the C++
        // payload lat/long if the AnalysisSession hasn't been created yet.
        const { applyBboxOffset } = require('./utils/riskEngine');

        // We'll resolve the base coords after we fetch the AnalysisSession below.
        // For now, use payload coords as a temporary fallback.
        let baseLat = payload.lat   ?? 18.5204;
        let baseLon = payload.long  ?? 73.8567;

        // ── Push to in-memory live alerts (coords resolved after DB block) ──
        // We push after the DB block so shiftedLat/shiftedLon are available.
        // Defined here as let so the DB block can assign them.
        let shiftedLat = baseLat;
        let shiftedLon = baseLon;

        // ── Persist to MongoDB with SESSION ISOLATION ──
        try {
            const ScanSession = require('./models/ScanSession');
            const AnalysisSession = require('./models/AnalysisSession');

            // 1. Update ScanSession (append raw result for polling)
            const scanSession = await ScanSession.findOne({ sessionId });
            if (scanSession) {
                scanSession.results.push({
                    lat: baseLat,
                    long: baseLon,
                    disease: payload.disease,
                    severity: payload.severity
                });
                scanSession.status = 'completed';
                await scanSession.save();
            }

            // 2. Update AnalysisSession — find or create, then $set diseases.
            //    We do NOT rely on uploadController having created it first.
            //    If it doesn't exist yet (race condition), create it now.
            let analysisSession = await AnalysisSession.findOne({ sessionId });

            if (!analysisSession) {
                // Create it on the fly — find the farmer from ScanSession
                const farmerEmail = scanSession?.farmerEmail;
                const Farmer = require('./models/Farmer');
                const farmer = farmerEmail
                    ? await Farmer.findOne({ email: farmerEmail })
                    : null;

                if (farmer) {
                    try {
                        analysisSession = await AnalysisSession.create({
                            sessionId,
                            farmerId:    farmer._id,
                            farmerEmail: farmer.email,
                            imagePath:   scanSession?.uploadPath || '',
                            location: {
                                type:        'Point',
                                coordinates: [Number(baseLon), Number(baseLat)],
                            },
                            isVerified: false,
                            diseases:   []
                        });
                        console.log(`   ✅ DB: Created AnalysisSession on-the-fly for ${sessionId.slice(0, 8)}`);
                    } catch (createErr) {
                        // Duplicate key — another alert beat us to it, fetch it
                        analysisSession = await AnalysisSession.findOne({ sessionId });
                    }
                }
            }

            // Use EXIF-verified base coords from the AnalysisSession if available
            if (analysisSession?.baseLat && analysisSession?.baseLon) {
                baseLat = analysisSession.baseLat;
                baseLon = analysisSession.baseLon;
            }

            // Apply bbox micro-offset on top of the verified base coordinates
            const shifted = applyBboxOffset(
                baseLat,
                baseLon,
                payload.bbox ?? null,
                payload.imgWidth  ?? 640,
                payload.imgHeight ?? 640
            );
            // Update the outer lets so the in-memory push uses the same coords
            shiftedLat = shifted.lat;
            shiftedLon = shifted.lon;

            if (analysisSession) {
                const cleaned = (analysisSession.diseases || []).filter(
                    (d) => !['healthy field / no anomalies found', 'no disease detected / invalid image']
                        .includes((d.name || '').toLowerCase())
                );
                cleaned.push({
                    name:       payload.disease,
                    severity:   payload.severity,
                    confidence: confidence,
                    lat:        Number(shiftedLat),
                    lon:        Number(shiftedLon)
                });

                // Derive farmerEmail from ScanSession if not already on the document
                const emailToSave = analysisSession.farmerEmail
                    || scanSession?.farmerEmail
                    || '';

                await AnalysisSession.updateOne(
                    { sessionId },
                    {
                        $set: {
                            diseases:    cleaned,
                            isVerified:  true,
                            farmerEmail: emailToSave,
                            // Keep GeoJSON location in sync with base coords
                            location: {
                                type:        'Point',
                                coordinates: [Number(analysisSession.baseLon || shiftedLon),
                                              Number(analysisSession.baseLat || shiftedLat)],
                            },
                        },
                    }
                );
                console.log(`   ✅ DB: diseases[$set] on session ${sessionId.slice(0, 8)} (${cleaned.length} total) GPS-source=${analysisSession.gpsSource ?? 'unknown'}`);
            } else {
                console.log(`   ⚠️  DB: Could not find or create AnalysisSession for ${sessionId.slice(0, 8)} — no farmer found`);
            }
        } catch (dbErr) {
            console.error(`   ⚠️  DB write failed:`, dbErr.message);
        }

        // Push to in-memory live alerts using the final resolved coordinates
        liveAlerts.push({
            sessionId,
            farmer_id: payload.farmer_id,
            disease: payload.disease,
            lat: shiftedLat,
            long: shiftedLon,
            severity: payload.severity,
            confidence,
            pesticide: payload.pesticide,
            timestamp: new Date().toISOString()
        });

        return res.status(200).json({ message: "Alert accepted." });

    } catch (error) {
        console.error("[ERROR] /api/alerts:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// ══════════════════════════════════════════════════
// GET /api/alerts — Frontend Poller
// Merges in-memory live alerts WITH persisted DB results.
// This means the workspace always shows data even after restart.
// ══════════════════════════════════════════════════
app.get('/api/alerts', async (req, res) => {
    const { sessionId } = req.query;
    try {
        const ScanSession = require('./models/ScanSession');

        if (sessionId) {
            // 1. Get persisted results from DB
            const session = await ScanSession.findOne({ sessionId });
            const dbAlerts = (session?.results || []).map((r) => ({
                sessionId,
                disease: r.disease,
                lat: r.lat,
                long: r.long,
                severity: r.severity,
                pesticide: r.pesticide || null,
                timestamp: session.updatedAt || session.createdAt,
            }));

            // 2. Merge with any live in-memory alerts (dedup by disease+lat+long)
            const live = liveAlerts.filter((a) => a.sessionId === sessionId);
            const merged = [...dbAlerts];
            for (const la of live) {
                const isDupe = merged.some(
                    (d) => d.disease === la.disease &&
                           Math.abs((d.lat || 0) - (la.lat || 0)) < 0.00001 &&
                           Math.abs((d.long || 0) - (la.long || 0)) < 0.00001
                );
                if (!isDupe) merged.push(la);
            }
            return res.status(200).json(merged);
        }

        // No sessionId — return all live alerts
        return res.status(200).json(liveAlerts);
    } catch (err) {
        // Fallback to in-memory if DB fails
        const scoped = sessionId
            ? liveAlerts.filter((a) => a.sessionId === sessionId)
            : liveAlerts;
        return res.status(200).json(scoped);
    }
});

// ══════════════════════════════════════════════════
// GET /api/workspaces — All verified farmer sessions from DB
// Used by the dashboard to recover workspaces after restart.
// Returns [{email, sessionId, verifiedAt}] for all verified ScanSessions.
// ══════════════════════════════════════════════════
app.get('/api/workspaces', async (req, res) => {
    try {
        const ScanSession = require('./models/ScanSession');
        // Include both verified sessions AND pending invites (so QR codes show up after restart)
        const sessions = await ScanSession.find({
            $or: [{ isVerified: true }, { appLinkStatus: 'pending_app_install' }]
        })
            .sort({ createdAt: -1 })
            .select('sessionId farmerEmail createdAt qrToken appLinkStatus isVerified');

        const workspaces = sessions.map((s) => ({
            email:         s.farmerEmail,
            sessionId:     s.sessionId,
            verifiedAt:    s.createdAt,
            qrToken:       s.qrToken       || null,
            appLinkStatus: s.appLinkStatus || (s.isVerified ? 'app_linked' : 'pending_app_install'),
        }));

        return res.status(200).json(workspaces);
    } catch (err) {
        console.error('[WORKSPACES] error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


app.get('/api/alerts/history/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const ScanSession = require('./models/ScanSession');
        const session = await ScanSession.findOne({ sessionId });
        if (!session) return res.status(200).json([]);

        // Normalise ScanSession.results to the same shape as liveAlerts
        const persisted = (session.results || []).map((r) => ({
            sessionId,
            disease: r.disease,
            lat: r.lat,
            long: r.long,
            severity: r.severity,
            pesticide: r.pesticide || null,
            timestamp: session.updatedAt || session.createdAt,
            fromHistory: true,
        }));
        return res.status(200).json(persisted);
    } catch (err) {
        console.error('[HISTORY] alerts/history error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


app.delete('/api/alerts', (req, res) => {
    liveAlerts = [];
    console.log("🗑️ [RESET] All live alerts cleared.");
    res.status(200).json({ message: "Alerts cleared." });
});

// ══════════════════════════════════════════════════
// POST /api/alerts/complete — C++ Engine Completion Signal
// Called by the C++ engine after it finishes processing a session.
// If zero detections passed the confidence gate for this session,
// saves a "No Disease Detected / Invalid Image" sentinel so the
// History page always shows a result row (never a blank).
// ══════════════════════════════════════════════════
app.post('/api/alerts/complete', async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
        }

        const AnalysisSession = require('./models/AnalysisSession');
        const ScanSession = require('./models/ScanSession');

        const analysisSession = await AnalysisSession.findOne({ sessionId });
        if (analysisSession && analysisSession.diseases.length === 0) {
            await AnalysisSession.updateOne(
                { sessionId },
                { $set: { diseases: [{
                    name: 'Healthy Field / No Anomalies Found',
                    severity: 'Safe',
                    lat: null,
                    lon: null
                }] } }
            );
            console.log(`🟢 [COMPLETE] Healthy sentinel saved for ${sessionId.slice(0, 8)}`);
        }

        // Mark ScanSession complete regardless
        const scanSession = await ScanSession.findOne({ sessionId });
        if (scanSession && scanSession.status !== 'completed') {
            scanSession.status = 'completed';
            await scanSession.save();
        }

        return res.status(200).json({ message: 'Session marked complete.' });
    } catch (error) {
        console.error('[COMPLETE] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Routes (existing OTP, upload, webhook/results handlers)
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/authRoutes');
const farmerRoutes = require('./routes/farmerRoutes');
const analysisRoutes = require('./routes/analysisRoutes');
const authMiddleware = require('./middleware/authMiddleware');
const analysisController = require('./controllers/analysisController');
app.use('/api', indexRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/farmer', farmerRoutes);
app.use('/api/analysis-sessions', analysisRoutes);
app.get('/api/map-data', authMiddleware, analysisController.getMapData);
app.get('/api/risk-prediction', authMiddleware, analysisController.getRiskPrediction);

// ── Dynamic Spatial Clustering (USP) ──
const clusterController = require('./controllers/clusterController');
app.get('/api/clusters/:sessionId', clusterController.getSessionClusters);

// ══════════════════════════════════════════════════
// GET /api/farmer-detections — Mobile App Query
// Returns all verified detections for a farmer email.
// Mobile app calls: GET /api/farmer-detections?email=farmer@example.com
// ══════════════════════════════════════════════════
app.get('/api/farmer-detections', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ error: 'email query param is required' });

        const AnalysisSession = require('./models/AnalysisSession');
        const SAFE_NAMES = [
            'healthy field / no anomalies found',
            'no disease detected / invalid image',
        ];

        const sessions = await AnalysisSession.find({
            farmerEmail: String(email).trim().toLowerCase(),
            isVerified:  true,
        })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        const detections = sessions.flatMap((s) =>
            (s.diseases || [])
                .filter((d) => {
                    const sev  = (d.severity || '').toLowerCase();
                    const name = (d.name || '').toLowerCase();
                    return sev !== 'safe' && !SAFE_NAMES.some(n => name.includes(n));
                })
                .map((d) => ({
                    sessionId:    s.sessionId,
                    batchId:      s.batchId,
                    imageUrl:     s.imageUrl,
                    farmerEmail:  s.farmerEmail,
                    disease:      d.name,
                    severity:     d.severity,
                    confidence:   d.confidence,
                    lat:          Number(d.lat),
                    lon:          Number(d.lon),
                    riskScore:    d.riskScore,
                    riskRadius:   d.riskRadius,
                    spreadRadius: d.spreadRadius,
                    createdAt:    s.createdAt,
                }))
        );

        return res.status(200).json({ email, count: detections.length, detections });
    } catch (err) {
        console.error('[FARMER-DETECTIONS] error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/aeroguard')
  .then(async () => {
    const dbName = mongoose.connection.db.databaseName;
    console.log(`Connected to MongoDB — database: "${dbName}"`);

    // Startup diagnostic: show how many OTP sessions exist
    try {
      const ScanSession = require('./models/ScanSession');
      const total = await ScanSession.countDocuments();
      const unverified = await ScanSession.countDocuments({ isVerified: false });
      console.log(`📊 ScanSessions in "${dbName}": ${total} total, ${unverified} unverified`);
      if (total > 0) {
        const latest = await ScanSession.findOne().sort({ createdAt: -1 }).lean();
        console.log(`   Latest: email="${latest.farmerEmail}" otp="${latest.otpCode}" verified=${latest.isVerified} session=${latest.sessionId?.slice(0,8)}`);
      }
    } catch (diagErr) {
      console.warn('Startup diagnostic skipped:', diagErr.message);
    }

    app.listen(PORT, () => {
      console.log(`\n🌐 AeroGuard Command Center running on http://localhost:${PORT}`);
      console.log(`📡 POST /api/alerts — Waiting for C++ Engine webhooks...`);
      console.log(`📡 GET  /api/alerts — React frontend polling endpoint ready.\n`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    console.log('Starting without MongoDB (in-memory alerts only)...');
    app.listen(PORT, () => {
      console.log(`\n🌐 AeroGuard Command Center running on http://localhost:${PORT} (No DB)`);
      console.log(`📡 POST /api/alerts — Waiting for C++ Engine webhooks...`);
      console.log(`📡 GET  /api/alerts — React frontend polling endpoint ready.\n`);
    });
  });
