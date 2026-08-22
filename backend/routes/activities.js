const express  = require('express');
const router   = express.Router();
const Activity = require('../models/Activity');
const Farm     = require('../models/Farm');
const { protect, authorize, getUserRole } = require('../middleware/authMiddleware');

const OWNER = 'owner';
const FM    = 'farmer';
const LABOR = 'labor';

const TASK_ROLES = [OWNER, FM, LABOR];

// ── GET /api/activities — List tasks (scoped by role) ─────────────────────
// Owner ✅ Full | Farmer ✅ Full (for own farm) | Labour ✅ Own tasks only
// Admin ❌ | Office Manager ❌
router.get('/', protect, authorize(...TASK_ROLES), async (req, res) => {
  try {
    const { farmId, status } = req.query;
    const role = getUserRole(req.user);
    const query = {};

    if (farmId) query.farmId = farmId;
    if (status) query.status = status;

    if (role === LABOR) {
      query.assignedTo = req.user._id;
    } else if (role === FM) {
      // Farmer sees tasks for their own farm(s) or created by them
      const myFarms = await Farm.find({ ownerId: req.user._id }).select('_id');
      const farmIds = myFarms.map(f => f._id);
      query.$or = [
        { farmId: { $in: farmIds } },
        { assignedBy: req.user._id }
      ];
    }

    const activities = await Activity.find(query)
      .populate('assignedTo', 'name email role')
      .populate('assignedBy', 'name email')
      .populate('farmId', 'name')
      .sort({ createdAt: -1 });

    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks', details: err.message });
  }
});

// ── POST /api/activities — Create task (Owner 🟡, Farmer ✅) ──────────────
router.post('/', protect, authorize(OWNER, FM), async (req, res) => {
  try {
    const { farmId, title, description, assignedTo, dueDate, priority } = req.body;
    if (!farmId || !title) {
      return res.status(400).json({ error: 'farmId and title are required' });
    }

    const role = getUserRole(req.user);
    if (role === FM) {
      const farm = await Farm.findById(farmId);
      if (!farm || farm.ownerId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'You can only create tasks for your own farm' });
      }
    }

    const activity = await Activity.create({
      farmId,
      title,
      description,
      assignedTo: assignedTo || [],
      dueDate,
      priority: priority || 'medium',
      assignedBy: req.user._id,
    });

    const populated = await activity.populate([
      { path: 'assignedTo', select: 'name email' },
      { path: 'assignedBy', select: 'name email' },
      { path: 'farmId',     select: 'name' },
    ]);

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task', details: err.message });
  }
});

// ── PUT /api/activities/:id — Update task ─────────────────────────────────
// Owner 🟡 | Farmer ✅ | Labour ✅ (Status & Notes only for assigned tasks)
router.put('/:id', protect, authorize(...TASK_ROLES), async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Task not found' });

    const role = getUserRole(req.user);

    if (role === LABOR) {
      const isAssigned = activity.assignedTo.some(id => id.toString() === req.user._id.toString());
      if (!isAssigned) return res.status(403).json({ error: 'Not assigned to this task' });
      if (req.body.status) {
        activity.status = req.body.status;
        if (req.body.status === 'completed') activity.completedAt = new Date();
      }
      if (req.body.notes !== undefined) activity.notes = req.body.notes;
    } else {
      // Owner & Farmer
      if (role === FM && activity.assignedBy.toString() !== req.user._id.toString()) {
        const farm = await Farm.findById(activity.farmId);
        if (!farm || farm.ownerId?.toString() !== req.user._id.toString()) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
      const allowed = ['title', 'description', 'assignedTo', 'dueDate', 'priority', 'status', 'notes'];
      allowed.forEach(f => { if (req.body[f] !== undefined) activity[f] = req.body[f]; });
      if (req.body.status === 'completed' && !activity.completedAt) activity.completedAt = new Date();
    }

    await activity.save();
    await activity.populate([
      { path: 'assignedTo', select: 'name email' },
      { path: 'assignedBy', select: 'name email' },
      { path: 'farmId',     select: 'name' },
    ]);

    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task', details: err.message });
  }
});

// ── POST /api/activities/:id/problem — Report task problem ────────────────
// Owner 🟡 | Farmer ✅ | Labour ✅
router.post('/:id/problem', protect, authorize(...TASK_ROLES), async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Task not found' });

    const { problem } = req.body;
    if (!problem) return res.status(400).json({ error: 'Problem description is required' });

    activity.notes = (activity.notes ? activity.notes + '\n' : '') +
      `[PROBLEM REPORTED by ${req.user.name} on ${new Date().toLocaleDateString()}: ${problem}]`;
    activity.status = 'blocked';

    await activity.save();
    res.json({ message: 'Task problem reported', activity });
  } catch (err) {
    res.status(500).json({ error: 'Failed to report task problem', details: err.message });
  }
});

// ── DELETE /api/activities/:id — Delete task ──────────────────────────────
// Owner 🟡 | Farmer 🟡 (own created tasks only)
router.delete('/:id', protect, authorize(OWNER, FM), async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Task not found' });

    const role = getUserRole(req.user);
    if (role === FM && activity.assignedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only delete tasks created by you' });
    }

    await activity.deleteOne();
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task', details: err.message });
  }
});

module.exports = router;
