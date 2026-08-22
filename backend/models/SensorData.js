const mongoose = require('mongoose');

/**
 * SensorData — high-frequency IoT telemetry from ESP8266 devices.
 *
 * ──────────────────────────────────────────────────────────────────────
 * TIME-SERIES OPTIMISATION NOTE (MongoDB 5.0+):
 * For production deployments on MongoDB 5.0+ (Atlas or self-hosted),
 * you can enable native Time Series collections for better performance.
 * The schema below works on all MongoDB versions (4.0+).
 *
 * To enable Time Series on MongoDB 5.0+:
 *   db.createCollection('sensordatas', {
 *     timeseries: {
 *       timeField:   'timestamp',
 *       metaField:   'deviceId',
 *       granularity: 'minutes',
 *     },
 *     expireAfterSeconds: 60 * 60 * 24 * 90,  // auto-expire data after 90 days
 *   });
 *
 * Benefits: 90% storage reduction, 10–100× faster range queries,
 * built-in TTL data expiration. The schema and query code below stay identical.
 * ──────────────────────────────────────────────────────────────────────
 */
const SensorDataSchema = new mongoose.Schema({
  farmId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' }, // optimized for dashboard querying
  deviceId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  sensorType: { type: String, required: true },  // moisture, temperature, humidity, tankLevel, pH, etc.
  value:      { type: Number, required: true },
  unit:       { type: String, default: '' },      // e.g. '%', '°C', 'pH'
  timestamp:  { type: Date, default: Date.now },   // index via schema.index() below
}); // Note: timeseries option removed for MongoDB 4.x compatibility. Enable on MongoDB 5.0+ deployments.

// ── Compound indexes for time-series query patterns ────────────────
// Primary: latest reading per device per sensor type
SensorDataSchema.index({ deviceId: 1, sensorType: 1, timestamp: -1 });
// Aggregation: all readings for a device in a time window
SensorDataSchema.index({ deviceId: 1, timestamp: -1 });
// Dashboard: all readings across a farm
SensorDataSchema.index({ farmId: 1, timestamp: -1 });
// TTL index: auto-delete readings older than 90 days (optional, adjustable)
SensorDataSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 }
);

module.exports = mongoose.model('SensorData', SensorDataSchema);
