const express  = require('express');
const router   = express.Router();
const AuditLog = require('../models/AuditLog');
const Farm     = require('../models/Farm');
const { protect, authorize, getUserRole } = require('../middleware/authMiddleware');

const ADMIN = 'admin';
const OWNER = 'owner';
const OM    = 'office_manager';
const FM    = 'farmer';
const LABOR = 'labor';

const ALL_ROLES = [ADMIN, OWNER, OM, FM, LABOR];

// ── GET /api/audit-logs — list audit logs (scoped by role) ───────────────
router.get('/', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const role = getUserRole(req.user);
    const { actionType, eventCategory } = req.query;
    const query = {};

    if (actionType) query.action = actionType;
    if (eventCategory) query.category = eventCategory;

    // Scope queries according to role spec
    if (role === ADMIN) {
      // Admin sees system-wide logs
    } else if (role === OWNER) {
      // Owner sees farm-level logs
      const myFarms = await Farm.find({ ownerId: req.user._id }).select('_id');
      query.$or = [
        { farmId: { $in: myFarms.map(f => f._id) } },
        { userId: req.user._id },
      ];
    } else if (role === OM) {
      // Office Manager sees office/management logs
      query.category = { $in: ['payroll', 'expense', 'office', 'user'] };
    } else if (role === FM || role === LABOR) {
      // Farmer & Labour see only their own activity/changes logs
      query.userId = req.user._id;
    }

    const logs = await AuditLog.find(query)
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs', details: error.message });
  }
});

// ── GET /api/audit-logs/export — export logs (Admin ✅, Owner 🟡, OM 🟡) ───
router.get('/export', protect, authorize(ADMIN, OWNER, OM), async (req, res) => {
  try {
    const role = getUserRole(req.user);
    const query = {};

    if (role === OWNER) {
      const myFarms = await Farm.find({ ownerId: req.user._id }).select('_id');
      query.$or = [
        { farmId: { $in: myFarms.map(f => f._id) } },
        { userId: req.user._id },
      ];
    } else if (role === OM) {
      query.category = { $in: ['payroll', 'expense', 'office'] };
    }

    const logs = await AuditLog.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(1000);

    let csv = 'Timestamp,Action,User,Details\n';
    logs.forEach(log => {
      const date = new Date(log.createdAt || log.timestamp).toISOString();
      const user = log.userId?.name || 'System';
      const action = (log.action || '').replace(/,/g, ' ');
      const details = (log.details || '').replace(/,/g, ' ');
      csv += `${date},${action},${user},${details}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sims_audit_logs_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export audit logs', details: error.message });
  }
});

module.exports = router;
