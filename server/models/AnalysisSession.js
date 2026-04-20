const mongoose = require('mongoose');

const diseaseSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    severity:     { type: String, required: true, trim: true },
    confidence:   { type: Number, default: null },
    lat:          { type: Number, default: null },
    lon:          { type: Number, default: null },
    riskRadius:   { type: Number, default: null },  // metres — epidemiological spread radius
    riskScore:    { type: Number, default: null },  // 0–100 epidemiological risk score
    spreadRadius: { type: Number, default: null },  // alias kept for mobile app compat
  },
  { _id: false }
);

const analysisSessionSchema = new mongoose.Schema(
  {
    sessionId:   { type: String, required: true, trim: true, unique: true, index: true },
    batchId:     { type: String, default: null, index: true },

    farmerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
    // Denormalised email — stored directly so mobile app can query without a join
    farmerEmail: { type: String, default: '', trim: true, lowercase: true, index: true },

    // Local path (kept for C++ engine reference)
    imagePath:   { type: String, required: true, trim: true },
    // Cloudinary URL of the processed image
    imageUrl:    { type: String, default: null },

    // GPS base coordinates extracted from EXIF at upload time (or Pune fallback)
    baseLat:     { type: Number, default: 18.5204 },
    baseLon:     { type: Number, default: 73.8567 },
    gpsSource:   { type: String, enum: ['exif', 'fallback'], default: 'fallback' },

    // GeoJSON Point — enables $near / $geoWithin queries for the mobile app
    // Stored as [lng, lat] per GeoJSON spec. No nested default — set explicitly on create.
    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [73.8567, 18.5204] },
    },

    // true once at least one disease passed the confidence gate
    isVerified:  { type: Boolean, default: false },

    diseases:    { type: [diseaseSchema], default: [] },
    createdAt:   { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// 2dsphere index for geospatial queries
analysisSessionSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('AnalysisSession', analysisSessionSchema);
