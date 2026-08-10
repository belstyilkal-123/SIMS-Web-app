const express    = require('express');
const router     = express.Router();
const Attendance = require('../models/Attendance');
const { protect, authorize } = require('../middleware/authMiddleware');

const MGMT = ['super_administrator', 'office_manager'];
const ALL  = ['super_administrator', 'farmer', 'labor', 'office_manager'];

// ── GET /api/attendance — list records ────────────────────────────────────
router.get('/', protect, authorize(...ALL), async (req, res) => {
  try {
    const { farmId, userId, date, month } = req.query;
    const query = {};

    if (farmId) query.farmId = farmId;
    if (date)   query.date   = date;

    // Month filter: e.g. month=2026-07 → filter YYYY-MM prefix
    if (month)  query.date = { $regex: `^${month}` };

    // Labour only see their own records
    if (req.user.role === 'labor') {
      query.userId = req.user._id;
    } else if (userId) {
      query.userId = userId;
    }

    const records = await Attendance.find(query)
      .populate('userId', 'name email role')
      .populate('farmId', 'name')
      .sort({ date: -1, checkIn: -1 });

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch attendance', details: err.message });
  }
});

// ── POST /api/attendance/checkin — labour self check-in ───────────────────
router.post('/checkin', protect, authorize('labor', 'super_administrator', 'office_manager'), async (req, res) => {
  try {
    const { farmId } = req.body;
    if (!farmId) return res.status(400).json({ error: 'farmId is required' });

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Upsert — if record exists just update checkIn time
    const record = await Attendance.findOneAndUpdate(
      { userId: req.user._id, date: today },
      {
        $setOnInsert: { farmId, date: today, userId: req.user._id },
        $set: { checkIn: new Date(), status: 'present' }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: 'Check-in failed', details: err.message });
  }
});

// ── POST /api/attendance/checkout — labour self check-out ─────────────────
router.post('/checkout', protect, authorize('labor', 'super_administrator', 'office_manager'), async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const record = await Attendance.findOne({ userId: req.user._id, date: today });
    if (!record) return res.status(404).json({ error: 'No check-in record found for today' });
    if (!record.checkIn) return res.status(400).json({ error: 'Must check in before checking out' });

    record.checkOut   = new Date();
    record.hoursWorked = parseFloat(
      ((record.checkOut - record.checkIn) / 3600000).toFixed(2)
    );
    if (record.hoursWorked < 4) record.status = 'half_day';
    await record.save();
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: 'Check-out failed', details: err.message });
  }
});

// ── POST /api/attendance — admin/office_manager manual entry ─────────────
router.post('/', protect, authorize(...MGMT), async (req, res) => {
  try {
    const { userId, farmId, date, status, checkIn, checkOut, notes } = req.body;
    if (!userId || !farmId || !date) {
      return res.status(400).json({ error: 'userId, farmId and date are required' });
    }

    let hoursWorked = 0;
    if (checkIn && checkOut) {
      hoursWorked = parseFloat(
        ((new Date(checkOut) - new Date(checkIn)) / 3600000).toFixed(2)
      );
    }

    const record = await Attendance.findOneAndUpdate(
      { userId, date },
      { farmId, date, userId, status, checkIn, checkOut, hoursWorked, notes, markedBy: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save attendance', details: err.message });
  }
});

// ── PUT /api/attendance/:id — update a record ─────────────────────────────
router.put('/:id', protect, authorize(...MGMT), async (req, res) => {
  try {
    const record = await Attendance.findByIdAndUpdate(
      req.params.id,
      { ...req.body, markedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update attendance', details: err.message });
  }
});

// ── GET /api/attendance/summary — monthly summary per worker ──────────────
router.get('/summary', protect, authorize(...MGMT, 'farmer'), async (req, res) => {
  try {
    const { farmId, month } = req.query; // month = YYYY-MM
    if (!farmId || !month) {
      return res.status(400).json({ error: 'farmId and month are required' });
    }

    const records = await Attendance.find({
      farmId,
      date: { $regex: `^${month}` },
    }).populate('userId', 'name email').lean();

    // Group by userId
    const summary = {};
    records.forEach(r => {
      const uid = r.userId?._id?.toString();
      if (!uid) return;
      if (!summary[uid]) {
        summary[uid] = {
          user: r.userId,
          present: 0, absent: 0, late: 0, half_day: 0,
          totalHours: 0,
        };
      }
      summary[uid][r.status] = (summary[uid][r.status] || 0) + 1;
      summary[uid].totalHours = parseFloat(
        (summary[uid].totalHours + (r.hoursWorked || 0)).toFixed(2)
      );
    });

    res.json(Object.values(summary));
  } catch (err) {
    res.status(500).json({ error: 'Failed to get summary', details: err.message });
  }
});

module.exports = router;

