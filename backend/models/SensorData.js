const mongoose = require('mongoose');

/**
 * SensorData — high-frequency IoT telemetry from ESP8266 devices.
 *
 * ──────────────────────────────────────────────────────────────────────
 * TIME-SERIES OPTIMISATION NOTE (MongoDB 5.0+):
 * For production deployments on MongoDB 5.0+ (Atlas or self-hosted),
 * replace this regular collection with a native Time Series collection:
 *
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
  deviceId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  sensorType: { type: String, required: true },  // moisture, temperature, humidity, tankLevel, pH, etc.
  value:      { type: Number, required: true },
  unit:       { type: String, default: '' },      // e.g. '%', '°C', 'pH'
  timestamp:  { type: Date, default: Date.now },   // index via schema.index() below
});

// ── Compound indexes for time-series query patterns ────────────────
// Primary: latest reading per device per sensor type
SensorDataSchema.index({ deviceId: 1, sensorType: 1, timestamp: -1 });
// Aggregation: all readings for a device in a time window
SensorDataSchema.index({ deviceId: 1, timestamp: -1 });
// TTL index: auto-delete readings older than 90 days (optional, adjustable)
SensorDataSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 }
);

module.exports = mongoose.model('SensorData', SensorDataSchema);
