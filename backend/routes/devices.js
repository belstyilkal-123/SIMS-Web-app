const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const Farm = require('../models/Farm');
const { protect, authorize, isAdmin } = require('../middleware/authMiddleware');

const operationalRoles = ['super_administrator', 'office_manager', 'farmer'];

async function accessibleFarmIds(user) {
  if (isAdmin(user)) return null;
  const farms = await Farm.find({ ownerId: user._id }).select('_id');
  return farms.map((farm) => farm._id);
}

async function deviceForUser(deviceId, user) {
  const device = await Device.findById(deviceId).populate('farmId', 'name ownerId');
  if (!device) return null;
  if (isAdmin(user) || device.farmId?.ownerId?.toString() === user._id.toString()) return device;
  return undefined;
}

function withConnectionStatus(device) {
  const result = device.toObject();
  const seconds = result.lastSeen ? Math.floor((Date.now() - new Date(result.lastSeen)) / 1000) : null;
  result.secondsSinceLastSeen = seconds;
  result.isConnected = seconds !== null && seconds < 30;
  return result;
}

// Farmers can view devices assigned to their own farms; administrators can view all.
router.get('/', protect, authorize(...operationalRoles), async (req, res) => {
  try {
    const farmIds = await accessibleFarmIds(req.user);
    const query = farmIds ? { farmId: { $in: farmIds } } : {};
    if (req.query.farmId) {
      if (farmIds && !farmIds.some((id) => id.toString() === req.query.farmId)) {
        return res.status(403).json({ error: 'You do not have access to this farm.' });
      }
      query.farmId = req.query.farmId;
    }
    const devices = await Device.find(query).populate('farmId', 'name');
    res.json(devices.map(withConnectionStatus));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Device inventory changes are reserved for administrators.
router.post('/', protect, authorize('super_administrator'), async (req, res) => {
  try {
    const { farmId, macAddress, name, firmwareVersion } = req.body;
    const farm = await Farm.findById(farmId);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });
    if (!macAddress || !name) return res.status(400).json({ error: 'macAddress and name are required' });
    if (await Device.exists({ macAddress })) return res.status(409).json({ error: 'Device already registered' });
    const device = await Device.create({ farmId, macAddress, name, firmwareVersion });
    res.status(201).json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to register device' });
  }
});

router.put('/:id', protect, authorize('super_administrator'), async (req, res) => {
  try {
    const allowed = ['farmId', 'macAddress', 'name', 'firmwareVersion'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (updates.farmId && !await Farm.exists({ _id: updates.farmId })) return res.status(404).json({ error: 'Farm not found' });
    const device = await Device.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update device' });
  }
});

router.delete('/:id', protect, authorize('super_administrator'), async (req, res) => {
  try {
    const device = await Device.findByIdAndDelete(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json({ message: 'Device removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

router.get('/:id/status', protect, authorize(...operationalRoles), async (req, res) => {
  try {
    const device = await deviceForUser(req.params.id, req.user);
    if (device === undefined) return res.status(403).json({ error: 'You do not have access to this device.' });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    const result = withConnectionStatus(device);
    result.connectionQuality = device.signalStrength > -50 ? 'Excellent' : device.signalStrength > -70 ? 'Good' : device.signalStrength > -80 ? 'Fair' : 'Poor';
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch device status' });
  }
});

module.exports = router;

