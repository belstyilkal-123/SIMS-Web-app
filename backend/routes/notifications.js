const express      = require('express');
const router       = express.Router();
const Notification = require('../models/Notification');
const { protect }  = require('../middleware/authMiddleware');

/**
 * NOTIFICATION ROLE-BASED ACCESS CONTROL
 * ─────────────────────────────────────────────────────────────────────────
 * Admin:          System & device alerts only
 * Owner:          Full — all alert categories
 * Office Manager: Payment/payroll alerts only
 * Farmer:         Farm, irrigation, device, work + own payment alerts
 * Labour:         Work alerts, assigned farm/device alerts + own payment alerts
 */

// Notification categories mapped from sourceRef.kind and type
const ROLE_ALLOWED_SOURCES = {
  admin: {
    // Admin gets system-level and device alerts only
    sources: ['User', 'Device'],
    types:   ['alarm', 'warning', 'info'],
    // Admin sees system-wide (no farmId restriction)
    farmScoped: false,
  },
  owner: {
    // Owner gets everything
    sources: null, // null = no restriction
    types:   null,
    farmScoped: true,
  },
  office_manager: {
    // Office Manager: payment/payroll/expense only
    sources: ['Expense'],
    types:   ['info', 'warning'],
    farmScoped: true,
  },
  farmer: {
    // Farmer: farm, irrigation, device, work + own payment
    sources: ['SensorData', 'IrrigationLog', 'Device', 'Activity', 'Expense'],
    types:   null,
    farmScoped: true,
  },
  labor: {
    // Labour: work + assigned farm/device + own payment
    sources: ['Activity', 'SensorData', 'IrrigationLog', 'Device', 'Expense'],
    types:   null,
    farmScoped: true,
  },
};

/**
 * Build the MongoDB query for a user based on their role.
 */
async function buildQuery(user) {
  const role   = user.assignedRole || user.role;
  const policy = ROLE_ALLOWED_SOURCES[role];

  // Always scope to this user's own notifications
  const query = { userId: user._id };

  if (!policy) return query; // fallback: own notifications only

  // Source-kind filter
  if (policy.sources) {
    query['sourceRef.kind'] = { $in: policy.sources };
  }

  // Type filter
  if (policy.types) {
    query.type = { $in: policy.types };
  }

  return query;
}

// ── GET /api/notifications — role-filtered list ────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const query = await buildQuery(req.user);
    const notifications = await Notification.find(query)
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ── GET /api/notifications/unread-count ────────────────────────────────────
router.get('/unread-count', protect, async (req, res) => {
  try {
    const query = await buildQuery(req.user);
    query.read  = false;
    const count = await Notification.countDocuments(query);
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to count notifications' });
  }
});

// ── PUT /api/notifications/:id/read — mark one as read ────────────────────
router.put('/:id/read', protect, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// ── PUT /api/notifications/read-all — mark all as read ────────────────────
router.put('/read-all', protect, async (req, res) => {
  try {
    const query = await buildQuery(req.user);
    await Notification.updateMany({ ...query, read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// ── DELETE /api/notifications/:id ─────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// ── DELETE /api/notifications — clear all read notifications ──────────────
router.delete('/', protect, async (req, res) => {
  try {
    const query = await buildQuery(req.user);
    await Notification.deleteMany({ ...query, read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

module.exports = router;
