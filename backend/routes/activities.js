const express  = require('express');
const router   = express.Router();
const Activity = require('../models/Activity');
const { protect, authorize } = require('../middleware/authMiddleware');

const ADMIN_FM = ['super_administrator', 'office_manager'];
const ALL_ROLES = ['super_administrator', 'office_manager', 'farmer', 'labor'];

// ── GET /api/activities — list activities (scoped by role) ────────────────
router.get('/', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const { farmId, status } = req.query;
    const query = {};

    if (farmId) query.farmId = farmId;
    if (status)  query.status = status;

    // Labour only see their own assignments
    if (req.user.role === 'labor') {
      query.assignedTo = req.user._id;
    }

    const activities = await Activity.find(query)
      .populate('assignedTo', 'name email role')
      .populate('assignedBy', 'name email')
      .populate('farmId', 'name')
      .sort({ createdAt: -1 });

    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activities', details: err.message });
  }
});

// ── POST /api/activities — create (super_admin + office_manager) ─────────
router.post('/', protect, authorize('super_administrator', 'office_manager'), async (req, res) => {
  try {
    const { farmId, title, description, assignedTo, dueDate, priority } = req.body;
    if (!farmId || !title) {
      return res.status(400).json({ error: 'farmId and title are required' });
    }
    const activity = await Activity.create({
      farmId, title, description, assignedTo: assignedTo || [],
      dueDate, priority, assignedBy: req.user._id,
    });
    const populated = await activity.populate([
      { path: 'assignedTo', select: 'name email' },
      { path: 'assignedBy', select: 'name email' },
    ]);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create activity', details: err.message });
  }
});

// ── PUT /api/activities/:id — update (admin+office_mgr edit all; labour updates status only) ──
router.put('/:id', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    if (req.user.role === 'labor') {
      const isAssigned = activity.assignedTo.some(id => id.toString() === req.user._id.toString());
      if (!isAssigned) return res.status(403).json({ error: 'Not assigned to this activity' });
      if (req.body.status) {
        activity.status = req.body.status;
        if (req.body.status === 'completed') activity.completedAt = new Date();
      }
      if (req.body.notes !== undefined) activity.notes = req.body.notes;
    } else {
      // super_administrator, office_manager, farmer can update everything
      const allowed = ['title', 'description', 'assignedTo', 'dueDate', 'priority', 'status', 'notes'];
      allowed.forEach(f => { if (req.body[f] !== undefined) activity[f] = req.body[f]; });
      if (req.body.status === 'completed' && !activity.completedAt) activity.completedAt = new Date();
    }

    await activity.save();
    await activity.populate([
      { path: 'assignedTo', select: 'name email' },
      { path: 'assignedBy', select: 'name email' },
    ]);
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update activity', details: err.message });
  }
});

// ── DELETE /api/activities/:id — super_admin + office_manager ────────────
router.delete('/:id', protect, authorize('super_administrator', 'office_manager'), async (req, res) => {
  try {
    const activity = await Activity.findByIdAndDelete(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });
    res.json({ message: 'Activity deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete activity', details: err.message });
  }
});

module.exports = router;

