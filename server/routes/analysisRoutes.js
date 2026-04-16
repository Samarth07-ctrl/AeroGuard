const express = require('express');
const analysisController = require('../controllers/analysisController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authMiddleware, analysisController.getAllAnalysisSessions);
router.get('/map-data', authMiddleware, analysisController.getMapData);
router.get('/risk-prediction', authMiddleware, analysisController.getRiskPrediction);

module.exports = router;
