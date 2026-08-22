/**
 * Expense Routes
 * 
 * Role Permissions:
 * - Owner: Full access - create, view all, approve, process, cancel
 * - Office Manager: Create, view all, process, cancel own
 * - Farmer: Create own, view own, upload receipt
 * - Labour: No access
 */

const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const Expense  = require('../models/Expense');
const Farm     = require('../models/Farm');
const { protect, authorize } = require('../middleware/authMiddleware');

// ── Role constants ────────────────────────────────────────────────────────
const OWNER  = 'owner';
const SA     = 'admin';
const OM     = 'office_manager';
const FM     = 'farmer';

// Roles that can create and manage expenses
const MGMT   = [OWNER, SA, OM];
const CREATE = [OWNER, SA, OM, FM];  // Farmer can also create
const VIEW   = [OWNER, SA, OM, FM];

// ── Helper: Get user role ─────────────────────────────────────────────────
const getRole = (user) => user.assignedRole || user.role;

// ── Helper: Build query filter based on role ──────────────────────────────
const buildFilter = async (user, query = {}) => {
  const role = getRole(user);
  const filter = { ...query };
  
  // Owner, Admin, OM: Can see all expenses (optionally filtered by farm)
  // Farmer: Can only see own expense requests
  if (role === FM) {
    filter.requestedBy = user._id;
  }
  
  return filter;
};

// ── GET /api/expenses — List expenses ────────────────────────────────────
router.get('/', protect, authorize(...VIEW), async (req, res) => {
  try {
    const { farmId, status, category, requestedBy, periodStart, periodEnd } = req.query;
    const query = await buildFilter(req.user);
    
    if (farmId)    query.farmId = farmId;
    if (status)    query.status = status;
    if (category)  query.category = category;
    if (requestedBy && [OWNER, SA, OM].includes(getRole(req.user))) {
      query.requestedBy = requestedBy;
    }
    
    // Date range filter
    if (periodStart || periodEnd) {
      query.expenseDate = {};
      if (periodStart) query.expenseDate.$gte = new Date(periodStart);
      if (periodEnd)   query.expenseDate.$lte = new Date(periodEnd);
    }
    
    const expenses = await Expense.find(query)
      .populate('farmId', 'name location')
      .populate('requestedBy', 'name email assignedRole')
      .populate('approvedBy', 'name email')
      .populate('processedBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expenses', details: err.message });
  }
});

// ── GET /api/expenses/stats — Summary statistics ──────────────────────────
router.get('/stats', protect, authorize(...VIEW), async (req, res) => {
  try {
    const role = getRole(req.user);
    const { farmId } = req.query;
    
    let stats;
    if (farmId && [OWNER, SA, OM].includes(role)) {
      stats = await Expense.getStatsByFarm(farmId);
    } else if (role === FM) {
      stats = await Expense.getStatsByUser(req.user._id);
    } else {
      // Global stats for owner/admin/OM
      const match = farmId ? { farmId: new mongoose.Types.ObjectId(farmId) } : {};
      const agg = await Expense.aggregate([
        { $match: match },
        { $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        }},
      ]);
      
      stats = { total: 0, pending: { count: 0, amount: 0 }, approved: { count: 0, amount: 0 },
                processed: { count: 0, amount: 0 }, rejected: { count: 0, amount: 0 }, cancelled: { count: 0, amount: 0 } };
      agg.forEach(s => {
        stats.total += s.count;
        if (stats[s._id]) {
          stats[s._id].count = s.count;
          stats[s._id].amount = s.totalAmount;
        }
      });
    }
    
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expense stats', details: err.message });
  }
});

// ── GET /api/expenses/:id — Single expense ────────────────────────────────
router.get('/:id', protect, authorize(...VIEW), async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('farmId', 'name location')
      .populate('requestedBy', 'name email assignedRole')
      .populate('approvedBy', 'name email')
      .populate('processedBy', 'name email');
    
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    // Farmer can only view their own
    const role = getRole(req.user);
    if (role === FM && expense.requestedBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expense', details: err.message });
  }
});

