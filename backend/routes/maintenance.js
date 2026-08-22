const express = require('express');
const router  = express.Router();
const MaintenanceTicket = require('../models/MaintenanceTicket');
const Farm = require('../models/Farm');
const { protect, authorize, getUserRole } = require('../middleware/authMiddleware');

const OWNER = 'owner';
const OM    = 'office_manager';
const FM    = 'farmer';
const LB    = 'labor';

// Allowed roles for Maintenance module (Admin ❌ excluded)
const MAINTENANCE_ROLES = [OWNER, OM, FM, LB];

// ── GET /api/maintenance — List tickets (scoped by role) ─────────────────
router.get('/', protect, authorize(...MAINTENANCE_ROLES), async (req, res) => {
  try {
    const { farmId, status, priority, category } = req.query;
    const role = getUserRole(req.user);
    const query = {};

    if (farmId)   query.farmId   = farmId;
    if (status)   query.status   = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    if (role === LB) {
      // Labour only sees tickets assigned to them or raised by them
      query.$or = [
        { assignedTo: req.user._id },
        { raisedBy:   req.user._id },
      ];
    } else if (role === FM) {
      // Farmer sees tickets for their assigned farm or raised by them
      const myFarmIds = [];
      if (req.user.farmId) myFarmIds.push(req.user.farmId);
      if (req.user.assignedFarms?.length > 0) myFarmIds.push(...req.user.assignedFarms);

      query.$or = [
        { farmId: { $in: myFarmIds } },
        { raisedBy: req.user._id }
      ];
    } else if (role === OM) {
      // Office Manager sees relevant maintenance tickets
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
router.get('/:id', protect, authorize(...MAINTENANCE_ROLES), async (req, res) => {
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

// ── POST /api/maintenance — Create maintenance ticket ────────────────────
// Owner 🟡 | Office Manager ✅ | Farmer ✅ | Labour ✅ (Report Problem only)
router.post('/', protect, authorize(OWNER, OM, FM, LB), async (req, res) => {
  try {
    const { farmId, deviceId, title, description, category, priority, scheduledFor, photos } = req.body;
    if (!farmId || !title) {
      return res.status(400).json({ error: 'farmId and title are required' });
    }

    const role = getUserRole(req.user);

    // Farmer can only create for their assigned farm
    if (role === FM) {
      const myFarmIds = [req.user.farmId?.toString(), ...(req.user.assignedFarms || []).map(id => id.toString())];
      if (!myFarmIds.includes(farmId.toString())) {
        return res.status(403).json({ error: 'You can only create maintenance tickets for your assigned farm' });
      }
    }

    const ticket = await MaintenanceTicket.create({
      farmId,
      deviceId,
      title,
      description,
      category: category || 'other',
      priority: priority || 'medium',
      scheduledFor,
      photos: photos || [],
      raisedBy: req.user._id,
    });

    await ticket.populate([
      { path: 'farmId',   select: 'name' },
      { path: 'raisedBy', select: 'name email' },
    ]);

    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ticket', details: err.message });
  }
});

// ── PUT /api/maintenance/:id — Update maintenance ticket ──────────────────
router.put('/:id', protect, authorize(...MAINTENANCE_ROLES), async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const role = getUserRole(req.user);

    if (role === LB) {
      // Labour can only update status/photos on assigned tickets
      if (!ticket.assignedTo || ticket.assignedTo.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'You are not assigned to this ticket' });
      }
      const allowed = ['status', 'resolution', 'photos'];
      allowed.forEach(f => { if (req.body[f] !== undefined) ticket[f] = req.body[f]; });
      if (req.body.status === 'resolved') ticket.resolvedAt = new Date();
    } else if (role === OM) {
      // Office Manager can add repair cost and update status
      const allowed = ['repairCost', 'status', 'resolution', 'assignedTo'];
      allowed.forEach(f => { if (req.body[f] !== undefined) ticket[f] = req.body[f]; });
    } else {
      // Owner & Farmer
      const allowed = ['title', 'description', 'category', 'priority', 'status',
        'assignedTo', 'resolution', 'photos', 'scheduledFor', 'repairCost'];
      
      // Farmer cannot set repairCost (Owner & OM only)
      if (role === FM) {
        const costIdx = allowed.indexOf('repairCost');
        if (costIdx !== -1) allowed.splice(costIdx, 1);
      }

      allowed.forEach(f => { if (req.body[f] !== undefined) ticket[f] = req.body[f]; });
      if (req.body.status === 'resolved' && !ticket.resolvedAt) ticket.resolvedAt = new Date();
      if (req.body.status === 'closed'   && !ticket.closedAt)   ticket.closedAt   = new Date();
    }

    await ticket.save();
    await ticket.populate([
      { path: 'farmId',     select: 'name' },
      { path: 'assignedTo', select: 'name email' },
      { path: 'raisedBy',   select: 'name email' },
    ]);

    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ticket', details: err.message });
  }
});

// ── DELETE /api/maintenance/:id — Owner only ─────────────────────────────
router.delete('/:id', protect, authorize(OWNER), async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.findByIdAndDelete(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ message: 'Ticket deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete ticket', details: err.message });
  }
});

// ── GET /api/maintenance/stats/summary — Summary statistics ─────────────
router.get('/stats/summary', protect, authorize(OWNER, OM, FM), async (req, res) => {
  try {
    const { farmId } = req.query;
    const match = {};
    if (farmId) match.farmId = require('mongoose').Types.ObjectId.createFromHexString(farmId);

    const stats = await MaintenanceTicket.aggregate([
      { $match: match },
      { $group: { _id: { status: '$status', priority: '$priority' }, count: { $sum: 1 } } },
    ]);

    const summary = { open: 0, assigned: 0, in_progress: 0, resolved: 0, closed: 0, critical: 0, high: 0 };
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
