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
  getMyHotels,
  toggleRoomStatus,
  checkInventory,
  getPartnerBookings,
  completePartnerBooking
} = require('../controllers/partnerController');

// Import đúng tên 2 hàm từ Middleware
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const { requireHotelOwnership, requireRoomOwnership } = require('../middleware/ownershipMiddleware');

const partnerOnly = [authenticateUser, authorizeRoles('Partner', 'Admin')];
const ownsHotelParam = requireHotelOwnership((req) => req.params.hotelId);
const ownsRoomParam = requireRoomOwnership((req) => req.params.roomId);
const ownsRoomBody = requireRoomOwnership((req) => req.body.roomTypeId);

router.get('/application-status', authenticateUser, getApplicationStatus);
router.post('/apply', authenticateUser, applyForPartner);
router.get('/applications/pending', authenticateUser, authorizeRoles('Admin'), getPendingPartnerApplications);
router.put('/applications/:userId/:decision', authenticateUser, authorizeRoles('Admin'), reviewPartnerApplication);

router.post('/hotels', authenticateUser, authorizeRoles('Partner', 'Admin'), createHotel);
router.get('/hotels', authenticateUser, authorizeRoles('Partner', 'Admin'), getMyHotels);
router.post('/hotels/:hotelId/rooms', partnerOnly, ownsHotelParam, createRoomType);
router.put('/rooms/:roomId/toggle', partnerOnly, ownsRoomParam, toggleRoomStatus);

router.put('/inventory', partnerOnly, ownsRoomBody, updateInventory);
router.get('/inventory/check/:roomId', partnerOnly, ownsRoomParam, checkInventory);

router.get('/bookings', authenticateUser, authorizeRoles('Partner', 'Admin'), getPartnerBookings);
router.put('/bookings/:id/complete', authenticateUser, authorizeRoles('Partner', 'Admin'), completePartnerBooking);

module.exports = router;