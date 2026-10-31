// File: routes/reviewRoutes.js
const express = require('express');
const router = express.Router();
const { createReview, getHotelReviews } = require('../controllers/reviewController');
const { authenticateUser } = require('../middleware/authMiddleware');

router.get('/hotel/:hotelId', getHotelReviews); // Công khai
router.post('/', authenticateUser, createReview);

module.exports = router;
