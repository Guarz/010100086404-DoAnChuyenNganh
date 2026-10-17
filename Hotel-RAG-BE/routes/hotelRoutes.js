// File: routes/hotelRoutes.js
const express = require('express');
const router = express.Router();
const { getAllHotels, getHotelById, getRoomsByHotel } = require('../controllers/hotelController');

router.get('/', getAllHotels);
router.get('/:id', getHotelById);
router.get('/:id/rooms', getRoomsByHotel);

module.exports = router;