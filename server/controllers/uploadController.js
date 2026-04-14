const ScanSession = require('../models/ScanSession');

// ──────────────────────────────────────────
// Mock C++ Engine
// Simulates heavy image processing. After
// 5 seconds, triggers /api/webhook/results
// with dummy disease coordinate data.
// ──────────────────────────────────────────
const startCppEngine = (sessionId) => {
  console.log(`[C++ WAITING] UI initiated upload for session ${sessionId.slice(0, 8)}...`);
  console.log(`[WAITING] The frontend is now loading securely. Node.js is waiting for your C++ Visual Studio project to process the image and fire the Webhook...`);
  // The React UI will now poll forever until the C++ Engine executes the real alert!
};

// ──────────────────────────────────────────
// POST /api/upload
// Secured route. Accepts .zip file via Multer.
// body must include sessionId. Rejects 403
// if isVerified is false. Saves to /uploads.
// ──────────────────────────────────────────
exports.uploadImage = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = await ScanSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.isVerified) {
      return res.status(403).json({ error: 'Session not verified. Complete OTP handshake first.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    session.uploadPath = req.file.path;
    session.status = 'processing';
    await session.save();

    console.log(`[UPLOAD] File saved: ${req.file.path} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Trigger mock C++ processing pipeline
    startCppEngine(sessionId);

    return res.status(200).json({
      message: 'Upload successful, processing started',
      sessionId,
      filePath: req.file.path
    });

  } catch (error) {
    console.error('[UPLOAD] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
