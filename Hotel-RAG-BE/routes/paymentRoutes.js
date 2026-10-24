// File: routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { payBookingDemo } = require('../controllers/paymentController');

// 1. CHỈ GIỮ LẠI ĐÚNG DÒNG NÀY (Bóc tách hàm authenticateUser)
const { authenticateUser } = require('../middleware/authMiddleware');

// 2. ĐỔI TÊN BIẾN thành authenticateUser
router.post('/demo/:bookingId', authenticateUser, payBookingDemo);

module.exports = router;