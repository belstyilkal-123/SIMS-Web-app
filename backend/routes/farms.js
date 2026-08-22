const AssignmentRequest = require('../models/AssignmentRequest');
const express = require('express');
const router = express.Router();
const Farm = require('../models/Farm');
const User = require('../models/User');
const Device = require('../models/Device');
const { protect, authorize } = require('../middleware/authMiddleware');

const OWNER = 'owner';
const ADMIN = 'admin';
const FM    = 'farmer';
const LABOR = 'labor';
const OM    = 'office_manager';

const getRole = (u) => u?.assignedRole || u?.role || '';
const ownsFarm = (farm, user) => farm.ownerId?.toString() === user._id.toString();

// ── GET /api/farms/my-farm — Get the logged in user's farm ────────────────
router.get('/my-farm', protect, authorize(FM, LABOR), async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('farmId assignedFarms');
    const farmId = user?.farmId || req.user.farmId;
    if (!farmId) {
      return res.status(404).json({ error: 'No farm assigned' });
    }
    const farm = await Farm.findById(farmId);
    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }
    res.json(farm);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch your farm', details: err.message });
  }
});

// ── GET /api/farms/available-labor/all — Get unassigned labor ───────────────
router.get('/available-labor/all', protect, authorize(OWNER, FM, OM), async (req, res) => {
  try {
    const labor = await User.find({
      assignedRole: 'labor',
      accountStatus: 'active',
      $or: [{ farmId: { $exists: false } }, { farmId: null }]
    }).select('name email phone');
    res.json(labor);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch available labor', details: err.message });
  }
});

// ── GET /api/farms — List Farms ───────────────────────────────────────────
router.get('/', protect, authorize(OWNER, ADMIN, OM, FM, LABOR), async (req, res) => {
  try {
    const role = getRole(req.user);
    if (role === OWNER || role === ADMIN || role === OM) {
      const farms = await Farm.find({});
      return res.json(farms);
    }
    const user = await User.findById(req.user._id).select('farmId assignedFarms');
    const farmIds = [];
    if (user?.farmId) farmIds.push(user.farmId);
    if (Array.isArray(user?.assignedFarms)) {
      user.assignedFarms.forEach(id => farmIds.push(id));
    }
    if (!farmIds.length) return res.json([]);
    const farms = await Farm.find({ _id: { $in: farmIds } });
    res.json(farms);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch farms', details: err.message });
  }
});

// ── GET /api/farms/:id — Get a single Farm ────────────────────────────────
router.get('/:id', protect, authorize(OWNER, FM, LABOR, OM), async (req, res) => {
  try {
    const farm = await Farm.findById(req.params.id);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });
    res.json(farm);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch farm', details: err.message });
  }
});

// ── POST /api/farms — Create Farm ─────────────────────────────────────────
router.post('/', protect, authorize(OWNER), async (req, res) => {
  try {
    const { name, location, gps, sizeArea, areaSize, cropType, soilType, irrigationMethod } = req.body;
    const finalSize = sizeArea || areaSize || 0;
    const farm = await Farm.create({
      name, location, gps, sizeArea: finalSize, cropType, soilType, irrigationMethod,
      ownerId: req.user._id,
    });
    res.status(201).json(farm);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create farm', details: err.message });
  }
});

// ── POST /api/farms/:id/labor — Assign Labor to farm ────────────────────────
router.post('/:id/labor', protect, authorize(OWNER, FM, OM), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const farm = await Farm.findById(req.params.id);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });

    const role = getRole(req.user);
    if (role === FM) {
      const userDoc = await User.findById(req.user._id).select('farmId assignedFarms');
      const assignedFarmId = userDoc?.farmId?.toString();
      if (assignedFarmId !== farm._id.toString() && !ownsFarm(farm, req.user)) {
        return res.status(403).json({ error: 'Access denied. You can only assign labor to your own farm.' });
      }
    }

    const userToAssign = await User.findById(userId);
    if (!userToAssign) return res.status(404).json({ error: 'User not found' });
    
    const targetRole = getRole(userToAssign);
    if (targetRole !== 'labor') {
      return res.status(400).json({ error: 'Only labor users can be assigned via this endpoint.' });
    }

    if (role === 'farmer' || role === 'office_manager') {
      const AssignmentRequest = require('../models/AssignmentRequest');
      await AssignmentRequest.create({
        type: 'farm_labor',
        targetUserId: userId,
        farmId: farm._id,
        requestedBy: req.user._id
      });
      return res.json({ message: 'Labor assignment requested and pending owner approval.' });
    }

    // Owner directly assigns labor
    await User.findByIdAndUpdate(userId, { farmId: farm._id }, { runValidators: false });
    res.json({ message: 'Labor assigned to farm successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign labor', details: err.message });
  }
});

// ── PUT /api/farms/:id — Update Farm ──────────────────────────────────────
router.put('/:id', protect, authorize(OWNER, FM), async (req, res) => {
  try {
    const farm = await Farm.findById(req.params.id);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });
    
    const role = getRole(req.user);
    if (role === FM) {
      const userDoc = await User.findById(req.user._id).select('farmId assignedFarms');
      const assignedFarmId = userDoc?.farmId?.toString();
      if (assignedFarmId !== farm._id.toString() && !ownsFarm(farm, req.user)) {
         return res.status(403).json({ error: 'Access denied' });
      }
    }

    const updated = await Farm.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update farm', details: err.message });
  }
});

// ── DELETE /api/farms/:id — Delete Farm ───────────────────────────────────
router.delete('/:id', protect, authorize(OWNER), async (req, res) => {
  try {
    const farm = await Farm.findById(req.params.id);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });
    
    await Farm.findByIdAndDelete(req.params.id);
    res.json({ message: 'Farm deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete farm', details: err.message });
  }
});

// ── GET /api/farms/:id/workers — Get farm workers ─────────────────────────
router.get('/:id/workers', protect, authorize(OWNER, FM, OM), async (req, res) => {
  try {
    const farm = await Farm.findById(req.params.id);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });

    const role = getRole(req.user);
    if (role === FM) {
      const userDoc = await User.findById(req.user._id).select('farmId assignedFarms');
      const assignedFarmId = userDoc?.farmId?.toString();
      if (assignedFarmId !== farm._id.toString() && !ownsFarm(farm, req.user)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const workers = await User.find({
      $or: [
        { farmId: farm._id },
        { assignedFarms: farm._id }
      ]
    }).select('name email assignedRole phone');

    res.json(workers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch farm workers', details: err.message });
  }
});

module.exports = router;
