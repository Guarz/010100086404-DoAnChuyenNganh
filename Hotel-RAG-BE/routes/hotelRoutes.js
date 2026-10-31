// File: routes/hotelRoutes.js
const express = require('express');
const router = express.Router();
const { getAllHotels, getHotelById, getRoomsByHotel, searchHotels, getFeaturedHotels } = require('../controllers/hotelController');

router.get('/', getAllHotels);
router.get('/search', searchHotels);
router.get('/featured', getFeaturedHotels); // Phải đặt trước '/:id', nếu không 'featured' bị hiểu là id
router.get('/:id', getHotelById);
router.get('/:id/rooms', getRoomsByHotel);

module.exports = router;