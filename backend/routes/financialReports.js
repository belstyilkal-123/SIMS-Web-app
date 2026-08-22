/**
 * Financial Reports Routes
 * 
 * Provides aggregated financial data for dashboards and reports (Expenses & Payroll).
 * 
 * Role Permissions:
 * - Owner: Full access to all financial data
 * - Office Manager: Full access to all financial data
 * - Farmer: Limited access (own farm only)
 * - Labour: No access
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, authorize, getUserRole } = require('../middleware/authMiddleware');

const OWNER = 'owner';
const SA    = 'admin';
const OM    = 'office_manager';
const FM    = 'farmer';

const CAN_VIEW = [OWNER, SA, OM, FM];

// ── GET /api/financial-reports/summary — Main financial dashboard data ────
router.get('/summary', protect, authorize(...CAN_VIEW), async (req, res) => {
  try {
    const role = getUserRole(req.user);
    const { farmId, periodStart, periodEnd } = req.query;

    const Payroll = require('../models/Payroll');
    const Expense = require('../models/Expense');
    const Farm    = require('../models/Farm');

    // Build filters based on role
    let farmFilter = {};
    if (role === FM) {
      // Farmer can only see their own farm data
      const userFarms = await Farm.find({ ownerId: req.user._id }).select('_id');
      const farmIds = userFarms.map(f => f._id);
      farmFilter = { farmId: { $in: farmIds } };
    } else if (farmId) {
      farmFilter = { farmId: mongoose.Types.ObjectId.createFromHexString(farmId) };
    }

    // Date filter
    const dateFilter = {};
    if (periodStart || periodEnd) {
      dateFilter.createdAt = {};
      if (periodStart) dateFilter.createdAt.$gte = new Date(periodStart);
      if (periodEnd)   dateFilter.createdAt.$lte = new Date(periodEnd);
    }

    // ── Payroll Stats ──────────────────────────────────────────────────────
    const payrollStats = await Payroll.aggregate([
      { $match: { ...farmFilter, ...dateFilter } },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalNetPay: { $sum: '$netPay' },
          totalBase: { $sum: '$baseSalary' },
          totalBonus: { $sum: '$bonus' },
          totalDeductions: { $sum: '$deductions' },
        }
      }
    ]);

    const payroll = {
      total: 0,
      pending: { count: 0, amount: 0 },
      submitted: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
      totalPaid: 0,
      totalPending: 0,
    };

    payrollStats.forEach(s => {
      payroll.total += s.count;
      if (payroll[s._id]) {
        payroll[s._id].count = s.count;
        payroll[s._id].amount = s.totalNetPay;
      }
      if (s._id === 'paid') {
        payroll.totalPaid += s.totalNetPay;
      }
      if (['pending', 'submitted'].includes(s._id)) {
        payroll.totalPending += s.totalNetPay;
      }
    });

    // ── Expense Stats ──────────────────────────────────────────────────────
    const expenseStats = await Expense.aggregate([
      { $match: { ...farmFilter, ...dateFilter } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        }
      }
    ]);

    const expenses = {
      total: 0,
      pending: { count: 0, amount: 0 },
      approved: { count: 0, amount: 0 },
      processed: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
      totalProcessed: 0,
      totalPending: 0,
    };

    expenseStats.forEach(s => {
      expenses.total += s.count;
      if (expenses[s._id]) {
        expenses[s._id].count = s.count;
        expenses[s._id].amount = s.totalAmount;
      }
      if (s._id === 'processed') {
        expenses.totalProcessed += s.totalAmount;
      }
      if (['pending', 'approved'].includes(s._id)) {
        expenses.totalPending += s.totalAmount;
      }
    });

    // ── Expense by Category ────────────────────────────────────────────────
    const expenseByCategory = await Expense.aggregate([
      { $match: { ...farmFilter, status: 'processed' } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        }
      }
    ]);

    const totalOutflow = payroll.totalPaid + expenses.totalProcessed;

    res.json({
      summary: {
        totalPayrollPaid: payroll.totalPaid,
        totalExpensesPaid: expenses.totalProcessed,
        totalOutflow,
        pendingOutflow: payroll.totalPending + expenses.totalPending,
      },
      payroll,
      expenses,
      expenseByCategory,
      canViewAll: ['owner', 'admin', 'office_manager'].includes(role),
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to generate financial summary', details: err.message });
  }
});

module.exports = router;
