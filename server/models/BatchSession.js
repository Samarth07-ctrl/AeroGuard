/**
 * BatchSession — parent record for a bulk ZIP / multi-image upload.
 *
 * One BatchSession contains many AnalysisSession children (one per image).
 * The frontend polls GET /api/batch/:batchId/progress for live status.
 */
const mongoose = require('mongoose');

const batchSessionSchema = new mongoose.Schema(
  {
    batchId:      { type: String, required: true, unique: true, index: true },
    authSessionId:{ type: String, required: true },          // OTP ScanSession that authorised this batch
    farmerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
    farmerEmail:  { type: String, required: true },

    // Source file info
    originalFileName: { type: String, default: '' },
    zipCloudUrl:      { type: String, default: null },       // Cloudinary URL of the original ZIP

    // Progress tracking
    totalImages:     { type: Number, default: 0 },
    processedImages: { type: Number, default: 0 },
    failedImages:    { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['queued', 'extracting', 'processing', 'syncing', 'completed', 'failed'],
      default: 'queued',
    },

    // Child upload IDs (one per image)
    uploadIds: [{ type: String }],

    // Aggregated risk summary (filled after all images processed)
    totalDetections: { type: Number, default: 0 },
    riskSummary:     { type: mongoose.Schema.Types.Mixed, default: null },

    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { versionKey: false }
);

module.exports = mongoose.model('BatchSession', batchSessionSchema);
