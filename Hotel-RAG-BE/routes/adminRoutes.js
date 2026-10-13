// File: routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { getPendingHotels, approveHotel } = require('../controllers/adminController');

// (Lưu ý: Trong thực tế, các route này phải được bảo vệ bằng middleware kiểm tra token (role: Admin). 
// Tạm thời để test API, chúng ta mở public).

router.get('/hotels/pending', getPendingHotels);
router.put('/hotels/:id/approve', approveHotel);

module.exports = router;