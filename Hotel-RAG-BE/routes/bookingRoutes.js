// File: routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const { createBooking } = require('../controllers/bookingController');

// Route: POST /api/bookings
router.post('/', createBooking);

module.exports = router;