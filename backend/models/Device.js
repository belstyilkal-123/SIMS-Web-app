const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  macAddress: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['online', 'offline', 'error'], default: 'offline' },
  batteryLevel: { type: Number, default: 100 },
  signalStrength: { type: Number, default: -50 },
  firmwareVersion: { type: String, default: '1.0.0' },
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Device', DeviceSchema);