// ── POST /api/expenses — Create expense request ──────────────────────────
router.post('/', protect, authorize(...CREATE), async (req, res) => {
  try {
    const {
      title, description, category, amount, farmId,
      expenseDate, dueDate, priority, tags, notes,
      receiptImage, receiptNote,
    } = req.body;
    
    if (!title || !amount || !farmId) {
      return res.status(400).json({ error: 'Title, amount, and farm are required' });
    }
    
    // Verify farm exists and user has access
    const farm = await Farm.findById(farmId);
    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }
    
    const role = getRole(req.user);
    
    // Farmer can only create expenses for their assigned farm.
    // Re-fetch fresh user from DB to avoid JWT staleness.
    if (role === FM) {
      const freshUser = await require('../models/User').findById(req.user._id).select('farmId assignedFarms');
      const assignedFarmId = (freshUser?.farmId || req.user.farmId)?.toString();
      const assignedFarms = (freshUser?.assignedFarms || req.user.assignedFarms || []).map(id => id.toString());
      
      const isAssigned = (assignedFarmId && assignedFarmId === farmId.toString()) ||
                         assignedFarms.includes(farmId.toString());

      if (!isAssigned) {
        const isOwner = farm.ownerId && farm.ownerId.toString() === req.user._id.toString();
        if (!isOwner) {
          if (!assignedFarmId && assignedFarms.length === 0) {
            return res.status(403).json({ error: 'No farm assigned to your account yet. Ask the owner to assign you to a farm.' });
          }
          return res.status(403).json({ error: 'You can only create expenses for your assigned farm.' });
        }
      }
    }
    
    const expense = await Expense.create({
      title,
      description,
      category: category || 'other',
      amount: Number(amount),
      farmId,
      requestedBy: req.user._id,
      requesterRole: role,
      status: 'pending',
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      priority: priority || 'normal',
      tags: tags || [],
      notes,
      receiptImage,
      receiptNote,
      createdBy: req.user._id,
    });
    
    await expense.populate([
      { path: 'farmId', select: 'name location' },
      { path: 'requestedBy', select: 'name email assignedRole' },
    ]);
    
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create expense', details: err.message });
  }
});

// ── PUT /api/expenses/:id — Update expense ────────────────────────────────
router.put('/:id', protect, authorize(...CREATE), async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    // Check if expense can be edited
    if (!['draft', 'pending'].includes(expense.status)) {
      return res.status(400).json({ error: `Cannot edit expense with status: ${expense.status}` });
    }
    
    const role = getRole(req.user);
    
    // Farmer can only edit own expenses
    if (role === FM && expense.requestedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only edit your own expenses' });
    }
    
    // OM can edit their own; Owner/Admin can edit any
    if (role === OM && expense.requestedBy.toString() !== req.user._id.toString()) {
      // OM can also edit expenses pending approval
      if (expense.status !== 'pending') {
        return res.status(403).json({ error: 'You can only edit your own pending expenses' });
      }
    }
    
    // Update allowed fields
    const updatable = ['title', 'description', 'category', 'amount', 'expenseDate', 
                       'dueDate', 'priority', 'tags', 'notes', 'receiptImage', 'receiptNote'];
    updatable.forEach(field => {
      if (req.body[field] !== undefined) {
        expense[field] = req.body[field];
      }
    });
    
    expense.updatedBy = req.user._id;
    await expense.save();
    
    await expense.populate([
      { path: 'farmId', select: 'name location' },
      { path: 'requestedBy', select: 'name email assignedRole' },
    ]);
    
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update expense', details: err.message });
  }
});

// ── POST /api/expenses/:id/approve — Approve expense request (Owner only) ─
router.post('/:id/approve', protect, authorize(OWNER), async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    if (expense.status !== 'pending') {
      return res.status(400).json({ error: `Cannot approve expense with status: ${expense.status}` });
    }
    
    expense.status = 'approved';
    expense.approvedBy = req.user._id;
    expense.approvedAt = new Date();
    expense.approvalNotes = req.body.notes || '';
    
    await expense.save();
    
    await expense.populate([
      { path: 'farmId', select: 'name location' },
      { path: 'requestedBy', select: 'name email' },
      { path: 'approvedBy', select: 'name email' },
    ]);
    
    // Notify requester
    try {
      const notifSvc = require('../services/notificationService');
      if (expense.requestedBy?.email) {
        await notifSvc.sendAlertEmail(
          expense.requestedBy.email,
          `Expense Approved — ${expense.title}`,
          `Your expense request for <strong>ETB ${expense.amount?.toLocaleString()}</strong> has been approved.`
        );
      }
    } catch {}
    
    res.json({ message: 'Expense approved', expense });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve expense', details: err.message });
  }
});

