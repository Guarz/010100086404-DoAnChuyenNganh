// File: routes/partnerRoutes.js
const express = require('express');
const router = express.Router();
const { createHotel } = require('../controllers/partnerController');
const { createRoomType } = require('../controllers/partnerController');
const { updateInventory } = require('../controllers/partnerController');

// Route cho Partner (Nên có middleware check Role là Partner trong tương lai)
router.post('/hotels', createHotel);
router.post('/hotels/:hotelId/rooms', createRoomType);
router.put('/inventory/:inventoryId', updateInventory);

module.exports = router;