const mongoose = require('mongoose');

const scanSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  farmerEmail: { type: String, required: true },
  otpCode: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed'],
    default: 'pending'
  },
  uploadPath: { type: String, default: '' },
  results: [{
    lat: Number,
    long: Number,
    disease: String,
    severity: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('ScanSession', scanSessionSchema);
