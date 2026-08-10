const mongoose = require('mongoose');

const CommandSchema = new mongoose.Schema({
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  sensorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sensor' }, // Optional, if command targets specific sensor/actuator (like a pump)
  commandType: { type: String, required: true }, // e.g., 'PUMP_ON', 'PUMP_OFF', 'REBOOT'
  payload: { type: mongoose.Schema.Types.Mixed }, // Additional data for the command
  status: { type: String, enum: ['pending', 'sent', 'acknowledged', 'failed'], default: 'pending' },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who issued the command (can be null if automated)
  executedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Command', CommandSchema);
