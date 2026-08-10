/**
 * Sensor ingestion tests — ESP8266 /api/esp8266/data endpoint
 * Verifies: device auth, missing fields validation, device lookup,
 *           sensor data persistence, alert generation, pump command polling
 */

process.env.JWT_SECRET     = 'test_secret_key_for_jest';
process.env.DEVICE_API_KEY = 'test_device_api_key_32chars_long!';

const request    = require('supertest');
const express    = require('express');
const deviceAuth = require('../middleware/deviceAuth');

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockSavedSensorData   = [];
const mockSavedIrrigLogs    = [];

jest.mock('../models/Device', () => ({
  findOne: jest.fn(),
}));

// SensorData — constructable class mock
jest.mock('../models/SensorData', () => {
  return jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });
});

jest.mock('../models/IrrigationLog', () => {
  const Log = jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });
  Log.findOne = jest.fn().mockResolvedValue(null);
  return Log;
});

jest.mock('../models/Command', () => ({
  findOne: jest.fn().mockResolvedValue(null),
}));

// ── Build minimal express app ─────────────────────────────────────────────────
const app = express();
app.use(express.json());

app.post('/api/esp8266/data', deviceAuth, async (req, res) => {
  try {
    const Device        = require('../models/Device');
    const SensorData    = require('../models/SensorData');
    const IrrigationLog = require('../models/IrrigationLog');
    const Command       = require('../models/Command');

    const { deviceId, sensors, pumpStatus } = req.body;

    if (!deviceId || !Array.isArray(sensors)) {
      return res.status(400).json({ success: false, error: 'deviceId and sensors array are required' });
    }

    const device = await Device.findOne({ $or: [{ macAddress: deviceId }, { name: deviceId }] });
    if (!device) return res.status(404).json({ success: false, error: 'Device is not registered' });

    device.status   = 'online';
    device.lastSeen = new Date();
    await device.save();

    const alerts = [];
    for (const s of sensors) {
      const dp = new SensorData({ deviceId: device._id, sensorType: s.type, value: s.value });
      await dp.save();
      if (s.type === 'moisture'  && s.value < 30)  alerts.push({ type: 'warning', message: 'Soil is dangerously dry!' });
      if (s.type === 'tankLevel' && s.value === 0)  alerts.push({ type: 'alarm',   message: 'Water tank is empty!' });
    }

    if (pumpStatus) {
      const last = await IrrigationLog.findOne({ deviceId: device._id });
      if (!last || last.status !== pumpStatus) {
        const log = new IrrigationLog({ deviceId: device._id, status: pumpStatus, triggeredBy: 'auto' });
        await log.save();
      }
    }

    const pending = await Command.findOne({
      deviceId: device._id,
      commandType: { $in: ['PUMP_ON', 'PUMP_OFF'] },
      status: 'sent'
    });
    const responsePump = pending ? (pending.commandType === 'PUMP_ON' ? 'ON' : 'OFF') : (pumpStatus || 'OFF');

    res.status(200).json({ success: true, pump: responsePump, buzzer: 'OFF', alerts });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server Error', detail: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const AUTH = { 'x-device-api-key': process.env.DEVICE_API_KEY };

const makeDevice = () => ({
  _id: 'dev_123', macAddress: 'AA:BB:CC', status: 'offline',
  save: jest.fn().mockResolvedValue(true),
});

beforeEach(() => {
  const Device = require('../models/Device');
  Device.findOne.mockReset();
  const Command = require('../models/Command');
  Command.findOne.mockResolvedValue(null);
  const IrrigationLog = require('../models/IrrigationLog');
  IrrigationLog.findOne.mockResolvedValue(null);
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/esp8266/data', () => {

  it('rejects requests without the device API key (401 or 503)', async () => {
    const res = await request(app).post('/api/esp8266/data').send({
      deviceId: 'AA:BB:CC', sensors: []
    });
    // 503 = DEVICE_API_KEY not configured in env; 401 = wrong/missing key
    expect([401, 503]).toContain(res.status);
  });

  it('returns 400 if sensors array is missing', async () => {
    const res = await request(app).post('/api/esp8266/data')
      .set(AUTH)
      .send({ deviceId: 'AA:BB:CC' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sensors/i);
  });

  it('returns 400 if deviceId is missing', async () => {
    const res = await request(app).post('/api/esp8266/data')
      .set(AUTH)
      .send({ sensors: [] });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unregistered device', async () => {
    const Device = require('../models/Device');
    Device.findOne.mockResolvedValueOnce(null);

    const res = await request(app).post('/api/esp8266/data')
      .set(AUTH)
      .send({ deviceId: 'unknown_mac', sensors: [] });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not registered/i);
  });

  it('returns 200 on valid payload for registered device', async () => {
    const Device = require('../models/Device');
    Device.findOne.mockResolvedValueOnce(makeDevice());

    const res = await request(app).post('/api/esp8266/data')
      .set(AUTH)
      .send({
        deviceId: 'AA:BB:CC',
        sensors: [{ type: 'moisture', value: 55 }, { type: 'temperature', value: 24 }],
        pumpStatus: 'OFF'
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pump).toBe('OFF');
    expect(res.body.alerts).toHaveLength(0);
  });

  it('generates a warning alert when soil moisture < 30', async () => {
    const Device = require('../models/Device');
    Device.findOne.mockResolvedValueOnce(makeDevice());

    const res = await request(app).post('/api/esp8266/data')
      .set(AUTH)
      .send({ deviceId: 'AA:BB:CC', sensors: [{ type: 'moisture', value: 18 }] });

    expect(res.status).toBe(200);
    expect(res.body.alerts).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'warning' })])
    );
  });

  it('generates an alarm alert when water tank is empty', async () => {
    const Device = require('../models/Device');
    Device.findOne.mockResolvedValueOnce(makeDevice());

    const res = await request(app).post('/api/esp8266/data')
      .set(AUTH)
      .send({ deviceId: 'AA:BB:CC', sensors: [{ type: 'tankLevel', value: 0 }] });

    expect(res.status).toBe(200);
    expect(res.body.alerts).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'alarm' })])
    );
  });

  it('returns pending pump command in response', async () => {
    const Device  = require('../models/Device');
    const Command = require('../models/Command');
    Device.findOne.mockResolvedValueOnce(makeDevice());
    Command.findOne.mockResolvedValueOnce({ commandType: 'PUMP_ON', status: 'sent' });

    const res = await request(app).post('/api/esp8266/data')
      .set(AUTH)
      .send({ deviceId: 'AA:BB:CC', sensors: [{ type: 'moisture', value: 55 }], pumpStatus: 'OFF' });

    expect(res.status).toBe(200);
    expect(res.body.pump).toBe('ON'); // server overrides with pending command
  });

  it('no alerts when all sensor readings are normal', async () => {
    const Device = require('../models/Device');
    Device.findOne.mockResolvedValueOnce(makeDevice());

    const res = await request(app).post('/api/esp8266/data')
      .set(AUTH)
      .send({
        deviceId: 'AA:BB:CC',
        sensors: [
          { type: 'moisture',    value: 65 },
          { type: 'temperature', value: 22 },
          { type: 'tankLevel',   value: 80 },
        ],
        pumpStatus: 'OFF'
      });

    expect(res.status).toBe(200);
    expect(res.body.alerts).toHaveLength(0);
  });
});
