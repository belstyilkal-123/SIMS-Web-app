const mongoose = require('mongoose');

/**
 * Payroll — monthly wage record for any active employee.
 * Created by the Office Manager, approved by the Owner.
 * Eligible users: admin, farmer, office_manager, labor (NOT owner).
 */
const PayrollSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  farmId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  period:        { type: String, required: true }, // e.g. "2026-07"  (YYYY-MM)
  baseSalary:    { type: Number, required: true, min: 0 },
  bonus:         { type: Number, default: 0, min: 0 },
  deductions:    { type: Number, default: 0, min: 0 },
  netPay:        { type: Number, default: 0, min: 0 },  // computed before save
  hoursWorked:   { type: Number, default: 0 },
  daysPresent:   { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['pending', 'submitted', 'paid', 'cancelled'], default: 'pending' },
  paidAt:        { type: Date },
  approvedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes:         { type: String, default: '' },
}, { timestamps: true });

// Enforce one payroll record per worker per period
PayrollSchema.index({ userId: 1, period: 1 }, { unique: true });
PayrollSchema.index({ farmId: 1, period: 1 });

// Auto-compute netPay before every save
PayrollSchema.pre('save', function () {
  this.netPay = Math.max(0, this.baseSalary + this.bonus - this.deductions);
});

module.exports = mongoose.model('Payroll', PayrollSchema);
