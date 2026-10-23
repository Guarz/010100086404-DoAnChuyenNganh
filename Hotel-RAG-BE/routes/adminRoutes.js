// File: routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const {
  getUsers,
  updateUserStatus,
  getPendingHotels,
  approveHotel
} = require('../controllers/adminController');
const authenticateToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');

router.get('/users', authenticateToken, requireRole('Admin'), getUsers);
router.put('/users/:userId/status', authenticateToken, requireRole('Admin'), updateUserStatus);
router.get('/hotels/pending', authenticateToken, requireRole('Admin'), getPendingHotels);
router.put('/hotels/:id/approve', authenticateToken, requireRole('Admin'), approveHotel);

module.exports = router;