/**
 * Expense Model
 * 
 * Represents expense requests created by Farmer, Office Manager, or Owner.
 * Workflow: Created → Submitted → Reviewed → Approved/Rejected → Processed
 * 
 * Role permissions:
 * - Owner: Create, view all, approve, process, cancel
 * - Office Manager: Create, view all, approve limited, process
 * - Farmer: Create own, view own, upload receipt
 * - Labour: No access
 */

const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  // ── Core Fields ────────────────────────────────────────────────────────
  title: {
    type: String,
    required: [true, 'Expense title is required'],
    trim: true,
    maxlength: 200,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000,
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'seeds',           // Seeds and seedlings
      'fertilizer',      // Fertilizers and soil amendments
      'pesticides',      // Pesticides and herbicides
      'equipment',       // Tools and equipment
      'maintenance',     // Equipment maintenance
      'labor',           // Casual labor payments
      'transport',       // Transportation costs
      'utilities',       // Water, electricity, etc.
      'other'            // Other expenses
    ],
    default: 'other',
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative'],
  },
  currency: {
    type: String,
    default: 'ETB',
  },
  
  // ── Farm Association ───────────────────────────────────────────────────
  farmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: [true, 'Farm is required'],
  },
  
  // ── Requester (who created the expense request) ─────────────────────────
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  requesterRole: {
    type: String,
    enum: ['owner', 'office_manager', 'farmer'],
    required: true,
  },
  
  // ── Approval Workflow ───────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected', 'processed', 'cancelled'],
    default: 'pending',
  },
  
  // Approval chain
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: {
    type: Date,
  },
  approvalNotes: {
    type: String,
    trim: true,
  },
  
  // Rejection
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  rejectedAt: {
    type: Date,
  },
  rejectionReason: {
    type: String,
    trim: true,
  },
  
  // Processing (payment made)
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  processedAt: {
    type: Date,
  },
  transactionRef: {
    type: String,
    trim: true,  // Bank transfer reference, receipt number, etc.
  },
  
  // ── Receipt / Proof ─────────────────────────────────────────────────────
  receiptImage: {
    type: String,  // Base64 encoded image or URL
  },
  receiptNote: {
    type: String,
    trim: true,
  },
  
  // ── Dates ───────────────────────────────────────────────────────────────
  expenseDate: {
    type: Date,    // When the expense was incurred
    default: Date.now,
  },
  dueDate: {
    type: Date,    // Payment deadline (if applicable)
  },
  
  // ── Metadata ────────────────────────────────────────────────────────────
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  tags: [{
    type: String,
    trim: true,
  }],
  notes: {
    type: String,
    trim: true,
  },
  
  // ── Audit Trail ─────────────────────────────────────────────────────────
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ── Indexes ────────────────────────────────────────────────────────────────
expenseSchema.index({ farmId: 1, status: 1 });
expenseSchema.index({ requestedBy: 1, status: 1 });
expenseSchema.index({ status: 1, createdAt: -1 });
expenseSchema.index({ category: 1 });

// ── Virtuals ───────────────────────────────────────────────────────────────
expenseSchema.virtual('isPending').get(function() {
  return this.status === 'pending';
});

expenseSchema.virtual('isApproved').get(function() {
  return ['approved', 'processed'].includes(this.status);
});

expenseSchema.virtual('canEdit').get(function() {
  return ['draft', 'pending'].includes(this.status);
});

expenseSchema.virtual('canApprove').get(function() {
  return this.status === 'pending';
});

expenseSchema.virtual('canProcess').get(function() {
  return this.status === 'approved';
});

expenseSchema.virtual('canCancel').get(function() {
  return ['draft', 'pending', 'approved'].includes(this.status);
});

// ── Pre-save middleware ────────────────────────────────────────────────────
expenseSchema.pre('save', function() {
  // Auto-set requesterRole from the requester's role if not set
  if (!this.requesterRole && this.requestedBy) {
    // Handled in route/controller
  }
});

// ── Static methods ─────────────────────────────────────────────────────────
expenseSchema.statics.getStatsByFarm = async function(farmId) {
  const stats = await this.aggregate([
    { $match: { farmId: new mongoose.Types.ObjectId(farmId) } },
    { $group: {
      _id: '$status',
      count: { $sum: 1 },
      totalAmount: { $sum: '$amount' },
    }},
  ]);
  
  const result = {
    total: 0,
    pending: { count: 0, amount: 0 },
    approved: { count: 0, amount: 0 },
    processed: { count: 0, amount: 0 },
    rejected: { count: 0, amount: 0 },
    cancelled: { count: 0, amount: 0 },
  };
  
  stats.forEach(s => {
    result.total += s.count;
    if (result[s._id]) {
      result[s._id].count = s.count;
      result[s._id].amount = s.totalAmount;
    }
  });
  
  return result;
};

expenseSchema.statics.getStatsByUser = async function(userId) {
  const stats = await this.aggregate([
    { $match: { requestedBy: new mongoose.Types.ObjectId(userId) } },
    { $group: {
      _id: '$status',
      count: { $sum: 1 },
      totalAmount: { $sum: '$amount' },
    }},
  ]);
  
  const result = {
    total: 0,
    pending: { count: 0, amount: 0 },
    approved: { count: 0, amount: 0 },
    processed: { count: 0, amount: 0 },
    rejected: { count: 0, amount: 0 },
  };
  
  stats.forEach(s => {
    result.total += s.count;
    if (result[s._id]) {
      result[s._id].count = s.count;
      result[s._id].amount = s.totalAmount;
    }
  });
  
  return result;
};

const Expense = mongoose.model('Expense', expenseSchema);
module.exports = Expense;
