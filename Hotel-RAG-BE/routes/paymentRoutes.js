const express = require('express');
const router = express.Router();
const { payBookingDemo } = require('../controllers/paymentController');
const authenticateToken = require('../middleware/authMiddleware');

router.post('/demo/:bookingId', authenticateToken, payBookingDemo);

module.exports = router;
