const mongoose = require('mongoose');

const bcrypt   = require('bcryptjs');

/**
 * SIMS User Model
 * ─────────────────────────────────────────────────────────────────────────
 * Roles (spec §2):
 *   owner            — Investor/Owner: business & financial authority
 *   admin            — System/Security authority (was super_administrator)
 *   office_manager   — HR/Payroll/Administration
 *   farmer           — Farm/Irrigation/Field operations
 *   labor            — Assigned field work
 *
 * Account lifecycle (spec §53, §54):
 *   requestedRole — role the user asked for at registration
 *   assignedRole  — role the admin officially grants (null until approved)
 *   accountStatus — PENDING → ACTIVE | REJECTED | SUSPENDED | DEACTIVATED
 *
 * Access rule (spec §73):
 *   A user may only access their role dashboard AFTER:
 *   Authentication + Approval (ACTIVE) + assignedRole set
 */
const ROLES = ['owner', 'admin', 'office_manager', 'farmer', 'labor'];

const ACCOUNT_STATUS = ['pending', 'active', 'suspended', 'rejected', 'deactivated'];

const UserSchema = new mongoose.Schema({
  /* ── Personal information ──────────────────────────────────── */
  name:    { type: String, required: true, trim: true },
  email:   { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:   { type: String, default: '' },
  address: { type: String, default: '' },
  avatar:  { type: String, default: '' },

  /* ── Authentication ────────────────────────────────────────── */
  password: { type: String },
  googleId: { type: String, unique: true, sparse: true },

  /* ── Role management (spec §54) ────────────────────────────── */
  // Role the user requested at registration
  requestedRole: {
    type: String,
    enum: [...ROLES, null],
    default: null,
  },
  // Role officially assigned after admin approval
  assignedRole: {
    type: String,
    enum: [...ROLES, null],
    default: null,
  },
  // Convenience alias — equals assignedRole when ACTIVE, else null
  // Used by protect middleware for all authorization checks
  role: {
    type: String,
    enum: [...ROLES, null],
    default: null,
  },

  /* ── Account status (spec §53) ─────────────────────────────── */
  accountStatus: {
    type:    String,
    enum:    ACCOUNT_STATUS,
    default: 'pending',
  },
  // Kept for backward-compat with existing protect middleware isActive check
  isActive: { type: Boolean, default: false },

  // Approval trail
  approvedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt:   { type: Date },
  rejectedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt:   { type: Date },
  rejectedReason: { type: String, default: '' },

  // Suspension trail
  suspendedAt:    { type: Date },
  suspendedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  suspendReason:  { type: String, default: '' },

  /* ── Organization / Farm assignment ────────────────────────── */
  // Farm this user is assigned to (for farmers/labor)
  farmId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' },
  // Alternative: Array of farms for multi-farm assignments
  assignedFarms:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Farm' }],
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null
  }, // future multi-tenant support

  /* ── Language & preferences ─────────────────────────────────── */
  language: { type: String, default: 'en' },

  /* ── Irrigation thresholds (farmer) ─────────────────────────── */
  lowMoistureThreshold:     { type: Number, default: 30 },
  optimalMoistureThreshold: { type: Number, default: 70 },

  /* ── Token management ───────────────────────────────────────── */
  refreshToken:        { type: String, select: false },
  refreshTokenExpires: { type: Date },
  resetPasswordToken:  { type: String },
  resetPasswordExpires:{ type: Date },
  magicLinkToken:      { type: String },
  magicLinkExpires:    { type: Date },

  /* ── Notification preferences ───────────────────────────────── */
  notifyEmail:       { type: Boolean, default: true },
  notifyLowMoisture: { type: Boolean, default: true },
  notifyTankEmpty:   { type: Boolean, default: true },
  notifyPumpAuto:    { type: Boolean, default: false },

}, { timestamps: true });

/* ── Indexes ─────────────────────────────────────────────────── */
UserSchema.index({ accountStatus: 1 });
UserSchema.index({ assignedRole: 1 });
UserSchema.index({ requestedRole: 1, accountStatus: 1 });

/* ── Pre-save: hash password ─────────────────────────────────── */
UserSchema.pre('save', async function () {
  if (!this.password || !this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/* ── Pre-save: sync isActive + role with accountStatus ──────── */
UserSchema.pre('save', function () {
  this.isActive = this.accountStatus === 'active';
  // role convenience alias mirrors assignedRole only when account is active
  // This ensures proper authorization checks work across the system
  if (this.accountStatus === 'active' && this.assignedRole) {
    this.role = this.assignedRole;
  } else {
    // Clear role alias when not active to prevent unauthorized access
    this.role = null;
  }
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
