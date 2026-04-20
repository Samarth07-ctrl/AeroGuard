# AeroGuard Database Scripts

This folder contains utility scripts for database diagnostics and migrations.

## Available Scripts

### 1. diagnose-database.js

**Purpose:** Comprehensive database health check and diagnostic tool

**Usage:**
```bash
node server/scripts/diagnose-database.js
```

**What it checks:**
- Total farmers and their verification status
- OTP sessions (ScanSession records)
- Batch uploads (BatchSession records)
- Analysis sessions (individual image records)
- Records missing farmerEmail (orphaned records)
- Breakdown of sessions by farmer
- Latest uploads and their details

**When to use:**
- After uploading files to verify they were saved correctly
- When farmer workspaces aren't showing all images
- To check database health after system updates
- To identify orphaned or incomplete records

**Example output:**
```
🔍 AeroGuard Database Diagnostic Tool

✅ Connected to MongoDB

═══════════════════════════════════════
📊 FARMERS
═══════════════════════════════════════
Total farmers: 3

Farmer: farmer1@example.com
  ID: FARM-A1B2C3D4
  Verified: true
  Created: 2026-04-17T10:30:00.000Z

...

═══════════════════════════════════════
📋 SUMMARY
═══════════════════════════════════════
Farmers: 3
OTP Sessions: 5
Batch Uploads: 2
Analysis Sessions: 47
  - With diseases: 42
  - Verified: 42
  - Missing farmerEmail: 0 ✅

✅ Database looks healthy!
```

---

### 2. migrate-farmer-email.js

**Purpose:** Fix AnalysisSession records that are missing the farmerEmail field

**Usage:**
```bash
node server/scripts/migrate-farmer-email.js
```

**What it does:**
- Finds all AnalysisSession records without farmerEmail
- Looks up the farmer's email from the farmerId reference
- Updates the record with the correct farmerEmail
- Reports success/failure for each record

**When to use:**
- After running diagnose-database.js and finding orphaned records
- After upgrading from an older version that didn't set farmerEmail
- When farmer workspaces show 0 images despite uploads being successful

**Example output:**
```
🔧 AeroGuard Database Migration: Populate farmerEmail

✅ Connected to MongoDB

Found 15 records missing farmerEmail

✅ Fixed session a1b2c3d4e5f6... → farmer1@example.com
✅ Fixed session f6e5d4c3b2a1... → farmer2@example.com
...

═══════════════════════════════════════
📊 MIGRATION SUMMARY
═══════════════════════════════════════
Total records processed: 15
Successfully fixed: 15
Failed: 0
═══════════════════════════════════════

✅ Migration complete! Farmer workspaces should now show all images.
```

---

## Common Issues and Solutions

### Issue: Farmer workspace shows 0 images after ZIP upload

**Diagnosis:**
```bash
node server/scripts/diagnose-database.js
```

Look for:
- "Missing farmerEmail: X ⚠️" in the summary
- Records in the "ORPHANED RECORDS CHECK" section

**Solution:**
```bash
node server/scripts/migrate-farmer-email.js
```

---

### Issue: Disease count stuck at a specific number

**Diagnosis:**
```bash
node server/scripts/diagnose-database.js
```

Look for:
- "Breakdown by farmer" section - check if all farmers have the expected number of sessions
- "Latest 10 analysis sessions" - verify diseases are being saved

**Possible causes:**
1. Frontend is querying the wrong endpoint
2. farmerEmail is missing on some records (run migration)
3. Diseases aren't passing the confidence gate (check C++ engine logs)

---

### Issue: Batch upload completed but images don't appear

**Diagnosis:**
```bash
node server/scripts/diagnose-database.js
```

Check:
1. "BATCH SESSIONS" section - verify batch status is "completed"
2. "Upload IDs" count matches "totalImages"
3. "ANALYSIS SESSIONS" section - verify count increased by the number of images uploaded

**If batch shows completed but analysis sessions weren't created:**
- Check server logs for errors during batch processing
- Verify the C++ engine is running and accessible
- Check that the farmer exists in the database

---

## Environment Setup

Both scripts require:

1. **MongoDB connection:**
   - Set `MONGO_URI` in `server/.env`
   - Default: `mongodb://localhost:27017/aeroguard`

2. **Node.js dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Run from project root:**
   ```bash
   # From project root directory
   node server/scripts/diagnose-database.js
   node server/scripts/migrate-farmer-email.js
   ```

---

## Development Notes

### Adding New Scripts

When creating new diagnostic or migration scripts:

1. Use the same connection pattern:
   ```javascript
   require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
   const mongoose = require('mongoose');
   ```

2. Always disconnect at the end:
   ```javascript
   finally {
     await mongoose.disconnect();
   }
   ```

3. Provide clear console output with emojis for visual scanning
4. Include error handling for each operation
5. Add documentation to this README

### Testing Scripts

Before running on production:
1. Test on a development database first
2. Back up your database: `mongodump --db aeroguard`
3. Verify the script's logic with a small dataset
4. Check the output carefully before confirming changes

---

## Troubleshooting

### "Cannot connect to MongoDB"

**Check:**
- MongoDB is running: `mongosh` or `mongo`
- Connection string in `.env` is correct
- Network/firewall isn't blocking the connection

### "Module not found"

**Solution:**
```bash
cd server
npm install
```

### "Permission denied"

**Solution:**
```bash
# On Unix/Mac
chmod +x server/scripts/*.js

# Or run with node explicitly
node server/scripts/diagnose-database.js
```

---

## Support

If you encounter issues:

1. Run the diagnostic script first
2. Check server logs for errors
3. Verify MongoDB is accessible
4. Check that all environment variables are set correctly

For more help, see the main project documentation or FIXES_APPLIED.md
