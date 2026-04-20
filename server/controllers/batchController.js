/**
 * batchController.js
 * Bulk ZIP / multi-image processing pipeline.
 *
 * Flow:
 *  1. Receive upload (ZIP or images) → validate auth
 *  2. Extract ZIP into temp_processing/{batchId}/
 *  3. Upload original ZIP to Cloudinary (async, non-blocking)
 *  4. For each image: extract EXIF GPS → create AnalysisSession → run C++ YOLO sequentially
 *  5. After each image completes: upload to Cloudinary, calculate spatial risk
 *  6. Mark BatchSession complete, emit progress via in-memory store
 *
 * CRITICAL: C++ YOLO execution is NOT modified — we only change how we feed it.
 */

const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const { exec } = require('child_process');
const AdmZip  = require('adm-zip');

const ScanSession    = require('../models/ScanSession');
const Farmer         = require('../models/Farmer');
const AnalysisSession = require('../models/AnalysisSession');
const BatchSession   = require('../models/BatchSession');
const { extractGps } = require('../utils/extractGps');
const { uploadImage: cloudUploadImage, uploadRaw } = require('../utils/cloudinaryClient');
const { haversineDistanceKm, calculateRiskScore } = require('../utils/riskEngine');

// ── In-memory progress store (batchId → progress object) ──────────────────
// Shared with server.js via module-level export so the GET /progress endpoint
// can read it without a DB round-trip.
const batchProgress = {};
module.exports.batchProgress = batchProgress;

// ── Allowed image extensions ───────────────────────────────────────────────
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.tif']);

// ── Temp directory ─────────────────────────────────────────────────────────
const TEMP_BASE = path.resolve(__dirname, '..', 'temp_processing');
if (!fs.existsSync(TEMP_BASE)) fs.mkdirSync(TEMP_BASE, { recursive: true });

// ── Run C++ YOLO engine (unchanged logic, wrapped in Promise) ──────────────
function runCppEngine(uploadId, imagePath) {
  return new Promise((resolve) => {
    const engineDir  = path.resolve(__dirname, '../../AeroGuardEngine');
    const enginePath = path.join(engineDir, 'build', 'Release', 'AeroGuardEngine.exe');
    const absPath    = path.isAbsolute(imagePath) ? imagePath : path.resolve(__dirname, '..', imagePath);
    const command    = `"${enginePath}" "${absPath}" "${uploadId}"`;

    console.log(`[BATCH C++] uploadId=${uploadId.slice(0, 8)} file=${path.basename(imagePath)}`);

    exec(command, { cwd: engineDir }, (error, stdout, stderr) => {
      if (stdout?.trim()) console.log(`[C++ STDOUT]\n${stdout}`);
      if (stderr?.trim()) console.error(`[C++ STDERR]\n${stderr}`);
      if (error) {
        console.error(`[C++ ERROR] ${error.message}`);
        resolve({ success: false, error: error.message });
      } else {
        console.log(`[C++ DONE] uploadId=${uploadId.slice(0, 8)}`);
        resolve({ success: true });
      }
    });
  });
}

// ── Wait for C++ webhook to write diseases to DB (poll with timeout) ───────
async function waitForDiseases(uploadId, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const session = await AnalysisSession.findOne({ sessionId: uploadId });
    if (session && session.diseases.length > 0) return session;
    await new Promise(r => setTimeout(r, 1500));
  }
  return await AnalysisSession.findOne({ sessionId: uploadId });
}

