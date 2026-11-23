// File: routes/notificationRoutes.js - thông báo trong trang
const express = require('express');
const router = express.Router();
const c = require('../controllers/notificationController');
const { authenticateUser } = require('../middleware/authMiddleware');

router.get('/', authenticateUser, c.listNotifications);
router.put('/read-all', authenticateUser, c.markAllRead); // đặt trước '/:id/read'
router.put('/:id/read', authenticateUser, c.markRead);

module.exports = router;
