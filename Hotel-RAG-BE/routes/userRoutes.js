// File: routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { getMe, updateMe, changePassword } = require('../controllers/userController');
const { getWishlist, addToWishlist, removeFromWishlist } = require('../controllers/wishlistController');
const { authenticateUser } = require('../middleware/authMiddleware');

router.get('/me', authenticateUser, getMe);
router.put('/me', authenticateUser, updateMe);
router.put('/me/password', authenticateUser, changePassword);

// Danh sách yêu thích
router.get('/me/wishlist', authenticateUser, getWishlist);
router.post('/me/wishlist/:hotelId', authenticateUser, addToWishlist);
router.delete('/me/wishlist/:hotelId', authenticateUser, removeFromWishlist);

module.exports = router;