// ── Calculate spatial risk radius based on nearby detections ──────────────
async function calculateSpatialRisk(uploadId, batchId, humidity = 60) {
  const current = await AnalysisSession.findOne({ sessionId: uploadId });
  if (!current || current.diseases.length === 0) return;

  // Get all other sessions in this batch that have real detections
  const siblings = await AnalysisSession.find({
    batchId,
    sessionId: { $ne: uploadId },
    'diseases.0': { $exists: true },
    isVerified: true,
  });

  const updatedDiseases = current.diseases.map((disease) => {
    if (!disease.lat || !disease.lon) return disease.toObject ? disease.toObject() : disease;

    // Find nearest infected sibling detection
    let minDist = Infinity;
    for (const sib of siblings) {
      for (const d of sib.diseases) {
        if (!d.lat || !d.lon) continue;
        const dist = haversineDistanceKm(disease.lat, disease.lon, d.lat, d.lon);
        if (dist < minDist) minDist = dist;
      }
    }

    const riskScore    = minDist < Infinity ? calculateRiskScore(minDist, humidity) : 50;
    const riskRadius   = Math.round(50 + (riskScore / 100) * 200);  // 50–250m
    const spreadRadius = riskRadius; // alias for mobile app

    const base = disease.toObject ? disease.toObject() : { ...disease };
    return { ...base, riskScore, riskRadius, spreadRadius };
  });

  await AnalysisSession.updateOne(
    { sessionId: uploadId },
    {
      $set: {
        diseases:   updatedDiseases,
        isVerified: true,   // at least one disease passed the gate
      },
    }
  );
}

// ── Main batch processing function (runs async after HTTP response) ────────
async function processBatch(batchId, imageFiles, farmer, authSessionId, zipCloudUrl) {
  const progress = batchProgress[batchId];

  try {
    // Fetch live humidity for risk calculations
    let humidity = 60;
    try {
      const wRes = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=18.5204&longitude=73.8567&current=relative_humidity_2m'
      );
      const wJson = await wRes.json();
      humidity = Number(wJson?.current?.relative_humidity_2m || 60);
    } catch { /* use default */ }

    progress.status = 'processing';
    progress.humidity = humidity;

    const uploadIds = [];

    // ── Process each image SEQUENTIALLY (GPU safety) ──────────────────────
    for (let i = 0; i < imageFiles.length; i++) {
      const imgPath = imageFiles[i];
      const uploadId = crypto.randomBytes(16).toString('hex');
      uploadIds.push(uploadId);

      progress.currentFile = path.basename(imgPath);
      progress.processedImages = i;
      progress.message = `Processing image ${i + 1}/${imageFiles.length}: ${path.basename(imgPath)}`;

      try {
        // 1. Extract EXIF GPS — always returns valid numbers
        const { lat: baseLat, lon: baseLon, source: gpsSource } = await extractGps(imgPath);
        // Explicit Number() cast — guarantees no string coords reach MongoDB
        const numLat = Number(baseLat);
        const numLon = Number(baseLon);

        // 2. Create AnalysisSession with farmerEmail denormalised for mobile queries
        await AnalysisSession.create({
          sessionId:   uploadId,
          batchId,
          farmerId:    farmer._id,
          farmerEmail: farmer.email,           // denormalised — mobile app queries by this
          imagePath:   imgPath,
          baseLat:     numLat,
          baseLon:     numLon,
          gpsSource,
          location: {                          // GeoJSON for $near queries
            type:        'Point',
            coordinates: [numLon, numLat],     // GeoJSON is [lng, lat]
          },
          isVerified: false,                   // set to true after diseases pass gate
          diseases:   [],
        });

        console.log(`[BATCH] ✅ Created AnalysisSession ${uploadId.slice(0, 8)} for farmer ${farmer.email} (batchId: ${batchId.slice(0, 8)})`);

        // 3. Run C++ YOLO (unchanged — just feeding it one image at a time)
        await runCppEngine(uploadId, imgPath);

        // 4. Wait for webhook to write diseases
        progress.message = `Waiting for YOLO results (${i + 1}/${imageFiles.length})…`;
        const session = await waitForDiseases(uploadId, 45000);

        // 5. Upload image to Cloudinary
        progress.message = `Syncing to cloud (${i + 1}/${imageFiles.length})…`;
        const cloudResult = await cloudUploadImage(imgPath, `aeroguard/batches/${batchId}`);
        if (cloudResult?.secure_url) {
          await AnalysisSession.updateOne(
            { sessionId: uploadId },
            { $set: { imageUrl: cloudResult.secure_url } }
          );
        }

        // 6. Calculate spatial risk against other images in this batch
        if (session && session.diseases.length > 0) {
          await calculateSpatialRisk(uploadId, batchId, humidity);
          progress.totalDetections += session.diseases.length;
        }

        // 7. Update BatchSession progress in DB
        await BatchSession.updateOne(
          { batchId },
          {
            $inc:  { processedImages: 1 },
            $push: { uploadIds: uploadId },
          }
        );

        progress.processedImages = i + 1;

      } catch (imgErr) {
        console.error(`[BATCH] Image failed: ${path.basename(imgPath)} — ${imgErr.message}`);
        progress.failedImages += 1;
        await BatchSession.updateOne({ batchId }, { $inc: { failedImages: 1 } });
      }
    }

    // ── Finalise ──────────────────────────────────────────────────────────
    progress.status  = 'completed';
    progress.message = `Batch complete — ${progress.processedImages} images processed, ${progress.totalDetections} detections found.`;

    await BatchSession.updateOne(
      { batchId },
      {
        $set: {
          status:          'completed',
          uploadIds,
          totalDetections: progress.totalDetections,
          completedAt:     new Date(),
          zipCloudUrl:     zipCloudUrl || null,
        },
      }
    );

    console.log(`[BATCH] ✅ ${batchId.slice(0, 8)} complete — ${progress.processedImages}/${imageFiles.length} images`);

  } catch (err) {
    console.error(`[BATCH] Fatal error for ${batchId.slice(0, 8)}:`, err.message);
    progress.status  = 'failed';
    progress.message = `Batch failed: ${err.message}`;
    await BatchSession.updateOne({ batchId }, { $set: { status: 'failed' } });
  } finally {
    // Clean up temp directory
    const tempDir = path.join(TEMP_BASE, batchId);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log(`[BATCH] Temp dir cleaned: ${tempDir}`);
    }
  }
}

