// File: routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const {
  getUsers,
  updateUserStatus,
  getPendingHotels,
  approveHotel
} = require('../controllers/adminController');

// 1. GOM IMPORT: Lấy cả 2 hàm từ chung một file authMiddleware.js
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');

// 2. CẬP NHẬT BIẾN: Đổi thành authenticateUser và authorizeRoles
router.get('/users', authenticateUser, authorizeRoles('Admin'), getUsers);
router.put('/users/:userId/status', authenticateUser, authorizeRoles('Admin'), updateUserStatus);
router.get('/hotels/pending', authenticateUser, authorizeRoles('Admin'), getPendingHotels);
router.put('/hotels/:id/approve', authenticateUser, authorizeRoles('Admin'), approveHotel);

module.exports = router;