// ── POST /api/expenses/:id/reject — Reject expense request (Owner only) ──
router.post('/:id/reject', protect, authorize(OWNER), async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    if (expense.status !== 'pending') {
      return res.status(400).json({ error: `Cannot reject expense with status: ${expense.status}` });
    }
    
    expense.status = 'rejected';
    expense.rejectedBy = req.user._id;
    expense.rejectedAt = new Date();
    expense.rejectionReason = req.body.reason || 'No reason provided';
    
    await expense.save();
    
    await expense.populate([
      { path: 'farmId', select: 'name location' },
      { path: 'requestedBy', select: 'name email' },
    ]);
    
    // Notify requester
    try {
      const notifSvc = require('../services/notificationService');
      if (expense.requestedBy?.email) {
        await notifSvc.sendAlertEmail(
          expense.requestedBy.email,
          `Expense Rejected — ${expense.title}`,
          `Your expense request was rejected. Reason: ${expense.rejectionReason}`
        );
      }
    } catch {}
    
    res.json({ message: 'Expense rejected', expense });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject expense', details: err.message });
  }
});

// ── POST /api/expenses/:id/process — Mark as paid/processed ─────────────
router.post('/:id/process', protect, authorize(OWNER, OM), async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    if (expense.status !== 'approved') {
      return res.status(400).json({ error: 'Expense must be approved before processing' });
    }
    
    expense.status = 'processed';
    expense.processedBy = req.user._id;
    expense.processedAt = new Date();
    expense.transactionRef = req.body.transactionRef || '';
    
    await expense.save();
    
    await expense.populate([
      { path: 'farmId', select: 'name location' },
      { path: 'requestedBy', select: 'name email' },
      { path: 'processedBy', select: 'name email' },
    ]);
    
    // Notify requester
    try {
      const notifSvc = require('../services/notificationService');
      if (expense.requestedBy?.email) {
        await notifSvc.sendAlertEmail(
          expense.requestedBy.email,
          `Expense Processed — ${expense.title}`,
          `Your expense request for <strong>ETB ${expense.amount?.toLocaleString()}</strong> has been paid.`
        );
      }
    } catch {}
    
    res.json({ message: 'Expense processed', expense });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process expense', details: err.message });
  }
});

// ── POST /api/expenses/:id/cancel — Cancel expense ───────────────────────
router.post('/:id/cancel', protect, authorize(OWNER, OM), async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    if (!['draft', 'pending', 'approved'].includes(expense.status)) {
      return res.status(400).json({ error: `Cannot cancel expense with status: ${expense.status}` });
    }
    
    const role = getRole(req.user);
    
    // Farmer can only cancel own pending requests
    if (role === FM && expense.requestedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only cancel your own expenses' });
    }
    
    // OM can cancel own or pending (limited)
    if (role === OM && expense.requestedBy.toString() !== req.user._id.toString() && expense.status !== 'pending') {
      return res.status(403).json({ error: 'You can only cancel your own expenses or pending requests' });
    }
    
    // Owner/Admin can cancel any
    
    expense.status = 'cancelled';
    expense.notes = (expense.notes || '') + `\n[Cancelled by ${req.user.name} on ${new Date().toLocaleDateString()}${req.body.reason ? ': ' + req.body.reason : ''}]`;
    
    await expense.save();
    
    res.json({ message: 'Expense cancelled', expense });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel expense', details: err.message });
  }
});

// ── DELETE /api/expenses/:id — Hard delete (Owner only) ──────────────────
router.delete('/:id', protect, authorize(OWNER), async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete expense', details: err.message });
  }
});

module.exports = router;
