/**
 * Database Diagnostic Script
 * Run this to check the state of your database and identify issues
 * 
 * Usage: node server/scripts/diagnose-database.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const AnalysisSession = require('../models/AnalysisSession');
const ScanSession = require('../models/ScanSession');
const BatchSession = require('../models/BatchSession');
const Farmer = require('../models/Farmer');

async function diagnose() {
  try {
    console.log('\n🔍 AeroGuard Database Diagnostic Tool\n');
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/aeroguard');
    console.log('✅ Connected to MongoDB\n');

    // 1. Check Farmers
    console.log('═══════════════════════════════════════');
    console.log('📊 FARMERS');
    console.log('═══════════════════════════════════════');
    const farmers = await Farmer.find().lean();
    console.log(`Total farmers: ${farmers.length}\n`);
    
    for (const farmer of farmers) {
      console.log(`Farmer: ${farmer.email}`);
      console.log(`  ID: ${farmer.farmerId}`);
      console.log(`  Verified: ${farmer.isVerified}`);
      console.log(`  Created: ${farmer.createdAt}\n`);
    }

    // 2. Check ScanSessions (OTP sessions)
    console.log('═══════════════════════════════════════');
    console.log('📊 SCAN SESSIONS (OTP Sessions)');
    console.log('═══════════════════════════════════════');
    const scanSessions = await ScanSession.find().sort({ createdAt: -1 }).limit(10).lean();
    console.log(`Total scan sessions: ${await ScanSession.countDocuments()}`);
    console.log(`Showing latest 10:\n`);
    
    for (const session of scanSessions) {
      console.log(`Session: ${session.sessionId.slice(0, 12)}...`);
      console.log(`  Email: ${session.farmerEmail}`);
      console.log(`  Verified: ${session.isVerified}`);
      console.log(`  Status: ${session.status}`);
      console.log(`  App Link: ${session.appLinkStatus}`);
      console.log(`  Created: ${session.createdAt}\n`);
    }

    // 3. Check BatchSessions
    console.log('═══════════════════════════════════════');
    console.log('📊 BATCH SESSIONS (ZIP Uploads)');
    console.log('═══════════════════════════════════════');
    const batches = await BatchSession.find().sort({ createdAt: -1 }).limit(10).lean();
    console.log(`Total batch sessions: ${await BatchSession.countDocuments()}`);
    console.log(`Showing latest 10:\n`);
    
    for (const batch of batches) {
      console.log(`Batch: ${batch.batchId.slice(0, 12)}...`);
      console.log(`  Farmer: ${batch.farmerEmail}`);
      console.log(`  Status: ${batch.status}`);
      console.log(`  Images: ${batch.processedImages}/${batch.totalImages}`);
      console.log(`  Detections: ${batch.totalDetections}`);
      console.log(`  Upload IDs: ${batch.uploadIds?.length || 0}`);
      console.log(`  Created: ${batch.createdAt}\n`);
    }

    // 4. Check AnalysisSessions
    console.log('═══════════════════════════════════════');
    console.log('📊 ANALYSIS SESSIONS (Individual Images)');
    console.log('═══════════════════════════════════════');
    const totalAnalysis = await AnalysisSession.countDocuments();
    const withFarmerEmail = await AnalysisSession.countDocuments({ farmerEmail: { $exists: true, $ne: '' } });
    const withoutFarmerEmail = await AnalysisSession.countDocuments({ $or: [{ farmerEmail: { $exists: false } }, { farmerEmail: '' }] });
    const withDiseases = await AnalysisSession.countDocuments({ 'diseases.0': { $exists: true } });
    const verified = await AnalysisSession.countDocuments({ isVerified: true });
    
    console.log(`Total analysis sessions: ${totalAnalysis}`);
    console.log(`  With farmerEmail: ${withFarmerEmail}`);
    console.log(`  WITHOUT farmerEmail: ${withoutFarmerEmail} ⚠️`);
    console.log(`  With diseases: ${withDiseases}`);
    console.log(`  Verified: ${verified}\n`);

    // Show breakdown by farmer
    console.log('Breakdown by farmer:');
    const byFarmer = await AnalysisSession.aggregate([
      { $match: { farmerEmail: { $exists: true, $ne: '' } } },
      { $group: { 
        _id: '$farmerEmail', 
        count: { $sum: 1 },
        withDiseases: { $sum: { $cond: [{ $gt: [{ $size: '$diseases' }, 0] }, 1, 0] } }
      }},
      { $sort: { count: -1 } }
    ]);
    
    for (const group of byFarmer) {
      console.log(`  ${group._id}: ${group.count} sessions (${group.withDiseases} with diseases)`);
    }
    console.log();

    // Show latest 10 analysis sessions
    console.log('Latest 10 analysis sessions:');
    const latestAnalysis = await AnalysisSession.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('farmerId', 'email')
      .lean();
    
    for (const session of latestAnalysis) {
      console.log(`\nSession: ${session.sessionId.slice(0, 12)}...`);
      console.log(`  Farmer Email (denorm): ${session.farmerEmail || '❌ MISSING'}`);
      console.log(`  Farmer ID: ${session.farmerId?.email || '❌ MISSING'}`);
      console.log(`  Batch ID: ${session.batchId ? session.batchId.slice(0, 12) + '...' : 'N/A'}`);
      console.log(`  Diseases: ${session.diseases?.length || 0}`);
      console.log(`  Verified: ${session.isVerified}`);
      console.log(`  GPS Source: ${session.gpsSource}`);
      console.log(`  Created: ${session.createdAt}`);
      
      if (session.diseases && session.diseases.length > 0) {
        console.log(`  Disease details:`);
        for (const d of session.diseases) {
          console.log(`    - ${d.name} (${d.severity}) @ ${d.lat}, ${d.lon}`);
        }
      }
    }

    // 5. Check for orphaned records
    console.log('\n═══════════════════════════════════════');
    console.log('🔍 ORPHANED RECORDS CHECK');
    console.log('═══════════════════════════════════════');
    
    const orphanedAnalysis = await AnalysisSession.find({
      $or: [
        { farmerEmail: { $exists: false } },
        { farmerEmail: '' },
        { farmerEmail: null }
      ]
    }).lean();
    
    if (orphanedAnalysis.length > 0) {
      console.log(`⚠️  Found ${orphanedAnalysis.length} AnalysisSession records WITHOUT farmerEmail:`);
      for (const session of orphanedAnalysis.slice(0, 5)) {
        console.log(`  - ${session.sessionId.slice(0, 12)}... (created: ${session.createdAt})`);
      }
      console.log('\n💡 These records will NOT appear in farmer workspaces!');
      console.log('   Consider running a migration to populate farmerEmail from farmerId.');
    } else {
      console.log('✅ No orphaned records found - all AnalysisSessions have farmerEmail');
    }

    // 6. Summary
    console.log('\n═══════════════════════════════════════');
    console.log('📋 SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Farmers: ${farmers.length}`);
    console.log(`OTP Sessions: ${await ScanSession.countDocuments()}`);
    console.log(`Batch Uploads: ${await BatchSession.countDocuments()}`);
    console.log(`Analysis Sessions: ${totalAnalysis}`);
    console.log(`  - With diseases: ${withDiseases}`);
    console.log(`  - Verified: ${verified}`);
    console.log(`  - Missing farmerEmail: ${withoutFarmerEmail} ${withoutFarmerEmail > 0 ? '⚠️' : '✅'}`);

    if (withoutFarmerEmail > 0) {
      console.log('\n⚠️  ACTION REQUIRED:');
      console.log('   Some AnalysisSession records are missing farmerEmail.');
      console.log('   Run the migration script to fix this:');
      console.log('   node server/scripts/migrate-farmer-email.js');
    } else {
      console.log('\n✅ Database looks healthy!');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB\n');
  }
}

diagnose();
