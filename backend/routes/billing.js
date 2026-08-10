const express = require('express');
const router  = express.Router();
const Invoice = require('../models/Invoice');
const { protect, authorize } = require('../middleware/authMiddleware');

const SA   = 'super_administrator';
const OM   = 'office_manager';
const FM   = 'farmer';
const MGMT = [SA, OM];
const ALL  = [SA, OM, FM];

/* ── helpers ─────────────────────────────────────────────────────────── */
const ownerFilter = async (user) => {
  if (user.role === SA || user.role === OM) return {};
  return { farmOwnerId: user._id };
};

// ── GET /api/billing — list invoices ─────────────────────────────────
router.get('/', protect, authorize(...ALL), async (req, res) => {
  try {
    const { farmId, status, periodStart, periodEnd } = req.query;
    const query = await ownerFilter(req.user);

    if (farmId) query.farmId = farmId;
    if (status) query.paymentStatus = status;
    if (periodStart || periodEnd) {
      query.periodStart = {};
      if (periodStart) query.periodStart.$gte = new Date(periodStart);
      if (periodEnd)   query.periodEnd = { $lte: new Date(periodEnd) };
    }

    const invoices = await Invoice.find(query)
      .populate('farmId',      'name location')
      .populate('farmOwnerId', 'name email')
      .populate('generatedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices', details: err.message });
  }
});

// ── GET /api/billing/:id ──────────────────────────────────────────────
router.get('/:id', protect, authorize(...ALL), async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('farmId',      'name location')
      .populate('farmOwnerId', 'name email')
      .populate('generatedBy', 'name email');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Farmer can only view own invoices
    if (req.user.role === FM &&
        invoice.farmOwnerId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoice', details: err.message });
  }
});

// ── POST /api/billing — generate invoice (MGMT only) ─────────────────
router.post('/', protect, authorize(...MGMT), async (req, res) => {
  try {
    const {
      farmId, farmOwnerId, periodStart, periodEnd,
      waterUsedLitres, ratePerLitre,
      maintenanceFee, serviceCharge, tax, discount,
      dueDate, notes,
    } = req.body;

    if (!farmId || !farmOwnerId || !periodStart || !periodEnd) {
      return res.status(400).json({
        error: 'farmId, farmOwnerId, periodStart and periodEnd are required',
      });
    }

    const invoice = await Invoice.create({
      farmId, farmOwnerId,
      generatedBy: req.user._id,
      periodStart: new Date(periodStart),
      periodEnd:   new Date(periodEnd),
      waterUsedLitres: Number(waterUsedLitres || 0),
      ratePerLitre:    Number(ratePerLitre    || 0),
      maintenanceFee:  Number(maintenanceFee  || 0),
      serviceCharge:   Number(serviceCharge   || 0),
      tax:             Number(tax             || 0),
      discount:        Number(discount        || 0),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes,
    });

    await invoice.populate([
      { path: 'farmId',      select: 'name' },
      { path: 'farmOwnerId', select: 'name email' },
    ]);
    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate invoice', details: err.message });
  }
});

// ── PUT /api/billing/:id — update invoice (MGMT) or record payment (Farmer) ──
router.put('/:id', protect, authorize(...ALL), async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    if (req.user.role === FM) {
      // Farmer can only upload receipt and record payment
      if (invoice.farmOwnerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const allowed = ['paidAmount', 'receiptImage', 'receiptNote'];
      allowed.forEach(f => { if (req.body[f] !== undefined) invoice[f] = req.body[f]; });
    } else {
      // MGMT can update everything
      const allowed = [
        'waterUsedLitres', 'ratePerLitre', 'maintenanceFee', 'serviceCharge',
        'tax', 'discount', 'paymentStatus', 'paidAmount', 'dueDate', 'notes',
        'receiptImage', 'receiptNote',
      ];
      allowed.forEach(f => { if (req.body[f] !== undefined) invoice[f] = req.body[f]; });
    }

    await invoice.save();
    await invoice.populate([
      { path: 'farmId',      select: 'name' },
      { path: 'farmOwnerId', select: 'name email' },
      { path: 'generatedBy', select: 'name email' },
    ]);
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update invoice', details: err.message });
  }
});

// ── DELETE /api/billing/:id — SA only ────────────────────────────────
router.delete('/:id', protect, authorize(SA), async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete invoice', details: err.message });
  }
});

// ── GET /api/billing/stats/summary — totals by status ────────────────
router.get('/stats/summary', protect, authorize(...ALL), async (req, res) => {
  try {
    const match = req.user.role === FM ? { farmOwnerId: req.user._id } : {};
    const result = await Invoice.aggregate([
      { $match: match },
      { $group: {
        _id: '$paymentStatus',
        count:       { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        paidAmount:  { $sum: '$paidAmount' },
      }},
    ]);

    const summary = { pending:0, paid:0, overdue:0, totalRevenue:0, outstandingAmount:0 };
    result.forEach(r => {
      summary[r._id] = r.count;
      if (r._id === 'paid') summary.totalRevenue     += r.paidAmount;
      if (['pending','overdue','partially_paid'].includes(r._id)) {
        summary.outstandingAmount += (r.totalAmount - r.paidAmount);
      }
    });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch billing stats', details: err.message });
  }
});

module.exports = router;
