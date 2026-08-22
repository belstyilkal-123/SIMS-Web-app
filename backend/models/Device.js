const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },

  // Classification — what kind of hardware this device is
  deviceType: {
    type: String,
    enum: ['sensor_node', 'pump_controller', 'valve', 'weather_station', 'gateway', 'other'],
    default: 'sensor_node',
  },

  macAddress:      { type: String, required: true, unique: true, uppercase: true, trim: true },
  name:            { type: String, required: true, trim: true },
  status:          { type: String, enum: ['online', 'offline', 'error'], default: 'offline' },
  batteryLevel:    { type: Number, default: 100, min: 0, max: 100 },
  signalStrength:  { type: Number, default: -50 },
  firmwareVersion: { type: String, default: '1.0.0' },
  lastSeen:        { type: Date, default: Date.now },
}, { timestamps: true }); // adds createdAt AND updatedAt automatically

// ── Indexes ────────────────────────────────────────────────────────────────
// Fast lookup of all devices on a specific farm
DeviceSchema.index({ farmId: 1 });
// Quick status checks (e.g. all offline devices)
DeviceSchema.index({ farmId: 1, status: 1 });

module.exports = mongoose.model('Device', DeviceSchema);
