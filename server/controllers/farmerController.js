const crypto = require('crypto');
const Farmer = require('../models/Farmer');
const ScanSession = require('../models/ScanSession');
const { sendOtpEmail } = require('../services/mailer');

// ── POST /api/farmer/request-otp ──────────────────────────────────────────
// Generates a 6-digit OTP (emailed) AND a secure qrToken (for QR code).
// Both are saved on the ScanSession with appLinkStatus: 'pending_app_install'.
exports.requestOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const sessionId  = crypto.randomBytes(16).toString('hex');
    const otpCode    = Math.floor(100000 + Math.random() * 900000).toString();
    const qrToken    = `aero-qr-${crypto.randomBytes(5).toString('hex')}`;

    await ScanSession.create({
      sessionId,
      farmerEmail:   normalizedEmail,
      otpCode,
      qrToken,
      appLinkStatus: 'pending_app_install',
      isVerified:    false,
      status:        'pending'
    });

    // Try to send email — but NEVER let a mail failure crash the whole request.
    // The admin can still share the QR code even if email is not configured.
    let emailStatus = 'sent';
    try {
      await sendOtpEmail(normalizedEmail, otpCode);
    } catch (mailErr) {
      emailStatus = 'skipped';
      console.warn(`[FARMER] Email not sent (${mailErr.message}) — session still created, QR available.`);
    }

    console.log(`\n=== DUAL HANDSHAKE TICKET ===`);
    console.log(`To:       ${normalizedEmail}`);
    console.log(`OTP:      ${otpCode}`);
    console.log(`QR Token: ${qrToken}`);
    console.log(`Session:  ${sessionId}`);
    console.log(`Email:    ${emailStatus}`);
    console.log(`=============================\n`);

    return res.status(200).json({
      message:     emailStatus === 'sent' ? 'OTP sent successfully' : 'Invite created (email not configured — use QR code)',
      sessionId,
      qrToken,
      otpCode,     // include in response so admin can read it from console/UI if email fails
      emailStatus,
      email:       normalizedEmail
    });
  } catch (error) {
    console.error('[FARMER] request-otp error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── POST /api/farmer/verify-otp ───────────────────────────────────────────
// Supports TWO flows:
//   1. Admin dashboard: sends { email, otp, sessionId } — finds exact session
//   2. Mobile app:      sends { email, otp } (no sessionId) — finds most recent matching session
//   3. QR-via-OTP:      sends { qrToken } — same as verify-qr but through this endpoint
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp, sessionId, qrToken } = req.body;

    // ── QR token shortcut: if the app sends qrToken through this endpoint, handle it ──
    if (qrToken && !otp) {
      console.log(`[VERIFY-OTP] QR token received, delegating to QR flow: ${qrToken}`);
      return exports.verifyQr(req, res);
    }

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedOtp   = String(otp).trim();

    console.log(`\n[VERIFY-OTP] ════════════════════════════════════════`);
    console.log(`  email     = "${normalizedEmail}"`);
    console.log(`  otp       = "${normalizedOtp}" (length=${normalizedOtp.length})`);
    console.log(`  sessionId = ${sessionId || '(none — mobile app flow)'}`);

    let scanSession;

    if (sessionId) {
      // ── Flow 1: Admin dashboard — exact session lookup ──
      // Try exact email match first, then case-insensitive fallback
      scanSession = await ScanSession.findOne({ sessionId, farmerEmail: normalizedEmail });
      if (!scanSession) {
        // Fallback: maybe the session was created with un-normalized email
        scanSession = await ScanSession.findOne({ sessionId });
        if (scanSession) {
          console.log(`  ⚠️  Found session by ID but farmerEmail="${scanSession.farmerEmail}" vs query="${normalizedEmail}"`);
        }
      }
    } else {
      // ── Flow 2: Mobile app — find most recent unverified session for this email + OTP ──
      // Use case-insensitive regex for email to handle casing mismatches
      scanSession = await ScanSession.findOne({
        farmerEmail: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        otpCode:     normalizedOtp,
        isVerified:  false,
      }).sort({ createdAt: -1 });
    }

    if (!scanSession) {
      // ── Debug: show what IS stored for this email so the console reveals the mismatch ──
      const allSessions = await ScanSession.find({
        farmerEmail: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      }).sort({ createdAt: -1 }).limit(5).lean();

      console.log(`  ❌ No matching session found.`);
      console.log(`  📋 Recent sessions for this email (${allSessions.length}):`);
      for (const s of allSessions) {
        console.log(`     session=${s.sessionId.slice(0, 12)} otp_stored="${s.otpCode}" verified=${s.isVerified} age=${Math.round((Date.now() - new Date(s.createdAt).getTime()) / 60000)}min`);
      }

      if (allSessions.length === 0) {
        return res.status(404).json({ error: 'No invite found for this email. Ask the admin to send a new invite.' });
      }

      // Check if all sessions are already verified
      const allVerified = allSessions.every(s => s.isVerified);
      if (allVerified) {
        return res.status(409).json({ error: 'This session is already verified. You can proceed to upload.' });
      }

      // Show explicit mismatch info
      const latestUnverified = allSessions.find(s => !s.isVerified);
      if (latestUnverified) {
        console.log(`  💡 Expected OTP: "${latestUnverified.otpCode}" but received: "${normalizedOtp}"`);
      }

      return res.status(401).json({ error: 'Invalid OTP. Please check the code and try again.' });
    }

    console.log(`  ✅ Session found: ${scanSession.sessionId.slice(0, 12)} otp_stored="${scanSession.otpCode}"`);

    // Check expiry — 30 minutes (extended from 10 for mobile users)
    const ageMs = Date.now() - new Date(scanSession.createdAt).getTime();
    const isExpired = ageMs > (30 * 60 * 1000);
    if (isExpired) {
      console.log(`  ❌ OTP expired (age=${Math.round(ageMs / 60000)}min)`);
      return res.status(410).json({ error: 'OTP expired. Please ask admin to send a new invite.' });
    }

    // For Flow 1 (admin dashboard with sessionId), verify the actual OTP code
    if (sessionId && scanSession.otpCode !== normalizedOtp) {
      console.log(`  ❌ OTP mismatch: stored="${scanSession.otpCode}" received="${normalizedOtp}"`);
      return res.status(401).json({ error: 'Invalid OTP' });
    }
    // For Flow 2 (mobile app), the OTP was already matched in the query above

    scanSession.isVerified    = true;
    scanSession.appLinkStatus = 'app_linked';
    await scanSession.save();

    let farmer = await Farmer.findOne({ email: normalizedEmail });
    if (!farmer) {
      farmer = await Farmer.create({
        farmerId:   `FARM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        email:      normalizedEmail,
        isVerified: true
      });
    } else if (!farmer.isVerified) {
      farmer.isVerified = true;
      await farmer.save();
    }

    console.log(`  ✅ VERIFIED ${normalizedEmail} session=${scanSession.sessionId.slice(0, 8)}`);
    console.log(`[VERIFY-OTP] ════════════════════════════════════════\n`);

    return res.status(200).json({
      success: true,
      message: 'Farmer verified successfully',
      sessionId: scanSession.sessionId,
      farmer: {
        id:         farmer._id,
        farmerId:   farmer.farmerId,
        email:      farmer.email,
        isVerified: farmer.isVerified
      }
    });
  } catch (error) {
    console.error('[FARMER] verify-otp error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── POST /api/farmer/verify-qr ────────────────────────────────────────────
// Mobile app QR verification — farmer scans the QR code, app POSTs the token.
// Marks the session as app_linked without needing the 6-digit OTP.
exports.verifyQr = async (req, res) => {
  try {
    const { qrToken } = req.body;
    if (!qrToken) return res.status(400).json({ error: 'qrToken is required' });

    const scanSession = await ScanSession.findOne({ qrToken });
    if (!scanSession) return res.status(404).json({ error: 'Invalid or expired QR token' });

    const isExpired = Date.now() - new Date(scanSession.createdAt).getTime() > (30 * 60 * 1000);
    if (isExpired) return res.status(410).json({ error: 'QR token expired. Admin must generate a new invite.' });

    scanSession.isVerified    = true;
    scanSession.appLinkStatus = 'app_linked';
    await scanSession.save();

    let farmer = await Farmer.findOne({ email: scanSession.farmerEmail });
    if (!farmer) {
      farmer = await Farmer.create({
        farmerId:   `FARM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        email:      scanSession.farmerEmail,
        isVerified: true
      });
    } else if (!farmer.isVerified) {
      farmer.isVerified = true;
      await farmer.save();
    }

    console.log(`[QR] App linked for ${scanSession.farmerEmail} via QR scan`);

    return res.status(200).json({
      success:   true,
      message:   'App linked successfully via QR code',
      sessionId: scanSession.sessionId,
      farmer: {
        id:         farmer._id,
        farmerId:   farmer.farmerId,
        email:      farmer.email,
        isVerified: farmer.isVerified
      }
    });
  } catch (error) {
    console.error('[FARMER] verify-qr error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
