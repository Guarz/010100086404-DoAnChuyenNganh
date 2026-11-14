// File: routes/hotelRoutes.js
const express = require('express');
const router = express.Router();
const { getAllHotels, getHotelById, getRoomsByHotel, searchHotels, getFeaturedHotels, getAmenityFacets, getProvinceFacets } = require('../controllers/hotelController');

router.get('/', getAllHotels);
router.get('/search', searchHotels);
router.get('/provinces', getProvinceFacets); // 63 tỉnh/thành + số KS, đặt trước '/:id'
router.get('/amenities', getAmenityFacets); // Phải đặt trước '/:id'
router.get('/featured', getFeaturedHotels); // Phải đặt trước '/:id', nếu không 'featured' bị hiểu là id
router.get('/:id', getHotelById);
router.get('/:id/rooms', getRoomsByHotel);

module.exports = router;