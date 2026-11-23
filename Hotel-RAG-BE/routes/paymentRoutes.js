const express = require('express');
const router = express.Router();

// 1. Import đúng 2 hàm VNPay từ paymentController
const {
  createVNPayUrl,
  vnpayReturn,
  createMoMoUrl,
  momoReturn,
  momoIpn
} = require('../controllers/paymentController');

// 2. Import middleware xác thực (Để biết ai đang thanh toán)
const { authenticateUser } = require('../middleware/authMiddleware');

// 3. Khai báo các Routes thanh toán
// Tạo URL thanh toán (Cần đăng nhập)
router.post('/vnpay/create_url', authenticateUser, createVNPayUrl);

// VNPay trả kết quả về (Không cần middleware vì do Server VNPay gọi)
router.get('/vnpay/return', vnpayReturn);

// MoMo: tạo link (cần đăng nhập), trình duyệt quay lại, IPN do server MoMo gọi
router.post('/momo/create_url', authenticateUser, createMoMoUrl);
router.get('/momo/return', momoReturn);
router.post('/momo/ipn', momoIpn);

module.exports = router;