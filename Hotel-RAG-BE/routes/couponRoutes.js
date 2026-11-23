// File: routes/couponRoutes.js - mã giảm giá
const express = require('express');
const router = express.Router();
const c = require('../controllers/couponController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');

const managers = [authenticateUser, authorizeRoles('Admin', 'Partner')];

router.get('/available', authenticateUser, c.availableCoupons); // mã khách có thể dùng
router.get('/', managers, c.listCoupons);
router.post('/', managers, c.createCoupon);
router.put('/:id', managers, c.updateCoupon);
router.delete('/:id', managers, c.deleteCoupon);

module.exports = router;
