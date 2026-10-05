// File: routes/hotelRoutes.js
const express = require('express');
const router = express.Router();
const { getAllHotels, getHotelById } = require('../controllers/hotelController');

// Route: GET /api/hotels
router.get('/', getAllHotels);

// Route: GET /api/hotels/:id
router.get('/:id', getHotelById);

module.exports = router;