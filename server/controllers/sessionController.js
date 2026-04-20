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

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check if user exists in the system
    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // MVP: auto-register unknown farmers
      user = new User({ email: normalizedEmail, name: normalizedEmail.split('@')[0] });
      await user.save();
      console.log(`[AUTH] New farmer registered: ${normalizedEmail}`);
    }

    // Generate 6-digit OTP (consistent with farmerController)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = crypto.randomBytes(16).toString('hex');
    const qrToken = `aero-qr-${crypto.randomBytes(5).toString('hex')}`;

    const session = new ScanSession({
      sessionId,
      farmerEmail: normalizedEmail,
      otpCode,
      qrToken,
      appLinkStatus: 'pending_app_install',
      isVerified: false,
      status: 'pending'
    });

    await session.save();

    // Mock Firebase Push Notification
    console.log(`\n=== MOCK FIREBASE PUSH ===`);
    console.log(`  To:      ${normalizedEmail}`);
    console.log(`  OTP:     ${otpCode}`);
    console.log(`  Session: ${sessionId}`);
    console.log(`===========================\n`);

    return res.status(200).json({
      message: 'OTP dispatched to farmer device',
      sessionId,
      qrToken,
      otpCode  // Include so admin/debug can see it
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

    const normalizedOtp = String(otpCode).trim();

    const session = await ScanSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    console.log(`[AUTH] Verifying session ${sessionId.slice(0,8)}... stored_otp="${session.otpCode}" received_otp="${normalizedOtp}"`);

    if (session.otpCode !== normalizedOtp) {
      console.log(`[AUTH] ❌ OTP mismatch: stored="${session.otpCode}" received="${normalizedOtp}"`);
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    session.isVerified = true;
    session.appLinkStatus = 'app_linked';
    await session.save();

    console.log(`[AUTH] ✅ Session ${sessionId.slice(0, 8)}... verified successfully`);

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
