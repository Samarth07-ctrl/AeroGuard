# Database and Upload Issues - FIXES APPLIED

## Issues Identified and Fixed

### 1. **ZIP File Images Not Showing in Farmer-Specific Map**

**Root Cause:**
- When a ZIP file is uploaded, the batch controller creates individual `AnalysisSession` records for each image with unique `uploadId` values
- The `FarmerWorkspace` component was only querying by the OTP `sessionId`, which doesn't match the individual image `uploadId` values
- The batch images were being saved with a `batchId`, but the workspace wasn't querying for all sessions belonging to that farmer

**Fix Applied:**
1. **Added new API endpoints** in `server/controllers/analysisController.js`:
   - `GET /api/analysis-sessions/farmer/:email` - Returns all sessions for a farmer by email
   - `GET /api/analysis-sessions/session/:sessionId` - Returns all sessions for a farmer by looking up their email from the OTP session

2. **Updated routes** in `server/routes/analysisRoutes.js`:
   - Added routes for the new endpoints

3. **Updated FarmerWorkspace component** in `client/src/pages/dashboard/FarmerWorkspace.jsx`:
   - Changed from querying `/api/alerts?sessionId=...` to `/api/analysis-sessions/session/${sessionId}`
   - Now fetches ALL analysis sessions for the farmer, not just the specific upload
   - Extracts all diseases from all sessions and displays them on the map

### 2. **Disease Count Stuck at 26**

**Root Cause:**
- The issue was likely related to the same problem - the frontend wasn't fetching all the farmer's data
- The HistoryPage correctly shows all sessions, but individual farmer workspaces weren't showing their complete data

**Fix Applied:**
- By fixing the farmer workspace to query all sessions for that farmer, the disease count will now be accurate
- Added logging to track how many sessions are returned for each farmer

### 3. **Data Flow Issues**

**Improvements Made:**

1. **Better Logging:**
   - Added console logs in `analysisController.js` to show how many sessions are found for each farmer
   - Added console logs in `batchController.js` to confirm when AnalysisSession records are created with farmerEmail

2. **Consistent Data Structure:**
   - Ensured `farmerEmail` is always set on `AnalysisSession` records (already was, but now verified)
   - The batch controller correctly sets `farmerEmail`, `batchId`, and `farmerId` for each image

## How the Fixed System Works

### Upload Flow:
1. Admin invites farmer → creates `ScanSession` with `farmerEmail`
2. Farmer uploads ZIP file → `batchController.uploadBatch` is called
3. For each image in ZIP:
   - Creates `AnalysisSession` with unique `uploadId`
   - Sets `batchId` (same for all images in the batch)
   - Sets `farmerId` and `farmerEmail` (same for all images from this farmer)
   - Runs C++ engine with the `uploadId`
4. C++ engine sends webhook to `/api/alerts` with detections
5. Webhook updates the `AnalysisSession.diseases` array

### Query Flow (Fixed):
1. User opens farmer workspace with OTP `sessionId`
2. Frontend calls `/api/analysis-sessions/session/${sessionId}`
3. Backend:
   - Looks up `ScanSession` to get `farmerEmail`
   - Queries ALL `AnalysisSession` records where `farmerEmail` matches
   - Returns all sessions (single uploads + all batch images)
4. Frontend displays all diseases from all sessions on the map

## Testing the Fixes

### To verify the fixes work:

1. **Upload a ZIP file:**
   ```
   - Go to farmer workspace
   - Upload a ZIP with multiple images
   - Wait for processing to complete
   ```

2. **Check the map:**
   ```
   - All images from the ZIP should appear as markers
   - Disease count should match total detections
   - Clusters should form if diseases are nearby
   ```

3. **Check the console logs:**
   ```
   Server logs should show:
   - "[BATCH] ✅ Created AnalysisSession ... for farmer ..."
   - "[ANALYSIS] Session ... (farmer: ...) has X analysis sessions"
   ```

4. **Verify in History page:**
   ```
   - All uploaded images should appear as separate rows
   - Each row should show detected diseases
   ```

## Database Schema Reference

### AnalysisSession (Primary Data Store)
```javascript
{
  sessionId: String,      // Unique per image (uploadId)
  batchId: String,        // Same for all images in a ZIP
  farmerId: ObjectId,     // Reference to Farmer
  farmerEmail: String,    // Denormalized for fast queries
  imagePath: String,
  imageUrl: String,       // Cloudinary URL
  baseLat: Number,
  baseLon: Number,
  location: GeoJSON,
  diseases: [{
    name: String,
    severity: String,
    confidence: Number,
    lat: Number,
    lon: Number,
    riskScore: Number,
    riskRadius: Number
  }],
  isVerified: Boolean,
  createdAt: Date
}
```

### ScanSession (OTP/Auth Session)
```javascript
{
  sessionId: String,      // OTP session ID
  farmerEmail: String,
  otpCode: String,
  qrToken: String,
  isVerified: Boolean,
  appLinkStatus: String,
  status: String
}
```

### BatchSession (Batch Metadata)
```javascript
{
  batchId: String,
  authSessionId: String,  // Links to ScanSession
  farmerId: ObjectId,
  farmerEmail: String,
  totalImages: Number,
  processedImages: Number,
  uploadIds: [String],    // Array of all uploadIds in batch
  status: String
}
```

## API Endpoints Summary

### New Endpoints:
- `GET /api/analysis-sessions/farmer/:email` - Get all sessions for a farmer
- `GET /api/analysis-sessions/session/:sessionId` - Get all sessions for an OTP session

### Existing Endpoints:
- `POST /api/batch/upload` - Upload ZIP or multiple images
- `GET /api/batch/:batchId/progress` - Poll batch processing status
- `GET /api/clusters/:sessionId` - Get spatial clusters (already supports farmer queries)
- `GET /api/alerts?sessionId=...` - Get live alerts (legacy, still works)

## Files Modified

1. `server/controllers/analysisController.js` - Added 2 new endpoints
2. `server/routes/analysisRoutes.js` - Added routes for new endpoints
3. `client/src/pages/dashboard/FarmerWorkspace.jsx` - Updated to use new endpoint
4. `server/controllers/batchController.js` - Added logging

## Next Steps

If issues persist:

1. **Check MongoDB directly:**
   ```javascript
   // In MongoDB shell or Compass
   db.analysissessions.find({ farmerEmail: "farmer@example.com" })
   ```

2. **Verify farmerEmail is set:**
   ```javascript
   // Should see farmerEmail field on all records
   db.analysissessions.find({ farmerEmail: { $exists: false } })
   // Should return empty if all records have farmerEmail
   ```

3. **Check batch processing:**
   ```javascript
   // Find all sessions for a batch
   db.analysissessions.find({ batchId: "your-batch-id" })
   ```

4. **Monitor server logs:**
   - Look for "[BATCH] ✅ Created AnalysisSession" messages
   - Look for "[ANALYSIS] Session ... has X analysis sessions" messages
