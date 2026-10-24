// File: routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const { createBooking, getMyBookings } = require('../controllers/bookingController');

// 1. SỬA IMPORT: Bóc tách đúng hàm authenticateUser ra khỏi Object
const { authenticateUser } = require('../middleware/authMiddleware');

// 2. ĐỔI TÊN BIẾN: Thay authenticateToken bằng authenticateUser
router.get('/my-bookings', authenticateUser, getMyBookings);
router.post('/', authenticateUser, createBooking);

module.exports = router;