const AnalysisSession = require('../models/AnalysisSession');
const {
  calculateRiskScore,
  destinationPoint,
  haversineDistanceKm
} = require('../utils/riskEngine');

exports.getAllAnalysisSessions = async (_req, res) => {
  try {
    const sessions = await AnalysisSession.find()
      .sort({ createdAt: -1 })
      .populate('farmerId', 'farmerId email');

    // Return all sessions — even ones where populate returned null farmerId
    return res.status(200).json(sessions);
  } catch (error) {
    console.error('[ANALYSIS] fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/analysis-sessions/farmer/:email ──────────────────────────────
// Returns all analysis sessions for a specific farmer by email
exports.getFarmerAnalysisSessions = async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const normalizedEmail = String(email).trim().toLowerCase();
    
    const sessions = await AnalysisSession.find({ farmerEmail: normalizedEmail })
      .sort({ createdAt: -1 })
      .populate('farmerId', 'farmerId email')
      .lean();

    console.log(`[ANALYSIS] Farmer ${normalizedEmail} has ${sessions.length} sessions`);
    return res.status(200).json(sessions);
  } catch (error) {
    console.error('[ANALYSIS] farmer fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/analysis-sessions/session/:sessionId ────────────────────────
// Returns all analysis sessions linked to an OTP sessionId (via farmerId lookup)
exports.getSessionAnalysisSessions = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ error: 'Session ID is required' });

    // Find the ScanSession to get the farmer email
    const ScanSession = require('../models/ScanSession');
    const scanSession = await ScanSession.findOne({ sessionId });
    
    if (!scanSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const normalizedEmail = String(scanSession.farmerEmail).trim().toLowerCase();
    
    // Find all analysis sessions for this farmer
    const sessions = await AnalysisSession.find({ farmerEmail: normalizedEmail })
      .sort({ createdAt: -1 })
      .populate('farmerId', 'farmerId email')
      .lean();

    console.log(`[ANALYSIS] Session ${sessionId.slice(0, 8)} (farmer: ${normalizedEmail}) has ${sessions.length} analysis sessions`);
    return res.status(200).json(sessions);
  } catch (error) {
    console.error('[ANALYSIS] session fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getMapData = async (_req, res) => {
  try {
    const sessions = await AnalysisSession.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('farmerId', 'email farmerId');

    const SAFE_NAMES = [
      'healthy field / no anomalies found',
      'no disease detected / invalid image',
    ];

    const detections = sessions.flatMap((session) =>
      (session.diseases || [])
        // Strip safe sentinels — they must never appear on the map
        .filter((disease) => {
          const sev = (disease.severity || '').toLowerCase();
          const name = (disease.name || '').toLowerCase();
          return sev !== 'safe' && !SAFE_NAMES.includes(name);
        })
        .filter((disease) => disease.lat != null && disease.lon != null)
        .map((disease) => ({
          sessionId: session.sessionId,
          farmerEmail: session.farmerId?.email || '-',
          disease: disease.name,
          severity: disease.severity,
          lat: disease.lat,
          lon: disease.lon,
          createdAt: session.createdAt
        }))
    );

    return res.status(200).json(detections);
  } catch (error) {
    console.error('[ANALYSIS] map-data error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getRiskPrediction = async (_req, res) => {
  try {
    const sessions = await AnalysisSession.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('farmerId', 'email farmerId');

    const highDetections = sessions.flatMap((session) =>
      (session.diseases || [])
        .filter((disease) => ['high', 'severe'].includes(String(disease.severity || '').toLowerCase()))
        .map((disease) => ({
          sessionId: session.sessionId,
          farmerEmail: session.farmerId?.email || '-',
          disease: disease.name,
          severity: disease.severity,
          lat: disease.lat,
          lon: disease.lon,
          createdAt: session.createdAt
        }))
    ).slice(0, 10);

    const weatherRes = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=18.5204&longitude=73.8567&current=relative_humidity_2m'
    );
    const weatherJson = await weatherRes.json();
    const humidity = Number(weatherJson?.current?.relative_humidity_2m || 0);

    const radii = [2, 3.5, 5];
    const bearings = [45, 145, 245];
    const predictedZones = [];

    highDetections.forEach((seedDetection) => {
      radii.forEach((radiusKm, idx) => {
        const projected = destinationPoint(seedDetection.lat, seedDetection.lon, bearings[idx], radiusKm);
        const distanceKm = haversineDistanceKm(
          seedDetection.lat,
          seedDetection.lon,
          projected.lat,
          projected.lon
        );
        const riskScore = calculateRiskScore(distanceKm, humidity);

        predictedZones.push({
          sourceSessionId: seedDetection.sessionId,
          disease: seedDetection.disease,
          catalyst: 'High Humidity',
          humidity,
          distanceKm: Number(distanceKm.toFixed(2)),
          radiusKm: 5,
          lat: Number(projected.lat.toFixed(6)),
          lon: Number(projected.lon.toFixed(6)),
          riskScore,
          message: `Warning: Farms near [${projected.lat.toFixed(4)}, ${projected.lon.toFixed(4)}] are at ${riskScore}% risk of ${seedDetection.disease} spread within 48h.`
        });
      });
    });

    return res.status(200).json({
      humidity,
      zones: predictedZones
    });
  } catch (error) {
    console.error('[ANALYSIS] risk-prediction error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
