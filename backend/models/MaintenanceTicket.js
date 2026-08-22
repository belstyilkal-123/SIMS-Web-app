const mongoose = require('mongoose');

/**
 * MaintenanceTicket — field repair requests, equipment issues, and
 * scheduled maintenance tasks raised by any role and triaged by
 * Office Manager or System Administrator.
 */
const MaintenanceTicketSchema = new mongoose.Schema({
  farmId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  deviceId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Device' }, // optional — linked device
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category:    {
    type: String,
    enum: ['pump', 'pipe', 'sensor', 'valve', 'electrical', 'filter', 'tank', 'other'],
    default: 'other',
  },
  priority:    { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status:      {
    type: String,
    enum: ['open', 'assigned', 'approved', 'in_progress', 'resolved', 'confirmed', 'closed', 'rejected'],
    default: 'open',
  },
  raisedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // labour worker
  updatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // tracks who last changed status
  resolvedAt:  { type: Date },
  closedAt:    { type: Date },
  // Photo evidence (stored as base64 or URL strings)
  photos:      [{ type: String }],
  // Resolution notes
  resolution:  { type: String, default: '' },
  // Repair cost tracking (Owner & OM)
  repairCost:  { type: Number, default: 0 },
  // Scheduled maintenance date
  scheduledFor: { type: Date },
}, { timestamps: true });

// ── Indexes ────────────────────────────────────────────────────────────────
MaintenanceTicketSchema.index({ farmId: 1, status: 1 });
MaintenanceTicketSchema.index({ assignedTo: 1, status: 1 });
MaintenanceTicketSchema.index({ raisedBy: 1 });
// NEW: repair history lookup per device
MaintenanceTicketSchema.index({ deviceId: 1 });
MaintenanceTicketSchema.index({ deviceId: 1, status: 1 });

module.exports = mongoose.model('MaintenanceTicket', MaintenanceTicketSchema);
