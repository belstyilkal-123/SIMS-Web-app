const express       = require('express');
const router        = express.Router();
const mongoose      = require('mongoose');
const { protect, authorize, isAdministrator } = require('../middleware/authMiddleware');

const DASHBOARD_ROLES = ['owner', 'admin', 'office_manager', 'farmer'];
const SensorData    = require('../models/SensorData');
const Device        = require('../models/Device');
const Farm          = require('../models/Farm');
const IrrigationLog = require('../models/IrrigationLog');

/**
 * GET /api/dashboard/summary
 * Returns real aggregated sensor data for the user's farms/devices.
 * Falls back to null values when no device has ever reported data.
 */
router.get('/summary', protect, authorize(...DASHBOARD_ROLES), async (req, res) => {
  try {
    const { farmId } = req.query;

    // 1. Find devices — scope to a specific farm if requested
    const isPrivileged = isAdministrator(req.user) || (req.user.assignedRole || req.user.role) === 'owner';
    const ownedFarmIds = isPrivileged
      ? null
      : (await Farm.find({ ownerId: req.user._id }).select('_id')).map((farm) => farm._id);
    if (farmId && ownedFarmIds && !ownedFarmIds.some((id) => id.toString() === farmId)) {
      return res.status(403).json({ error: 'You do not have access to this farm.' });
    }
    const deviceQuery = farmId ? { farmId } : (ownedFarmIds ? { farmId: { $in: ownedFarmIds } } : {});
    const devices = await Device.find(deviceQuery).select('_id status lastSeen name');

    if (!devices.length) {
      return res.json(buildResponse(null, null, null));
    }

    const deviceIds = devices.map(d => d._id);

    // 2. Get the latest reading for each sensor type across all matching devices
    const sensorTypes = ['moisture', 'temperature', 'humidity', 'tankLevel', 'pH'];
    const latestReadings = {};

    await Promise.all(sensorTypes.map(async (type) => {
      const reading = await SensorData.findOne(
        { deviceId: { $in: deviceIds }, sensorType: type },
        null,
        { sort: { timestamp: -1 } }
      );
      latestReadings[type] = reading ? reading.value : null;
    }));

    // 3. Today's water usage — sum duration of ON logs today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayLogs = await IrrigationLog.find({
      deviceId: { $in: deviceIds },
      status: 'ON',
      timestamp: { $gte: startOfDay }
    });

    // Estimate litres: assume 10 L/min average flow rate
    const LITRES_PER_SECOND = 10 / 60;
    const totalSeconds = todayLogs.reduce((sum, log) => sum + (log.duration || 60), 0);
    const todayWaterUsage = Math.round(totalSeconds * LITRES_PER_SECOND);

    // 4. Last irrigation event
    const lastLog = await IrrigationLog.findOne(
      { deviceId: { $in: deviceIds } },
      null,
      { sort: { timestamp: -1 } }
    );

    // 5. Active device status
    const onlineDevice = devices.find(d => d.status === 'online');
    const pumpStatus = onlineDevice ? 'ON' : 'OFF'; // real pump status comes via WebSocket

    return res.json(buildResponse(latestReadings, lastLog, {
      todayWaterUsage,
      pumpStatus,
      devices,
      onlineCount: devices.filter(d => d.status === 'online').length,
      totalDevices: devices.length,
    }));

  } catch (error) {
    console.error('[Dashboard] Error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

/**
 * GET /api/dashboard/trends?farmId=&days=7
 * Returns daily aggregated sensor averages for trend charts.
 */
router.get('/trends', protect, authorize(...DASHBOARD_ROLES), async (req, res) => {
  try {
    const { farmId, days = 7 } = req.query;
    const dayCount = Math.min(parseInt(days) || 7, 30); // cap at 30 days

    const isPrivilegedT = isAdministrator(req.user) || (req.user.assignedRole || req.user.role) === 'owner';
    const ownedFarmIds = isPrivilegedT
      ? null
      : (await Farm.find({ ownerId: req.user._id }).select('_id')).map((farm) => farm._id);
    if (farmId && ownedFarmIds && !ownedFarmIds.some((id) => id.toString() === farmId)) {
      return res.status(403).json({ error: 'You do not have access to this farm.' });
    }
    const deviceQuery = farmId ? { farmId } : (ownedFarmIds ? { farmId: { $in: ownedFarmIds } } : {});
    const devices = await Device.find(deviceQuery).select('_id');
    if (!devices.length) return res.json([]);

    const deviceIds = devices.map(d => d._id);
    const since = new Date(Date.now() - dayCount * 24 * 60 * 60 * 1000);

    // Aggregate daily averages per sensor type
    const aggResult = await SensorData.aggregate([
      {
        $match: {
          deviceId: { $in: deviceIds },
          timestamp: { $gte: since },
          sensorType: { $in: ['moisture', 'temperature', 'humidity'] }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            type: '$sensorType'
          },
          avg: { $avg: '$value' }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Reshape into [{ date, moisture, temperature, humidity }, ...]
    const byDate = {};
    aggResult.forEach(({ _id, avg }) => {
      if (!byDate[_id.date]) byDate[_id.date] = { date: _id.date };
      byDate[_id.date][_id.type] = Math.round(avg * 10) / 10;
    });

    res.json(Object.values(byDate));
  } catch (error) {
    console.error('[Dashboard Trends] Error:', error);
    res.status(500).json({ error: 'Failed to fetch trend data' });
  }
});

// ── Helper ───────────────────────────────────────────────────
function buildResponse(readings, lastLog, meta) {
  return {
    soilMoisture:     readings?.moisture    ?? null,
    temperature:      readings?.temperature ?? null,
    humidity:         readings?.humidity    ?? null,
    tankLevel:        readings?.tankLevel   ?? null,
    soilPhLevel:      readings?.pH          ?? null,
    pumpStatus:       meta?.pumpStatus      ?? 'OFF',
    todayWaterUsage:  meta?.todayWaterUsage ?? 0,
    lastIrrigationTime: lastLog?.timestamp  ?? null,
    sensorHealth:     (meta?.onlineCount ?? 0) > 0 ? 'Good' : 'Offline',
    onlineDevices:    meta?.onlineCount     ?? 0,
    totalDevices:     meta?.totalDevices    ?? 0,
  };
}

module.exports = router;



