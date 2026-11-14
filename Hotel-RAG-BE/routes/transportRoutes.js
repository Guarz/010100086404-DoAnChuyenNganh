// File: routes/transportRoutes.js - API cho NHÀ XE
const express = require('express');
const router = express.Router();
const c = require('../controllers/transportController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const { requireApprovedCompany, requireVehicleOwnership, requireRouteOwnership } = require('../middleware/transportOwnership');

const transportOnly = [authenticateUser, authorizeRoles('Transport', 'Admin')];
const ownsVehicle = requireVehicleOwnership((req) => req.params.vehicleId);
const ownsRoute = requireRouteOwnership((req) => req.params.routeId);

// Hồ sơ nhà xe (mọi tài khoản đăng nhập xem được hồ sơ của mình; chỉ Customer được đăng ký)
router.get('/my-company', authenticateUser, c.getMyCompany);
router.post('/apply', authenticateUser, c.applyCompany);
router.put('/my-company', authenticateUser, authorizeRoles('Transport'), requireApprovedCompany, c.updateMyCompany);

// Loại xe, tuyến, lịch xe
router.get('/vehicles', authenticateUser, authorizeRoles('Transport'), requireApprovedCompany, c.listVehicles);
router.post('/vehicles', authenticateUser, authorizeRoles('Transport'), requireApprovedCompany, c.createVehicle);
router.put('/vehicles/:vehicleId', transportOnly, ownsVehicle, c.updateVehicle);
router.post('/vehicles/:vehicleId/routes', transportOnly, ownsVehicle, c.createRoute);
router.put('/routes/:routeId', transportOnly, ownsRoute, c.updateRoute);
router.get('/vehicles/:vehicleId/inventory', transportOnly, ownsVehicle, c.getVehicleInventory);
router.put('/vehicles/:vehicleId/inventory', transportOnly, ownsVehicle, c.updateVehicleInventory);

// Đơn đặt xe của nhà xe
router.get('/bookings', authenticateUser, authorizeRoles('Transport'), requireApprovedCompany, c.getCompanyBookings);
router.put('/bookings/:id/complete', authenticateUser, authorizeRoles('Transport'), requireApprovedCompany, c.completeCompanyBooking);

module.exports = router;
