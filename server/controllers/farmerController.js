const crypto = require('crypto');
const Farmer = require('../models/Farmer');
const ScanSession = require('../models/ScanSession');
const { sendOtpEmail } = require('../services/mailer');

exports.requestOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const sessionId = crypto.randomBytes(16).toString('hex');
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await ScanSession.create({
      sessionId,
      farmerEmail: normalizedEmail,
      otpCode,
      isVerified: false,
      status: 'pending'
    });

    await sendOtpEmail(normalizedEmail, otpCode);

    console.log(`\n=== MOCK FARMER OTP ===`);
    console.log(`To:  ${normalizedEmail}`);
    console.log(`OTP: ${otpCode}`);
    console.log(`Session: ${sessionId}`);
    console.log(`=======================\n`);

    return res.status(200).json({
      message: 'OTP sent successfully',
      sessionId,
      email: normalizedEmail
    });
  } catch (error) {
    console.error('[FARMER] request-otp error:', error);
    if (String(error.message || '').toLowerCase().includes('email service not configured')) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp, sessionId } = req.body;
    if (!email || !otp || !sessionId) {
      return res.status(400).json({ error: 'Email, OTP, and sessionId are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const scanSession = await ScanSession.findOne({ sessionId, farmerEmail: normalizedEmail });
    if (!scanSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const isExpired = Date.now() - new Date(scanSession.createdAt).getTime() > (10 * 60 * 1000);
    if (isExpired) {
      return res.status(410).json({ error: 'OTP expired. Please request a new code.' });
    }

    if (scanSession.otpCode !== String(otp).trim()) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    scanSession.isVerified = true;
    await scanSession.save();

    let farmer = await Farmer.findOne({ email: normalizedEmail });
    if (!farmer) {
      farmer = await Farmer.create({
        farmerId: `FARM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        email: normalizedEmail,
        isVerified: true
      });
    } else if (!farmer.isVerified) {
      farmer.isVerified = true;
      await farmer.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Farmer verified successfully',
      sessionId,
      farmer: {
        id: farmer._id,
        farmerId: farmer.farmerId,
        email: farmer.email,
        isVerified: farmer.isVerified
      }
    });
  } catch (error) {
    console.error('[FARMER] verify-otp error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
