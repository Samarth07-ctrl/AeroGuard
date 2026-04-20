const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const ScanSession = require('../models/ScanSession');
const Farmer = require('../models/Farmer');
const AnalysisSession = require('../models/AnalysisSession');
const { extractGps } = require('../utils/extractGps');

const startCppEngine = (uploadId, imagePath) => {
  const engineDir = path.resolve(__dirname, '../../AeroGuardEngine');
  const enginePath = path.join(engineDir, 'build', 'Release', 'AeroGuardEngine.exe');
  const absoluteImagePath = path.isAbsolute(imagePath)
    ? imagePath
    : path.resolve(__dirname, '..', imagePath);
  const command = `"${enginePath}" "${absoluteImagePath}" "${uploadId}"`;

  console.log(`[C++ START] uploadId=${uploadId.slice(0, 8)} file=${path.basename(imagePath)}`);
  exec(command, { cwd: engineDir }, (error, stdout, stderr) => {
    if (stdout?.trim()) console.log(`[C++ STDOUT]\n${stdout}`);
    if (stderr?.trim()) console.error(`[C++ STDERR]\n${stderr}`);
    if (error) { console.error(`[C++ ERROR] ${error.message}`); return; }
    console.log(`[C++ DONE] uploadId=${uploadId.slice(0, 8)}`);
  });
};

exports.uploadImage = async (req, res) => {
  try {
    const { sessionId, farmerId } = req.body;

    if (!sessionId) return res.status(400).json({ error: 'Session ID is required' });

    const session = await ScanSession.findOne({ sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!session.isVerified) return res.status(403).json({ error: 'Session not verified. Complete OTP first.' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Unique uploadId per image — C++ engine and AnalysisSession use this, not the OTP sessionId
    const uploadId = crypto.randomBytes(16).toString('hex');

    session.status = 'processing';
    await session.save();

    let farmer = farmerId
      ? await Farmer.findOne({ farmerId })
      : await Farmer.findOne({ email: session.farmerEmail });

    // If the mobile app verified OTP directly in MongoDB, no Farmer doc was created.
    // Auto-create one now so uploads aren't blocked.
    if (!farmer && session.farmerEmail) {
      farmer = await Farmer.create({
        farmerId:   `FARM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        email:      session.farmerEmail,
        isVerified: true,
      });
      console.log(`[UPLOAD] Auto-created Farmer for ${session.farmerEmail} (app-verified session)`);
    }

    if (!farmer) {
      return res.status(400).json({ error: 'Farmer not found for this session. Re-verify OTP.' });
    }

    // ── BULLETPROOF EXIF GPS EXTRACTION ──
    // Reads real drone GPS from EXIF. Falls back to Pune coords if missing.
    // Never throws — always returns valid lat/lon.
    const absoluteImagePath = path.resolve(req.file.path);
    const { lat: baseLat, lon: baseLon, source: gpsSource } = await extractGps(absoluteImagePath);
    console.log(`[GPS] uploadId=${uploadId.slice(0, 8)} source=${gpsSource} → ${baseLat}, ${baseLon}`);

    // Create a fresh AnalysisSession with the verified GPS base coordinates
    await AnalysisSession.create({
      sessionId:   uploadId,
      farmerId:    farmer._id,
      farmerEmail: farmer.email,       // denormalised — enables farmer-scoped queries
      imagePath:   req.file.path,
      baseLat,
      baseLon,
      gpsSource,
      location: {
        type:        'Point',
        coordinates: [Number(baseLon), Number(baseLat)],
      },
      isVerified: false,
      diseases:   []
    });

    console.log(`[UPLOAD] uploadId=${uploadId.slice(0, 8)} farmer=${farmer.email}`);

    // Pass uploadId to C++ — all webhooks will reference this as sessionId
    startCppEngine(uploadId, req.file.path);

    return res.status(200).json({
      message: 'Upload successful, processing started',
      sessionId:     uploadId,
      authSessionId: sessionId,
      farmerId:      farmer.farmerId,
      filePath:      req.file.path,
      gps:           { lat: baseLat, lon: baseLon, source: gpsSource },
    });

  } catch (error) {
    console.error('[UPLOAD] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
