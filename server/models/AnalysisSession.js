const mongoose = require('mongoose');

const diseaseSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true },
    severity:   { type: String, required: true, trim: true },
    confidence: { type: Number, default: null },
    lat:        { type: Number, default: null },
    lon:        { type: Number, default: null }
  },
  { _id: false }
);

const analysisSessionSchema = new mongoose.Schema(
  {
    sessionId:  { type: String, required: true, trim: true, unique: true, index: true },
    farmerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
    imagePath:  { type: String, required: true, trim: true },
    // GPS base coordinates extracted from EXIF at upload time (or Pune fallback)
    baseLat:    { type: Number, default: 18.5204 },
    baseLon:    { type: Number, default: 73.8567 },
    gpsSource:  { type: String, enum: ['exif', 'fallback'], default: 'fallback' },
    diseases:   { type: [diseaseSchema], default: [] },
    createdAt:  { type: Date, default: Date.now }
  },
  { versionKey: false }
);

module.exports = mongoose.model('AnalysisSession', analysisSessionSchema);
