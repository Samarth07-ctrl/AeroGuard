const User = require('../models/User');
const ScanSession = require('../models/ScanSession');
const crypto = require('crypto');

// ──────────────────────────────────────────
// POST /api/auth/request-otp
// Accepts email. Checks if User exists.
// Generates 4-digit OTP. Creates ScanSession.
// Returns { sessionId }.
// ──────────────────────────────────────────
exports.requestOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists in the system
    let user = await User.findOne({ email });
    if (!user) {
      // MVP: auto-register unknown farmers
      user = new User({ email, name: email.split('@')[0] });
      await user.save();
      console.log(`[AUTH] New farmer registered: ${email}`);
    }

    // Generate 4-digit OTP
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    const sessionId = crypto.randomBytes(16).toString('hex');

    const session = new ScanSession({
      sessionId,
      farmerEmail: email,
      otpCode,
      isVerified: false,
      status: 'pending'
    });

    await session.save();

    // Mock Firebase Push Notification
    console.log(`\n=== MOCK FIREBASE PUSH ===`);
    console.log(`  To:      ${email}`);
    console.log(`  OTP:     ${otpCode}`);
    console.log(`  Session: ${sessionId}`);
    console.log(`===========================\n`);

    return res.status(200).json({
      message: 'OTP dispatched to farmer device',
      sessionId
    });

  } catch (error) {
    console.error('[AUTH] Error requesting OTP:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ──────────────────────────────────────────
// POST /api/auth/verify-otp
// Accepts sessionId and otpCode.
// If matched, updates isVerified: true.
// Returns { success: true }.
// ──────────────────────────────────────────
exports.verifyOtp = async (req, res) => {
  try {
    const { sessionId, otpCode } = req.body;

    if (!sessionId || !otpCode) {
      return res.status(400).json({ error: 'Session ID and OTP code are required' });
    }

    const session = await ScanSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.otpCode !== otpCode) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    session.isVerified = true;
    await session.save();

    console.log(`[AUTH] Session ${sessionId.slice(0, 8)}... verified successfully`);

    return res.status(200).json({
      success: true,
      message: 'Session verified successfully',
      sessionId
    });

  } catch (error) {
    console.error('[AUTH] Error verifying OTP:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
