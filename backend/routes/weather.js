const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const weatherService = require('../services/weatherService');

// @route   GET /api/weather
// @desc    Get weather forecast for a location to postpone irrigation if needed
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { lat = 11.5742, lon = 37.3614 } = req.query; // Default to Bahir Dar
    
    const weatherData = await weatherService.getForecast(lat, lon);
    res.json(weatherData);
  } catch (error) {
    console.error('Weather Route Error:', error);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

module.exports = router;
