const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// ──────────────────────────────────────────
// Multer Configuration
// Stores uploads in /server/uploads with
// unique filenames. Filters for .zip files.
// ──────────────────────────────────────────
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  // Accept .zip and common image formats for MVP flexibility
  const allowed = ['.zip', '.jpg', '.jpeg', '.png', '.tiff', '.tif'];
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} not supported. Upload .zip or image files.`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

// ──────────────────────────────────────────
// Controllers
// ──────────────────────────────────────────
const sessionController = require('../controllers/sessionController');
const uploadController = require('../controllers/uploadController');
const webhookController = require('../controllers/webhookController');
const ScanSession = require('../models/ScanSession');

// ──────────────────────────────────────────
// Auth Routes
// ──────────────────────────────────────────
router.post('/auth/request-otp', sessionController.requestOtp);
router.post('/auth/verify-otp', sessionController.verifyOtp);

// ──────────────────────────────────────────
// Session Status (for frontend polling)
// ──────────────────────────────────────────
router.get('/session/:sessionId', async (req, res) => {
  try {
    const session = await ScanSession.findOne({ sessionId: req.params.sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.json(session);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────
// Upload Route (Secured — requires verified session)
// ──────────────────────────────────────────
router.post('/upload', upload.single('drone_data'), uploadController.uploadImage);

// ──────────────────────────────────────────
// Webhook Route (C++ engine callback)
// ──────────────────────────────────────────
router.post('/webhook/results', webhookController.handleResultsWebhook);

module.exports = router;
