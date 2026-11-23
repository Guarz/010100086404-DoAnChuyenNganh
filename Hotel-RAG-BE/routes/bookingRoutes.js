// File: routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const { createBooking, getMyBookings, getBookingById, cancelBooking } = require('../controllers/bookingController');

// 1. SỬA IMPORT: Bóc tách đúng hàm authenticateUser ra khỏi Object
const { authenticateUser } = require('../middleware/authMiddleware');

// 2. ĐỔI TÊN BIẾN: Thay authenticateToken bằng authenticateUser
router.get('/my-bookings', authenticateUser, getMyBookings);
router.post('/', authenticateUser, createBooking);
router.get('/:id', authenticateUser, getBookingById);
router.put('/:id/cancel', authenticateUser, cancelBooking);

// Mã giảm giá cho đơn đang chờ thanh toán
const { applyCoupon, removeCoupon } = require('../controllers/couponController');
router.put('/:id/coupon', authenticateUser, applyCoupon('hotel'));
router.delete('/:id/coupon', authenticateUser, removeCoupon('hotel'));

module.exports = router;