// File: routes/adminRoutes.js
const express = require('express');
const router = express.Router();

// 1. Import TẤT CẢ các hàm từ adminController
const {
  getUsers,
  updateUserStatus,
  getPendingHotels,
  approveHotel,
  getRagAnalytics,      // Đã bổ sung
  evaluateGroundedness  // Đã bổ sung
} = require('../controllers/adminController');

// 2. Import Middleware xác thực và phân quyền
// (Lưu ý: Đảm bảo thư mục của bạn tên là 'middleware' hoặc 'middlewares' cho khớp nhé)
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');

// 3. KHAI BÁO ROUTES

// --- QUẢN LÝ USER ---
router.get('/users', authenticateUser, authorizeRoles('Admin'), getUsers);
router.put('/users/:userId/status', authenticateUser, authorizeRoles('Admin'), updateUserStatus);

// --- QUẢN LÝ KHÁCH SẠN ---
router.get('/hotels/pending', authenticateUser, authorizeRoles('Admin'), getPendingHotels);
router.put('/hotels/:id/approve', authenticateUser, authorizeRoles('Admin'), approveHotel);

// --- RAG AI ANALYTICS ---
// Thay verifyAdmin bằng authenticateUser, authorizeRoles('Admin')
router.get('/rag-analytics', authenticateUser, authorizeRoles('Admin'), getRagAnalytics);
router.post('/rag/evaluate', authenticateUser, authorizeRoles('Admin'), evaluateGroundedness);

module.exports = router;