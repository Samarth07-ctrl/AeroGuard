const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  fcm_token: { type: String, default: '' },
  name: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
