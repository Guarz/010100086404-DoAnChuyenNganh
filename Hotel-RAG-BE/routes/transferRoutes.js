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

module.exports = router;
