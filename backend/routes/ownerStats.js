/**
 * /api/owner — Owner business overview statistics
 * All routes require owner role (spec §7-§19)
 */
const express  = require('express');
const router   = express.Router();
const User     = require('../models/User');
const Farm     = require('../models/Farm');
const Device   = require('../models/Device');
const Payroll  = require('../models/Payroll');
const IrrigationLog = require('../models/IrrigationLog');
const SensorData    = require('../models/SensorData');
const { protect, authorize, ROLES } = require('../middleware/authMiddleware');

const OWNER_ADMIN = [ROLES.OWNER, ROLES.ADMIN];

/* ── GET /api/owner/dashboard — high-level KPIs ─────────────── */
router.get('/dashboard', protect, authorize(...OWNER_ADMIN), async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      suspendedUsers,
      totalFarms,
      totalDevices,
      onlineDevices,
      payrollPending,
      payrollSubmitted,
      recentIrrigation,
    ] = await Promise.all([
      User.countDocuments().catch(() => 0),
      User.countDocuments({ accountStatus: 'active' }).catch(() => 0),
      User.countDocuments({ accountStatus: 'pending' }).catch(() => 0),
      User.countDocuments({ accountStatus: 'suspended' }).catch(() => 0),
      Farm.countDocuments().catch(() => 0),
      Device.countDocuments().catch(() => 0),
      Device.countDocuments({ status: 'online' }).catch(() => 0),
      Payroll.countDocuments({ paymentStatus: 'pending' }).catch(() => 0),
      Payroll.countDocuments({ paymentStatus: 'submitted' }).catch(() => 0),
      IrrigationLog.find().sort({ timestamp: -1 }).limit(5).lean().catch(() => []),
    ]);

    // Role breakdown
    let roleCounts = [];
    try {
      roleCounts = await User.aggregate([
        { $match: { accountStatus: 'active' } },
        { $group: { _id: '$assignedRole', count: { $sum: 1 } } },
      ]);
    } catch (e) {}
    const byRole = {};
    (roleCounts || []).forEach(r => { if (r && r._id) byRole[r._id] = r.count; });

    // Payroll financial summary (current month)
    const currentMonth = new Date().toISOString().slice(0, 7);
    let payrollSummary = [];
    try {
      payrollSummary = await Payroll.aggregate([
        { $match: { period: currentMonth } },
        { $group: {
          _id: '$paymentStatus',
          totalAmount: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        }},
      ]);
    } catch (e) {}
    const payrollStats = {};
    (payrollSummary || []).forEach(p => { if (p && p._id) payrollStats[p._id] = { total: p.totalAmount, count: p.count }; });

    res.json({
      users: { total: totalUsers, active: activeUsers, pending: pendingUsers, suspended: suspendedUsers },
      byRole,
      farms: { total: totalFarms },
      devices: { total: totalDevices, online: onlineDevices, offline: Math.max(0, totalDevices - onlineDevices) },
      payroll: {
        pendingApproval: payrollSubmitted,
        draft: payrollPending,
        stats: payrollStats,
      },
      recentIrrigation: recentIrrigation || [],
    });
  } catch (err) {
    console.error('[Owner Dashboard Error]:', err);
    res.status(500).json({ error: 'Failed to fetch owner dashboard', details: err.message });
  }
});

/* ── GET /api/owner/payroll — pending payroll approvals ─────── */
router.get('/payroll', protect, authorize(...OWNER_ADMIN), async (req, res) => {
  try {
    const { status, farmId } = req.query;
    const query = {};
    if (status) query.paymentStatus = status;
    if (farmId) query.farmId = farmId;

    const records = await Payroll.find(query)
      .populate('userId',    'name email assignedRole')
      .populate('farmId',    'name')
      .populate('processedBy','name email')
      .populate('approvedBy', 'name email')
      .sort({ period: -1, createdAt: -1 });

    res.json(records || []);
  } catch (err) {
    console.error('[Owner Payroll Error]:', err);
    res.json([]);
  }
});

/* ── GET /api/owner/staff — workforce summary ────────────────── */
router.get('/staff', protect, authorize(...OWNER_ADMIN), async (req, res) => {
  try {
    const staff = await User.find({ accountStatus: 'active', assignedRole: { $in: ['office_manager','farmer','labor'] } })
      .select('name email assignedRole farmId createdAt')
      .populate('farmId', 'name')
      .sort({ assignedRole: 1, name: 1 });
    res.json(staff || []);
  } catch (err) {
    console.error('[Owner Staff Error]:', err);
    res.json([]);
  }
});

/* ── GET /api/owner/performance — farm performance summary ───── */
router.get('/performance', protect, authorize(...OWNER_ADMIN), async (req, res) => {
  try {
    const farms    = await Farm.find().lean();
    const devices  = await Device.find().lean();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Irrigation events in last 30 days per farm's devices
    const deviceIds   = devices.map(d => d._id);
    const irrigation  = await IrrigationLog.aggregate([
      { $match: { deviceId: { $in: deviceIds }, timestamp: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$deviceId', events: { $sum: 1 }, totalDuration: { $sum: '$duration' } } },
    ]);

    res.json({ farms: farms.length, devices: devices.length, irrigationEvents30d: irrigation });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch performance', details: err.message });
  }
});

module.exports = router;
