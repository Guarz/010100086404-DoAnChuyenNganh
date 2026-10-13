// File: routes/hotelRoutes.js
const express = require('express');
const router = express.Router();
const { getAllHotels, getHotelById, searchHotels } = require('../controllers/hotelController');

// Route: GET /api/hotels
router.get('/', getAllHotels);
router.get('/search', searchHotels);
// Route: GET /api/hotels/:id
router.get('/:id', getHotelById);

module.exports = router;