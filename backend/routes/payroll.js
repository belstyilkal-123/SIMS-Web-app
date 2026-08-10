const express  = require('express');
const router   = express.Router();
const Payroll  = require('../models/Payroll');
const Attendance = require('../models/Attendance');
const { protect, authorize } = require('../middleware/authMiddleware');

const MGMT = ['super_administrator', 'office_manager'];

// ── GET /api/payroll — list payroll records ───────────────────────────────
router.get('/', protect, authorize(...MGMT, 'farmer', 'labor'), async (req, res) => {
  try {
    const { farmId, period, userId } = req.query;
    const query = {};

    if (farmId)  query.farmId = farmId;
    if (period)  query.period = period;

    // Labour only see their own records
    if (req.user.role === 'labor') {
      query.userId = req.user._id;
    } else if (userId) {
      query.userId = userId;
    }

    const records = await Payroll.find(query)
      .populate('userId', 'name email role')
      .populate('farmId', 'name')
      .populate('processedBy', 'name email')
      .sort({ period: -1, createdAt: -1 });

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payroll', details: err.message });
  }
});

// ── GET /api/payroll/:id ──────────────────────────────────────────────────
router.get('/:id', protect, authorize(...MGMT, 'labor'), async (req, res) => {
  try {
    const record = await Payroll.findById(req.params.id)
      .populate('userId', 'name email role')
      .populate('farmId', 'name')
      .populate('processedBy', 'name email');
    if (!record) return res.status(404).json({ error: 'Payroll record not found' });

    // Labour may only view their own
    if (req.user.role === 'labor' && record.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payroll record', details: err.message });
  }
});

// ── POST /api/payroll — create a payroll record ───────────────────────────
router.post('/', protect, authorize(...MGMT), async (req, res) => {
  try {
    const { userId, farmId, period, baseSalary, bonus, deductions, notes } = req.body;
    if (!userId || !farmId || !period || baseSalary == null) {
      return res.status(400).json({ error: 'userId, farmId, period and baseSalary are required' });
    }

    // Auto-fill attendance stats for the period from Attendance collection
    const attendanceRecords = await Attendance.find({
      userId, farmId,
      date: { $regex: `^${period}` },
    }).lean();

    const daysPresent = attendanceRecords.filter(r => r.status !== 'absent').length;
    const hoursWorked = parseFloat(
      attendanceRecords.reduce((s, r) => s + (r.hoursWorked || 0), 0).toFixed(2)
    );

    const record = await Payroll.create({
      userId, farmId, period,
      baseSalary: Number(baseSalary),
      bonus:      Number(bonus      || 0),
      deductions: Number(deductions || 0),
      hoursWorked,
      daysPresent,
      notes,
      processedBy: req.user._id,
    });

    await record.populate([
      { path: 'userId', select: 'name email' },
      { path: 'farmId', select: 'name' },
    ]);
    res.status(201).json(record);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: `Payroll for this worker in period ${req.body.period} already exists` });
    }
    res.status(500).json({ error: 'Failed to create payroll', details: err.message });
  }
});

// ── PUT /api/payroll/:id — update / mark paid ────────────────────────────
router.put('/:id', protect, authorize(...MGMT), async (req, res) => {
  try {
    const record = await Payroll.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Payroll record not found' });

    const allowed = ['baseSalary', 'bonus', 'deductions', 'paymentStatus', 'notes'];
    allowed.forEach(f => { if (req.body[f] !== undefined) record[f] = req.body[f]; });

    if (req.body.paymentStatus === 'paid' && !record.paidAt) {
      record.paidAt      = new Date();
      record.processedBy = req.user._id;
    }

    await record.save(); // triggers pre-save netPay computation
    await record.populate([
      { path: 'userId', select: 'name email' },
      { path: 'farmId', select: 'name' },
      { path: 'processedBy', select: 'name email' },
    ]);
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update payroll', details: err.message });
  }
});

// ── DELETE /api/payroll/:id — admin only ─────────────────────────────────
router.delete('/:id', protect, authorize('super_administrator'), async (req, res) => {
  try {
    const record = await Payroll.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ error: 'Payroll record not found' });
    res.json({ message: 'Payroll record deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete payroll', details: err.message });
  }
});

module.exports = router;

