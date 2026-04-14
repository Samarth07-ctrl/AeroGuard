const ScanSession = require('../models/ScanSession');

// ──────────────────────────────────────────
// POST /api/webhook/results
// Callback endpoint for the C++ engine.
// Updates ScanSession with disease results
// and fires a mock Firebase push notification.
// ──────────────────────────────────────────
exports.handleResultsWebhook = async (req, res) => {
  try {
    const { sessionId, results } = req.body;

    if (!sessionId || !results) {
      return res.status(400).json({ error: 'Session ID and results array are required' });
    }

    const session = await ScanSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.status = 'completed';
    session.results = results;
    await session.save();

    // Mock Firebase Push Notification to farmer
    console.log(`\n=== MOCK FIREBASE PUSH ===`);
    console.log(`  To:      ${session.farmerEmail}`);
    console.log(`  Title:   Scan Complete. View Map.`);
    console.log(`  Session: ${sessionId}`);
    console.log(`  Results: ${results.length} hotspots detected`);
    console.log(`===========================\n`);

    return res.status(200).json({
      message: 'Webhook processed — session marked completed',
      sessionId,
      resultCount: results.length
    });

  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
