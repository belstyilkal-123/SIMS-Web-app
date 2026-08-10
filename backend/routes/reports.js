const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');

// @route  GET /api/reports/history
// @desc   Get 30-day real sensor trends + irrigation logs
// @access Private
router.get('/history', protect, async (req, res) => {
  try {
    const Device       = require('../models/Device');
    const Farm         = require('../models/Farm');
    const IrrigationLog = require('../models/IrrigationLog');
    const SensorData   = require('../models/SensorData');

    // 1. Scope to this user's farms
    const isAdmin = req.user.role === 'super_administrator';
    const farmQuery = isAdmin ? {} : { ownerId: req.user._id };
    const farms   = await Farm.find(farmQuery);
    const farmIds = farms.map(f => f._id);

    const devices   = await Device.find({ farmId: { $in: farmIds } });
    const deviceIds = devices.map(d => d._id);

    // 2. Real irrigation logs — no fake fallback
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
      waterUsed: log.duration ? Math.round(log.duration * (10 / 60)) : 0, // litres at 10L/min
      duration:  log.duration || 0,
    }));

    // 3. Real 30-day aggregate trends from SensorData
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

    // Reshape into [{ date, soilMoisture, temperature, waterUsage }]
    const byDate = {};
    aggResult.forEach(({ _id, avg }) => {
      if (!byDate[_id.date]) byDate[_id.date] = { date: _id.date, soilMoisture: null, temperature: null, waterUsage: 0 };
      if (_id.type === 'moisture')    byDate[_id.date].soilMoisture = Math.round(avg * 10) / 10;
      if (_id.type === 'temperature') byDate[_id.date].temperature  = Math.round(avg * 10) / 10;
    });

    // Add daily water usage from irrigation logs
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
        ? 'No data yet. Connect your ESP8266 device to start collecting data.'
        : null,
    });

  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch history logs' });
  }
});

// @route  GET /api/reports/daily
router.get('/daily', protect, async (req, res) => {
  try {
    const SensorData    = require('../models/SensorData');
    const IrrigationLog = require('../models/IrrigationLog');
    const Device        = require('../models/Device');
    const Farm          = require('../models/Farm');

    const isAdmin   = req.user.role === 'super_administrator';
    const farms     = await Farm.find(isAdmin ? {} : { ownerId: req.user._id });
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
      date:                  new Date().toISOString().split('T')[0],
      waterUsage:            totalWater,
      averageMoisture:       moistureReading ? Math.round(moistureReading.value) : null,
      averageTemperature:    tempReading     ? Math.round(tempReading.value)     : null,
      irrigationDuration:    todayLogs.reduce((s, l) => s + (l.duration || 0), 0),
      hasRealData:           moistureReading !== null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// @route  GET /api/reports/export?format=csv
router.get('/export', protect, async (req, res) => {
  try {
    const IrrigationLog = require('../models/IrrigationLog');
    const Device        = require('../models/Device');
    const Farm          = require('../models/Farm');

    const isAdmin   = req.user.role === 'super_administrator';
    const farms     = await Farm.find(isAdmin ? {} : { ownerId: req.user._id });
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
    res.status(500).json({ error: 'Failed to export' });
  }
});

module.exports = router;

