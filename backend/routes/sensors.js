const express = require('express');
const router = express.Router();
const Sensor = require('../models/Sensor');
const Device = require('../models/Device');
const Farm = require('../models/Farm');
const { protect, authorize, isAdministrator } = require('../middleware/authMiddleware');

async function canAccessDevice(deviceId, user) {
  const device = await Device.findById(deviceId).populate('farmId', 'ownerId');
  return device && (isAdministrator(user) || device.farmId?.ownerId?.toString() === user._id.toString());
}

// @route   GET /api/sensors
// @desc    Get all sensors for a device
// @access  Private
router.get('/', protect, authorize('owner', 'admin', 'farmer'), async (req, res) => {
  try {
    const { deviceId } = req.query;
    let query;
    if (deviceId) {
      if (!await canAccessDevice(deviceId, req.user)) return res.status(403).json({ error: 'You do not have access to this device.' });
      query = { deviceId };
    } else if (isAdministrator(req.user)) {
      query = {};
    } else {
      const farms = await Farm.find({ ownerId: req.user._id }).select('_id');
      const devices = await Device.find({ farmId: { $in: farms.map((farm) => farm._id) } }).select('_id');
      query = { deviceId: { $in: devices.map((device) => device._id) } };
    }
    
    const sensors = await Sensor.find(query);
    res.json(sensors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sensors' });
  }
});

// @route   POST /api/sensors
// @desc    Add a new sensor
// @access  Private
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { deviceId, type, name } = req.body;
    if (!await Device.exists({ _id: deviceId })) return res.status(404).json({ error: 'Device not found' });
    const sensor = new Sensor({ deviceId, type, name });
    await sensor.save();
    res.status(201).json(sensor);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add sensor' });
  }
});

module.exports = router;



