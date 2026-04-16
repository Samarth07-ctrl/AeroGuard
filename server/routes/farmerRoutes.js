const express = require('express');
const farmerController = require('../controllers/farmerController');

const router = express.Router();

router.post('/request-otp', farmerController.requestOtp);
router.post('/verify-otp', farmerController.verifyOtp);

module.exports = router;
