const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// ── Multer: supports single file OR array of files, up to 500MB ──────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowed = ['.zip', '.jpg', '.jpeg', '.png', '.tiff', '.tif'];
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error(`File type ${ext} not supported.`), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

// ── Controllers ───────────────────────────────────────────────────────────
const uploadController  = require('../controllers/uploadController');
const batchController   = require('../controllers/batchController');
const webhookController = require('../controllers/webhookController');
const ScanSession       = require('../models/ScanSession');

// ── Session status (frontend polling) ────────────────────────────────────
router.get('/session/:sessionId', async (req, res) => {
  try {
    const session = await ScanSession.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    return res.json(session);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Single-image upload (legacy — kept for backward compat) ──────────────
router.post('/upload', upload.single('drone_data'), uploadController.uploadImage);

// ── Bulk upload: ZIP or multiple images ──────────────────────────────────
// Accepts field name "drone_data" as single OR array (up to 200 files)
router.post(
  '/batch/upload',
  upload.any(),   // accepts any field name, single or multiple
  batchController.uploadBatch
);

// ── Batch progress & results ──────────────────────────────────────────────
router.get('/batch/:batchId/progress', batchController.getBatchProgress);
router.get('/batch/:batchId/results',  batchController.getBatchResults);

// ── C++ engine webhook ────────────────────────────────────────────────────
router.post('/webhook/results', webhookController.handleResultsWebhook);

module.exports = router;
