const mongoose = require('mongoose');

const SensorSchema = new mongoose.Schema({
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  type: { type: String, enum: ['moisture', 'waterLevel', 'pH', 'temperature', 'humidity'], required: true },
  unit: { type: String, required: true },
  status: { type: String, enum: ['active', 'faulty'], default: 'active' },
});

module.exports = mongoose.model('Sensor', SensorSchema);
