const mongoose = require('mongoose');

/**
 * IrrigationLog — records every pump ON/OFF event.
 *
 * Normalization fix: Added farmId for direct farm-level reporting without
 * having to join through Device. Added triggeredByUser ref for manual overrides.
 * Added indexes for time-range queries and per-farm history views.
 */
const IrrigationLogSchema = new mongoose.Schema({
  farmId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true }, // ADDED
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  status:   { type: String, enum: ['ON', 'OFF'], required: true },
  triggeredBy: { type: String, enum: ['manual', 'auto', 'schedule'], required: true },
  // Who triggered the manual override (null for auto)
  triggeredByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // ADDED
  duration:  { type: Number, default: 0 }, // seconds — filled in when pump turns OFF
  waterUsed: { type: Number, default: 0 }, // litres — estimated from duration (optional)
  timestamp: { type: Date, default: Date.now },
}, { timestamps: false }); // timestamp field is the canonical time — no need for separate createdAt

// ── Indexes ────────────────────────────────────────────────────────────────
// Per-device event history (most common query)
IrrigationLogSchema.index({ deviceId: 1, timestamp: -1 });
// Per-farm history for dashboard / reports
IrrigationLogSchema.index({ farmId: 1, timestamp: -1 });
// TTL: auto-delete logs older than 1 year
IrrigationLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });

module.exports = mongoose.model('IrrigationLog', IrrigationLogSchema);
