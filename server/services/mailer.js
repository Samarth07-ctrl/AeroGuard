const nodemailer = require('nodemailer');

function buildTransport() {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD
    }
  });
}

async function sendOtpEmail(toEmail, otp) {
  const transporter = buildTransport();
  if (!transporter) {
    throw new Error('Email service not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env');
  }

  const info = await transporter.sendMail({
    from: process.env.GMAIL_FROM || process.env.GMAIL_USER,
    to: toEmail,
    subject: 'AeroGuard Secure OTP Verification',
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;background:#f0fdf4;padding:24px;border-radius:16px;color:#1f2937;">
        <h2 style="color:#15803d;margin:0 0 8px;">AeroGuard OTP Verification</h2>
        <p style="margin:0 0 12px;">Your one-time verification code is:</p>
        <div style="font-size:30px;font-weight:800;letter-spacing:6px;color:#14532d;background:white;border-radius:12px;padding:10px 14px;display:inline-block;">
          ${otp}
        </div>
        <p style="margin:14px 0 0;">This code expires in <strong>10 minutes</strong>.</p>
        <p style="margin:6px 0 0;color:#4b5563;">If you did not request this, please ignore this email.</p>
      </div>
    `
  });

  return info;
}

module.exports = { sendOtpEmail };
