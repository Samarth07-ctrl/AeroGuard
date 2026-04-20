/**
 * Migration Script: Populate farmerEmail on AnalysisSession records
 * 
 * This script fixes AnalysisSession records that are missing the farmerEmail field
 * by looking up the email from the linked Farmer document.
 * 
 * Usage: node server/scripts/migrate-farmer-email.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const AnalysisSession = require('../models/AnalysisSession');
const Farmer = require('../models/Farmer');

async function migrate() {
  try {
    console.log('\n🔧 AeroGuard Database Migration: Populate farmerEmail\n');
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/aeroguard');
    console.log('✅ Connected to MongoDB\n');

    // Find all AnalysisSession records missing farmerEmail
    const orphaned = await AnalysisSession.find({
      $or: [
        { farmerEmail: { $exists: false } },
        { farmerEmail: '' },
        { farmerEmail: null }
      ]
    }).populate('farmerId');

    console.log(`Found ${orphaned.length} records missing farmerEmail\n`);

    if (orphaned.length === 0) {
      console.log('✅ No migration needed - all records have farmerEmail');
      return;
    }

    let fixed = 0;
    let failed = 0;

    for (const session of orphaned) {
      try {
        if (!session.farmerId) {
          console.log(`⚠️  Session ${session.sessionId.slice(0, 12)}... has no farmerId - skipping`);
          failed++;
          continue;
        }

        const farmer = await Farmer.findById(session.farmerId);
        if (!farmer) {
          console.log(`⚠️  Session ${session.sessionId.slice(0, 12)}... farmerId not found - skipping`);
          failed++;
          continue;
        }

        await AnalysisSession.updateOne(
          { _id: session._id },
          { $set: { farmerEmail: farmer.email } }
        );

        console.log(`✅ Fixed session ${session.sessionId.slice(0, 12)}... → ${farmer.email}`);
        fixed++;

      } catch (err) {
        console.error(`❌ Error fixing session ${session.sessionId.slice(0, 12)}...:`, err.message);
        failed++;
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log('📊 MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Total records processed: ${orphaned.length}`);
    console.log(`Successfully fixed: ${fixed}`);
    console.log(`Failed: ${failed}`);
    console.log('═══════════════════════════════════════\n');

    if (fixed > 0) {
      console.log('✅ Migration complete! Farmer workspaces should now show all images.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB\n');
  }
}

migrate();
