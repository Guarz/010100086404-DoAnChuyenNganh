// File: routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { getPendingHotels, approveHotel } = require('../controllers/adminController');
const authenticateToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');

router.get('/hotels/pending', authenticateToken, requireRole('Admin'), getPendingHotels);
router.put('/hotels/:id/approve', authenticateToken, requireRole('Admin'), approveHotel);

module.exports = router;