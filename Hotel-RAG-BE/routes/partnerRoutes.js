// File: routes/partnerRoutes.js
const express = require('express');
const router = express.Router();

// Gom gọn các hàm import từ partnerController
const { 
  createHotel, 
  createRoomType, 
  updateInventory,
  applyForPartner,
  getApplicationStatus,
  getPendingPartnerApplications,
  reviewPartnerApplication,
  getMyHotels
} = require('../controllers/partnerController');

// Import đúng tên 2 hàm từ Middleware
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/application-status', authenticateUser, getApplicationStatus);
router.post('/apply', authenticateUser, applyForPartner);
router.get('/applications/pending', authenticateUser, authorizeRoles('Admin'), getPendingPartnerApplications);
router.put('/applications/:userId/:decision', authenticateUser, authorizeRoles('Admin'), reviewPartnerApplication);

router.post('/hotels', authenticateUser, authorizeRoles('Partner', 'Admin'), createHotel);
router.get('/hotels', authenticateUser, authorizeRoles('Partner', 'Admin'), getMyHotels);
router.post('/hotels/:hotelId/rooms', authenticateUser, authorizeRoles('Partner', 'Admin'), createRoomType);
router.put('/inventory/:inventoryId', authenticateUser, authorizeRoles('Partner', 'Admin'), updateInventory);

module.exports = router;