// File: routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { getMe, updateMe, changePassword } = require('../controllers/userController');
const { authenticateUser } = require('../middleware/authMiddleware');

router.get('/me', authenticateUser, getMe);
router.put('/me', authenticateUser, updateMe);
router.put('/me/password', authenticateUser, changePassword);

module.exports = router;
