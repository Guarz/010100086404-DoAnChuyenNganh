// File: routes/transferRoutes.js - API đặt xe đưa đón cho KHÁCH HÀNG
const express = require('express');
const router = express.Router();
const c = require('../controllers/transferController');
const { authenticateUser } = require('../middleware/authMiddleware');

router.get('/provinces', c.getProvinces); // Công khai: 63 tỉnh + số tuyến
router.get('/search', c.searchTransfers); // Công khai
router.get('/my', authenticateUser, c.getMyTransfers); // Phải đặt trước '/:id'
router.post('/', authenticateUser, c.createTransfer);
router.get('/:id', authenticateUser, c.getTransferById);
router.put('/:id/cancel', authenticateUser, c.cancelTransfer);

// Mã giảm giá cho đơn xe đang chờ thanh toán
const { applyCoupon, removeCoupon } = require('../controllers/couponController');
router.put('/:id/coupon', authenticateUser, applyCoupon('transfer'));
router.delete('/:id/coupon', authenticateUser, removeCoupon('transfer'));

module.exports = router;
