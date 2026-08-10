const mongoose = require('mongoose');

/**
 * MaintenanceTicket — field repair requests, equipment issues, and
 * scheduled maintenance tasks raised by any role and triaged by
 * Office Manager or Super Administrator.
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
    enum: ['open', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected'],
    default: 'open',
  },
  raisedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // labour worker
  resolvedAt:  { type: Date },
  closedAt:    { type: Date },
  // Photo evidence (stored as base64 or URL strings)
  photos:      [{ type: String }],
  // Resolution notes
  resolution:  { type: String, default: '' },
  // Scheduled maintenance date
  scheduledFor: { type: Date },
}, { timestamps: true });

MaintenanceTicketSchema.index({ farmId: 1, status: 1 });
MaintenanceTicketSchema.index({ assignedTo: 1, status: 1 });
MaintenanceTicketSchema.index({ raisedBy: 1 });

module.exports = mongoose.model('MaintenanceTicket', MaintenanceTicketSchema);
