// File: routes/partnerRoutes.js
const express = require('express');
const router = express.Router();
const { createHotel } = require('../controllers/partnerController');
const { createRoomType } = require('../controllers/partnerController');
const { updateInventory } = require('../controllers/partnerController');
const {
  applyForPartner,
  getApplicationStatus,
  getPendingPartnerApplications,
  reviewPartnerApplication
} = require('../controllers/partnerController');
const authenticateToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');

router.get('/application-status', authenticateToken, getApplicationStatus);
router.post('/apply', authenticateToken, applyForPartner);
router.get('/applications/pending', authenticateToken, requireRole('Admin'), getPendingPartnerApplications);
router.put('/applications/:userId/:decision', authenticateToken, requireRole('Admin'), reviewPartnerApplication);

router.post('/hotels', authenticateToken, requireRole('Partner', 'Admin'), createHotel);
router.post('/hotels/:hotelId/rooms', authenticateToken, requireRole('Partner', 'Admin'), createRoomType);
router.put('/inventory/:inventoryId', authenticateToken, requireRole('Partner', 'Admin'), updateInventory);

module.exports = router;