const express = require('express');
const router  = express.Router();
const { protect, authorize, getUserRole } = require('../middleware/authMiddleware');

const ADMIN = 'admin';
const OWNER = 'owner';
const OM    = 'office_manager';
const FM    = 'farmer';
const LABOR = 'labor';

// @route  GET /api/reports/history — Sensor & Irrigation history report
// Admin 🟡 System, Owner ✅ Full, Farmer ✅ Full, Labour 🟡 Limited
router.get('/history', protect, authorize(ADMIN, OWNER, FM, LABOR), async (req, res) => {
  try {
    const Device        = require('../models/Device');
    const Farm          = require('../models/Farm');
    const IrrigationLog = require('../models/IrrigationLog');
    const SensorData    = require('../models/SensorData');

    const role = getUserRole(req.user);
    let farmQuery = {};

    if (role === OWNER) {
      farmQuery = { ownerId: req.user._id };
    } else if (role === FM) {
      farmQuery = { ownerId: req.user._id };
    } else if (role === LABOR) {
      const User = require('../models/User');
      const u = await User.findById(req.user._id).select('assignedFarms farmId');
      const farmIds = u?.assignedFarms?.length ? u.assignedFarms : (u?.farmId ? [u.farmId] : []);
      farmQuery = { _id: { $in: farmIds } };
    }

    const farms     = await Farm.find(farmQuery);
    const farmIds   = farms.map(f => f._id);
    const devices   = await Device.find({ farmId: { $in: farmIds } });
    const deviceIds = devices.map(d => d._id);

    const dbLogs = await IrrigationLog.find({ deviceId: { $in: deviceIds } })
      .populate({ path: 'deviceId', populate: { path: 'farmId', select: 'name' } })
      .sort({ timestamp: -1 })
      .limit(200);

    const logs = dbLogs.map(log => ({
      _id:       log._id,
      timestamp: log.timestamp,
      farm:      log.deviceId?.farmId?.name || 'Unknown Field',
      device:    log.deviceId?.name         || 'Unknown Unit',
      mode:      log.triggeredBy            || 'auto',
      status:    log.status,
      waterUsed: log.duration ? Math.round(log.duration * (10 / 60)) : 0,
      duration:  log.duration || 0,
    }));

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const aggResult = await SensorData.aggregate([
      {
        $match: {
          deviceId:   { $in: deviceIds },
          timestamp:  { $gte: since },
          sensorType: { $in: ['moisture', 'temperature'] }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%d/%m/%Y', date: '$timestamp' } },
            type: '$sensorType'
          },
          avg: { $avg: '$value' }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    const byDate = {};
    aggResult.forEach(({ _id, avg }) => {
      if (!byDate[_id.date]) byDate[_id.date] = { date: _id.date, soilMoisture: null, temperature: null, waterUsage: 0 };
      if (_id.type === 'moisture')    byDate[_id.date].soilMoisture = Math.round(avg * 10) / 10;
      if (_id.type === 'temperature') byDate[_id.date].temperature  = Math.round(avg * 10) / 10;
    });

    dbLogs.forEach(log => {
      if (!log.timestamp || !log.duration) return;
      const dateStr = new Date(log.timestamp).toLocaleDateString('en-GB').replace(/\//g, '/');
      if (byDate[dateStr]) {
        byDate[dateStr].waterUsage += Math.round(log.duration * (10 / 60));
      }
    });

    const trends = Object.values(byDate);

    res.json({
      logs,
      trends,
      hasRealData: logs.length > 0 || trends.length > 0,
      message: (logs.length === 0 && trends.length === 0)
        ? 'No data available.'
        : null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history logs', details: error.message });
  }
});

// @route  GET /api/reports/daily — Daily aggregate report
router.get('/daily', protect, authorize(ADMIN, OWNER, FM, LABOR), async (req, res) => {
  try {
    const SensorData    = require('../models/SensorData');
    const IrrigationLog = require('../models/IrrigationLog');
    const Device        = require('../models/Device');
    const Farm          = require('../models/Farm');

    const role = getUserRole(req.user);
    let farmQuery = {};

    if (role === OWNER || role === FM) {
      farmQuery = { ownerId: req.user._id };
    } else if (role === LABOR) {
      const User = require('../models/User');
      const u = await User.findById(req.user._id).select('assignedFarms farmId');
      const farmIds = u?.assignedFarms?.length ? u.assignedFarms : (u?.farmId ? [u.farmId] : []);
      farmQuery = { _id: { $in: farmIds } };
    }

    const farms     = await Farm.find(farmQuery);
    const farmIds   = farms.map(f => f._id);
    const devices   = await Device.find({ farmId: { $in: farmIds } });
    const deviceIds = devices.map(d => d._id);

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);

    const moistureReading = await SensorData.findOne(
      { deviceId: { $in: deviceIds }, sensorType: 'moisture', timestamp: { $gte: startOfDay } },
      null, { sort: { timestamp: -1 } }
    );
    const tempReading = await SensorData.findOne(
      { deviceId: { $in: deviceIds }, sensorType: 'temperature', timestamp: { $gte: startOfDay } },
      null, { sort: { timestamp: -1 } }
    );
    const todayLogs = await IrrigationLog.find({ deviceId: { $in: deviceIds }, timestamp: { $gte: startOfDay } });
    const totalWater = todayLogs.reduce((s, l) => s + Math.round((l.duration || 0) * (10 / 60)), 0);

    res.json({
      date:               new Date().toISOString().split('T')[0],
      waterUsage:         totalWater,
      averageMoisture:    moistureReading ? Math.round(moistureReading.value) : null,
      averageTemperature: tempReading     ? Math.round(tempReading.value)     : null,
      irrigationDuration: todayLogs.reduce((s, l) => s + (l.duration || 0), 0),
      hasRealData:        moistureReading !== null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// @route  GET /api/reports/system — System health report (Admin only)
router.get('/system', protect, authorize(ADMIN), async (req, res) => {
  try {
    const User   = require('../models/User');
    const Device = require('../models/Device');
    const Farm   = require('../models/Farm');

    const totalUsers   = await User.countDocuments();
    const activeUsers  = await User.countDocuments({ accountStatus: 'active' });
    const pendingUsers = await User.countDocuments({ accountStatus: 'pending' });
    const totalFarms   = await Farm.countDocuments();
    const totalDevices = await Device.countDocuments();
    const activeDevices= await Device.countDocuments({ status: 'active' });

    res.json({
      totalUsers,
      activeUsers,
      pendingUsers,
      totalFarms,
      totalDevices,
      activeDevices,
      systemStatus: 'Healthy',
      serverTime: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate system report' });
  }
});

// @route  GET /api/reports/export?format=csv
// Admin 🟡 System, Owner ✅, OM ✅, Farmer 🟡 Limited
router.get('/export', protect, authorize(ADMIN, OWNER, OM, FM), async (req, res) => {
  try {
    const IrrigationLog = require('../models/IrrigationLog');
    const Device        = require('../models/Device');
    const Farm          = require('../models/Farm');

    const role = getUserRole(req.user);
    let farmQuery = {};

    if (role === OWNER || role === FM) {
      farmQuery = { ownerId: req.user._id };
    }

    const farms     = await Farm.find(farmQuery);
    const farmIds   = farms.map(f => f._id);
    const devices   = await Device.find({ farmId: { $in: farmIds } });
    const deviceIds = devices.map(d => d._id);

    const logs = await IrrigationLog.find({ deviceId: { $in: deviceIds } })
      .populate({ path: 'deviceId', populate: { path: 'farmId', select: 'name' } })
      .sort({ timestamp: -1 }).limit(1000);

    if (req.query.format === 'csv') {
      let csv = 'Date,Time,Farm,Device,Trigger Mode,Status,Water Used (L),Duration (sec)\n';
      logs.forEach(log => {
        const d = new Date(log.timestamp);
        csv += `${d.toLocaleDateString()},${d.toLocaleTimeString()},${log.deviceId?.farmId?.name || ''},${log.deviceId?.name || ''},${log.triggeredBy || 'auto'},${log.status},${Math.round((log.duration || 0) * (10 / 60))},${log.duration || 0}\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="sims_export_${Date.now()}.csv"`);
      return res.send(csv);
    }
    res.status(400).json({ error: 'Unsupported format. Use ?format=csv' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to export report' });
  }
});

module.exports = router;