// ── POST /api/batch/upload ─────────────────────────────────────────────────
exports.uploadBatch = async (req, res) => {
  try {
    const { sessionId, farmerId } = req.body;

    if (!sessionId) return res.status(400).json({ error: 'Session ID is required' });
    if (!req.file && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Auth check
    const scanSession = await ScanSession.findOne({ sessionId });
    if (!scanSession) return res.status(404).json({ error: 'Session not found' });
    if (!scanSession.isVerified) return res.status(403).json({ error: 'Session not verified. Complete OTP first.' });

    const farmer = farmerId
      ? await Farmer.findOne({ farmerId })
      : await Farmer.findOne({ email: scanSession.farmerEmail });
    if (!farmer) return res.status(400).json({ error: 'Farmer not found. Re-verify OTP.' });

    const batchId = crypto.randomBytes(16).toString('hex');
    const tempDir = path.join(TEMP_BASE, batchId);
    fs.mkdirSync(tempDir, { recursive: true });

    // ── Collect uploaded files ─────────────────────────────────────────────
    // Supports: single file (req.file) or multiple (req.files)
    const uploadedFiles = req.files
      ? req.files
      : req.file
      ? [req.file]
      : [];

    let imageFiles   = [];
    let zipCloudUrl  = null;
    let originalName = uploadedFiles[0]?.originalname || 'batch';

    for (const uploaded of uploadedFiles) {
      const ext = path.extname(uploaded.originalname).toLowerCase();

      if (ext === '.zip') {
        // ── Extract ZIP ──────────────────────────────────────────────────
        try {
          const zip = new AdmZip(uploaded.path);
          const entries = zip.getEntries();

          for (const entry of entries) {
            if (entry.isDirectory) continue;
            const entryExt = path.extname(entry.entryName).toLowerCase();
            if (!IMAGE_EXTS.has(entryExt)) continue;

            // Flatten directory structure — use just the filename
            const safeName = path.basename(entry.entryName);
            const destPath = path.join(tempDir, safeName);
            zip.extractEntryTo(entry, tempDir, false, true);
            if (fs.existsSync(destPath)) imageFiles.push(destPath);
          }

          console.log(`[BATCH] ZIP extracted: ${imageFiles.length} images from ${uploaded.originalname}`);

          // Upload original ZIP to Cloudinary (non-blocking)
          uploadRaw(uploaded.path, 'aeroguard/zips').then((r) => {
            if (r?.secure_url) {
              zipCloudUrl = r.secure_url;
              BatchSession.updateOne({ batchId }, { $set: { zipCloudUrl: r.secure_url } }).catch(() => {});
              console.log(`[BATCH] ZIP uploaded to Cloudinary: ${r.secure_url}`);
            }
          });

        } catch (zipErr) {
          console.error('[BATCH] ZIP extraction failed:', zipErr.message);
          return res.status(400).json({ error: `ZIP extraction failed: ${zipErr.message}` });
        }

      } else if (IMAGE_EXTS.has(ext)) {
        // ── Direct image upload ──────────────────────────────────────────
        const destPath = path.join(tempDir, path.basename(uploaded.path));
        fs.copyFileSync(uploaded.path, destPath);
        imageFiles.push(destPath);
      }
    }

    if (imageFiles.length === 0) {
      return res.status(400).json({ error: 'No valid images found. Upload .jpg/.jpeg/.png files or a ZIP containing them.' });
    }

    // ── Create BatchSession ────────────────────────────────────────────────
    await BatchSession.create({
      batchId,
      authSessionId:    sessionId,
      farmerId:         farmer._id,
      farmerEmail:      farmer.email,
      originalFileName: originalName,
      totalImages:      imageFiles.length,
      processedImages:  0,
      failedImages:     0,
      status:           'queued',
      uploadIds:        [],
    });

    // ── Initialise in-memory progress ──────────────────────────────────────
    batchProgress[batchId] = {
      batchId,
      status:          'queued',
      totalImages:     imageFiles.length,
      processedImages: 0,
      failedImages:    0,
      totalDetections: 0,
      currentFile:     '',
      message:         `Queued — ${imageFiles.length} images ready to process`,
      humidity:        null,
    };

    // ── Respond immediately — processing runs in background ───────────────
    res.status(202).json({
      message:     'Batch accepted — processing started',
      batchId,
      totalImages: imageFiles.length,
      pollUrl:     `/api/batch/${batchId}/progress`,
    });

    // ── Start async processing (non-blocking) ─────────────────────────────
    processBatch(batchId, imageFiles, farmer, sessionId, zipCloudUrl).catch((err) => {
      console.error('[BATCH] Unhandled error in processBatch:', err);
    });

  } catch (error) {
    console.error('[BATCH UPLOAD] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/batch/:batchId/progress ──────────────────────────────────────
exports.getBatchProgress = async (req, res) => {
  const { batchId } = req.params;

  // Try in-memory first (fastest)
  const mem = batchProgress[batchId];
  if (mem) return res.status(200).json(mem);

  // Fall back to DB (after server restart)
  try {
    const batch = await BatchSession.findOne({ batchId });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    return res.status(200).json({
      batchId:         batch.batchId,
      status:          batch.status,
      totalImages:     batch.totalImages,
      processedImages: batch.processedImages,
      failedImages:    batch.failedImages,
      totalDetections: batch.totalDetections,
      message:         `${batch.processedImages}/${batch.totalImages} images processed`,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/batch/:batchId/results ───────────────────────────────────────
exports.getBatchResults = async (req, res) => {
  const { batchId } = req.params;
  try {
    const sessions = await AnalysisSession.find({ batchId })
      .populate('farmerId', 'email farmerId')
      .lean();

    return res.status(200).json({
      batchId,
      count:    sessions.length,
      sessions,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
