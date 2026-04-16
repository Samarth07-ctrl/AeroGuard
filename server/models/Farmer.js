const mongoose = require('mongoose');

const farmerSchema = new mongoose.Schema(
  {
    farmerId: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    isVerified: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Farmer', farmerSchema);
