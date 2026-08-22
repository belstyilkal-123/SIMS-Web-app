const mongoose = require('mongoose');

/**
 * AuditLog — immutable record of every security-relevant action in the system.
 *
 * Normalization fix: Added farmId for farm-scoped audit views, severity level,
 * structured metadata object (replaces plain String details), and proper indexes.
 * AuditLogs are never deleted (no TTL) — they are the legal paper trail.
 */
const AuditLogSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  farmId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' }, // ADDED — farm-scoped actions

  // e.g. 'LOGIN', 'LOGOUT', 'CREATE_FARM', 'UPDATE_DEVICE', 'MANUAL_PUMP_OVERRIDE',
  //      'APPROVE_USER', 'REJECT_USER', 'CHANGE_PASSWORD', 'DELETE_EXPENSE'
  action:     { type: String, required: true },

  // Which model was affected
  resource:   { type: String }, // e.g. 'Farm', 'Device', 'User', 'Expense'
  resourceId: { type: mongoose.Schema.Types.ObjectId },

  severity:   {                              // ADDED — for filtered views
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'info',
  },

  // Structured diff — replaces plain String. Stores old/new values for audit trails.
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, // ADDED (replaces `details`)

  // Network info
  ipAddress:  { type: String },
  userAgent:  { type: String }, // ADDED — browser/device fingerprint
}, {
  timestamps: true,    // createdAt = the canonical audit timestamp
  strict: false,       // allow extra fields in metadata without schema errors
});

// ── Indexes ────────────────────────────────────────────────────────────────
// Admin audit log view (user actions, newest first)
AuditLogSchema.index({ userId: 1, createdAt: -1 });
// System-wide log filtered by action type
AuditLogSchema.index({ action: 1, createdAt: -1 });
// Farm-scoped audit log
AuditLogSchema.index({ farmId: 1, createdAt: -1 });
// Security: filter by severity
AuditLogSchema.index({ severity: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
