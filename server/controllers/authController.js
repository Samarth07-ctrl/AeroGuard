const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const signToken = (admin) => jwt.sign(
  { id: admin._id, email: admin.email, role: 'admin' },
  process.env.JWT_SECRET || 'dev_jwt_secret',
  { expiresIn: '7d' }
);

exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await Admin.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'Admin already exists with this email' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await Admin.create({
      email: normalizedEmail,
      password: hashedPassword
    });

    return res.status(201).json({
      message: 'Admin registered successfully',
      admin: { id: admin._id, email: admin.email }
    });
  } catch (error) {
    console.error('[AUTH] Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const admin = await Admin.findOne({ email: normalizedEmail });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(admin);
    return res.status(200).json({
      message: 'Login successful',
      token,
      admin: { id: admin._id, email: admin.email }
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
