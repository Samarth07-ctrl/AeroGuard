const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true } // hashed password
  },
  { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);
