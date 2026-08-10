const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // e.g., 'LOGIN', 'CREATE_FARM', 'UPDATE_DEVICE', 'MANUAL_PUMP_OVERRIDE'
  resource: { type: String }, // e.g., 'Farm', 'Device', 'Irrigation'
  resourceId: { type: mongoose.Schema.Types.ObjectId },
  details: { type: String },
  ipAddress: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
