// File: routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const { createBooking, getMyBookings } = require('../controllers/bookingController');
const authenticateToken = require('../middleware/authMiddleware');

router.get('/mine', authenticateToken, getMyBookings);
router.post('/', authenticateToken, createBooking);

module.exports = router;