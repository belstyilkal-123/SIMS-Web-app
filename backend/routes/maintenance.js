const express = require('express');
const router  = express.Router();
const MaintenanceTicket = require('../models/MaintenanceTicket');
const { protect, authorize } = require('../middleware/authMiddleware');

const SA    = 'super_administrator';
const OM    = 'office_manager';
const FM    = 'farmer';
const LB    = 'labor';
const MGMT  = [SA, OM];
const ALL   = [SA, OM, FM, LB];

// ── GET /api/maintenance — list tickets (scoped by role) ─────────────────
router.get('/', protect, authorize(...ALL), async (req, res) => {
  try {
    const { farmId, status, priority, category } = req.query;
    const query = {};

    if (farmId)   query.farmId   = farmId;
    if (status)   query.status   = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    // Labour only sees tickets assigned to them or raised by them
    if (req.user.role === LB) {
      query.$or = [
        { assignedTo: req.user._id },
        { raisedBy:   req.user._id },
      ];
    }
    // Farmer only sees tickets for their own farms
    if (req.user.role === FM) {
      const Farm = require('../models/Farm');
      const myFarms = await Farm.find({ ownerId: req.user._id }).select('_id').lean();
      query.farmId = { $in: myFarms.map(f => f._id) };
    }

    const tickets = await MaintenanceTicket.find(query)
      .populate('farmId',    'name location')
      .populate('deviceId',  'name macAddress')
      .populate('raisedBy',  'name email role')
      .populate('assignedTo','name email role')
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tickets', details: err.message });
  }
});

// ── GET /api/maintenance/:id ─────────────────────────────────────────────
router.get('/:id', protect, authorize(...ALL), async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.findById(req.params.id)
      .populate('farmId',    'name location')
      .populate('deviceId',  'name macAddress')
      .populate('raisedBy',  'name email')
      .populate('assignedTo','name email');
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ticket', details: err.message });
  }
});

// ── POST /api/maintenance — raise a new ticket (any role) ────────────────
router.post('/', protect, authorize(...ALL), async (req, res) => {
  try {
    const { farmId, deviceId, title, description, category, priority, scheduledFor, photos } = req.body;
    if (!farmId || !title) {
      return res.status(400).json({ error: 'farmId and title are required' });
    }
    const ticket = await MaintenanceTicket.create({
      farmId, deviceId, title, description, category, priority,
      scheduledFor, photos: photos || [],
      raisedBy: req.user._id,
    });
    await ticket.populate([
      { path: 'farmId',    select: 'name' },
      { path: 'raisedBy',  select: 'name email' },
    ]);
    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ticket', details: err.message });
  }
});

// ── PUT /api/maintenance/:id — update ticket ─────────────────────────────
// MGMT: update everything
// Labour: update status (in_progress→resolved), add photos/resolution only on their ticket
router.put('/:id', protect, authorize(...ALL), async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (req.user.role === LB) {
      // Labour can only update tickets assigned to them
      if (!ticket.assignedTo || ticket.assignedTo.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'You are not assigned to this ticket' });
      }
      const allowed = ['status', 'resolution', 'photos'];
      allowed.forEach(f => { if (req.body[f] !== undefined) ticket[f] = req.body[f]; });
      if (req.body.status === 'resolved') ticket.resolvedAt = new Date();
    } else {
      // MGMT / Farmer can update all fields
      const allowed = ['title','description','category','priority','status',
        'assignedTo','resolution','photos','scheduledFor'];
      allowed.forEach(f => { if (req.body[f] !== undefined) ticket[f] = req.body[f]; });
      if (req.body.status === 'resolved' && !ticket.resolvedAt) ticket.resolvedAt = new Date();
      if (req.body.status === 'closed'   && !ticket.closedAt)   ticket.closedAt   = new Date();
    }

    await ticket.save();
    await ticket.populate([
      { path: 'farmId',    select: 'name' },
      { path: 'assignedTo',select: 'name email' },
      { path: 'raisedBy',  select: 'name email' },
    ]);
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ticket', details: err.message });
  }
});

// ── DELETE /api/maintenance/:id — super_admin only ───────────────────────
router.delete('/:id', protect, authorize(SA), async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.findByIdAndDelete(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ message: 'Ticket deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete ticket', details: err.message });
  }
});

// ── GET /api/maintenance/stats/summary — counts per status/priority ──────
router.get('/stats/summary', protect, authorize(...MGMT, FM), async (req, res) => {
  try {
    const { farmId } = req.query;
    const match = {};
    if (farmId) match.farmId = require('mongoose').Types.ObjectId.createFromHexString(farmId);

    const stats = await MaintenanceTicket.aggregate([
      { $match: match },
      { $group: { _id: { status: '$status', priority: '$priority' }, count: { $sum: 1 } } },
    ]);

    const summary = { open:0, assigned:0, in_progress:0, resolved:0, closed:0, critical:0, high:0 };
    stats.forEach(s => {
      if (summary[s._id.status] !== undefined) summary[s._id.status] += s.count;
      if (s._id.priority === 'critical') summary.critical += s.count;
      if (s._id.priority === 'high')     summary.high     += s.count;
    });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
});

module.exports = router;
