const express = require('express');
const router = express.Router();
const Farm = require('../models/Farm');
const Device = require('../models/Device');
const { protect, authorize, isAdmin } = require('../middleware/authMiddleware');

// @route   GET /api/farms
router.get('/', protect, authorize('super_administrator', 'office_manager', 'farmer'), async (req, res) => {
  try {
    let farms;
    if (req.user.role === 'super_administrator') {
      farms = await Farm.find({});
    } else if (req.user.role === 'office_manager') {
      // Office managers see farms they are associated with via farmId, or all if no farmId set
      farms = req.user.farmId
        ? await Farm.find({ _id: req.user.farmId })
        : await Farm.find({});
    } else {
      farms = await Farm.find({ ownerId: req.user._id });
    }
    res.json(farms);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch farms' });
  }
});

// @route   PUT /api/farms/:id — office_manager can update, farmer can update own
router.put('/:id', protect, authorize('super_administrator', 'office_manager', 'farmer'), async (req, res) => {
  try {
    const farm = await Farm.findById(req.params.id);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });
    if (req.user.role === 'farmer' && farm.ownerId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Not authorized' });
    const updated = await Farm.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update farm' });
  }
});

// @route   POST /api/farms — super_admin + farmer create
router.post('/', protect, authorize('super_administrator', 'farmer'), async (req, res) => {
  try {
    const { name, location, gps, sizeArea, cropType, soilType, irrigationMethod } = req.body;
    const farm = new Farm({ ownerId: req.user._id, name, location, gps, areaSize: sizeArea, cropType, soilType, irrigationMethod });
    await farm.save();
    res.status(201).json(farm);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create farm' });
  }
});

// @route   DELETE /api/farms/:id — super_admin + farm owner
router.delete('/:id', protect, authorize('super_administrator', 'farmer'), async (req, res) => {
  try {
    const farm = await Farm.findById(req.params.id);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });
    if (!isAdmin(req.user) && farm.ownerId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Not authorized' });
    await farm.deleteOne();
    res.json({ message: 'Farm removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete farm' });
  }
});

module.exports = router;

