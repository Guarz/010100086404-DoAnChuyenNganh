const express = require('express');
const router = express.Router();
const { searchHotelsWithAI } = require('../controllers/aiController');

router.post('/search', searchHotelsWithAI);

module.exports = router;