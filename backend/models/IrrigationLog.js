const mongoose = require('mongoose');

const IrrigationLogSchema = new mongoose.Schema({
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  status: { type: String, enum: ['ON', 'OFF'], required: true },
  triggeredBy: { type: String, enum: ['manual', 'auto'], required: true },
  duration: { type: Number }, // in seconds
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('IrrigationLog', IrrigationLogSchema);
