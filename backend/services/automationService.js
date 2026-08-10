const mongoose = require('mongoose');
const SensorData   = require('../models/SensorData');
const Command      = require('../models/Command');
const Device       = require('../models/Device');
const Notification = require('../models/Notification');

/**
 * Fetch the latest value for a given sensor type on a device.
 * Returns null when no data has been recorded yet.
 */
const getLatestSensorValue = async (deviceId, sensorType) => {
  const reading = await SensorData.findOne(
    { deviceId, sensorType },
    { value: 1 },
    { sort: { timestamp: -1 } }
  ).lean();
  return reading ? reading.value : null;
};

/**
 * Create a notification for all users who own the farm linked to this device.
 * Falls back to a null userId if the farm / owner cannot be resolved.
 */
const notify = async (deviceId, farmId, type, message) => {
  try {
    const Farm = mongoose.model('Farm');
    const farm = farmId ? await Farm.findById(farmId).select('ownerId').lean() : null;
    const userId = farm?.ownerId ?? null;
    await Notification.create({ userId, farmId, type, message });
  } catch (err) {
    console.warn('[Automation] Could not create notification:', err.message);
  }
};

/**
 * evaluateIrrigationRules
 * Runs on a schedule (wired via node-cron in server.js).
 * Checks every online device against real sensor data from MongoDB and
 * issues pump commands + notifications as needed.
 */
const evaluateIrrigationRules = async () => {
  try {
    const devices = await Device.find({ status: 'online' }).lean();
    if (!devices.length) return;

    for (const device of devices) {
      const deviceId = device._id;
      const farmId   = device.farmId;

      // ── 1. Fetch latest real sensor readings from DB ──────────────
      const [
        currentMoisture,
        currentTankLevel,
        currentNitrogen,
        currentPhosphorus,
        currentPotassium,
      ] = await Promise.all([
        getLatestSensorValue(deviceId, 'moisture'),
        getLatestSensorValue(deviceId, 'tankLevel'),
        getLatestSensorValue(deviceId, 'nitrogen'),
        getLatestSensorValue(deviceId, 'phosphorus'),
        getLatestSensorValue(deviceId, 'potassium'),
      ]);

      // Skip device entirely if no sensor data has been received yet
      if (currentMoisture === null || currentTankLevel === null) {
        console.log(`[Automation] No sensor data yet for device ${deviceId}, skipping.`);
        continue;
      }

      // ── 2. Predictive Weather Check ───────────────────────────────
      let skipForRain = false;
      try {
        const Farm = mongoose.model('Farm');
        const farm = farmId ? await Farm.findById(farmId).select('gps').lean() : null;
        const lat  = farm?.gps?.lat ?? 11.5742;
        const lon  = farm?.gps?.lng ?? 37.3614;

        const weather = await require('./weatherService').getForecast(lat, lon);
        if (weather.recommendPostpone) {
          skipForRain = true;
          console.log(`[Automation] Skipping irrigation for device ${deviceId} — rain expected.`);
        }
      } catch (err) {
        console.warn('[Automation] Weather check failed, using standard rules.');
      }

      // ── 3. Pump ON rule ───────────────────────────────────────────
      // IF Soil Moisture < 30 % AND Tank Level > 20 % AND no rain expected
      if (currentMoisture < 30 && currentTankLevel > 20 && !skipForRain) {
        console.log(`[Automation] Pump ON → device ${deviceId} (moisture=${currentMoisture}%)`);

        const existing = await Command.findOne({
          deviceId,
          commandType: 'PUMP_ON',
          status: { $in: ['pending', 'sent'] },
        });

        if (!existing) {
          await Command.create({
            deviceId,
            commandType: 'PUMP_ON',
            status: 'sent',
            issuedBy: null,
          });
          await notify(
            deviceId,
            farmId,
            'info',
            `Automatic irrigation started. Soil moisture is ${currentMoisture.toFixed(1)}%.`
          );
        }
      }

      // ── 4. Pump OFF rule ──────────────────────────────────────────
      // IF Moisture >= 70 % OR Tank almost empty (< 5 %)
      if (currentMoisture >= 70 || currentTankLevel < 5) {
        console.log(`[Automation] Pump OFF → device ${deviceId} (moisture=${currentMoisture}%, tank=${currentTankLevel}%)`);

        // Only create a new PUMP_OFF if there isn't one pending already
        const existingOff = await Command.findOne({
          deviceId,
          commandType: 'PUMP_OFF',
          status: { $in: ['pending', 'sent'] },
        });

        if (!existingOff) {
          await Command.create({
            deviceId,
            commandType: 'PUMP_OFF',
            status: 'sent',
            issuedBy: null,
          });
        }

        if (currentTankLevel < 5) {
          await notify(
            deviceId,
            farmId,
            'alarm',
            `Water tank is critically low (${currentTankLevel.toFixed(1)}%). Irrigation stopped.`
          );

          // SMS + Email via notification service (if configured)
          try {
            const notifSvc = require('./notificationService');
            const Farm     = mongoose.model('Farm');
            const farm     = farmId ? await Farm.findById(farmId).populate('ownerId', 'email').lean() : null;
            const email    = farm?.ownerId?.email ?? null;

            await notifSvc.sendSMS(
              process.env.ALERT_PHONE || '+251911000000',
              `CRITICAL: Water tank is low (${currentTankLevel.toFixed(1)}%) at your farm. Irrigation has been stopped.`
            );

            if (email) {
              await notifSvc.sendEmail(
                email,
                'SmartIrrigate: Critical Alert — Tank Low',
                `Your water tank level is ${currentTankLevel.toFixed(1)}%. Please refill to resume operations.`
              );
            }
          } catch (err) {
            console.warn('[Automation] SMS/Email notification failed:', err.message);
          }
        }
      }

      // ── 5. NPK Fertilizer Recommendation (debounced — once per day) ──
      if (currentNitrogen !== null && currentPhosphorus !== null && currentPotassium !== null) {
        const npkLow = currentNitrogen < 50 || currentPhosphorus < 40 || currentPotassium < 60;

        if (npkLow) {
          // Debounce: only fire if no NPK notification in the last 24 hours
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const recentNpkNotif = await Notification.findOne({
            farmId,
            type: 'info',
            message: /NPK|Fertilizer/i,
            timestamp: { $gte: yesterday },
          }).lean();

          if (!recentNpkNotif) {
            await notify(
              deviceId,
              farmId,
              'info',
              `Fertilizer Recommendation: NPK levels are low ` +
              `(N: ${currentNitrogen.toFixed(1)}, P: ${currentPhosphorus.toFixed(1)}, K: ${currentPotassium.toFixed(1)}). ` +
              `Consider applying NPK 15-15-15 fertilizer.`
            );
          }
        }
      }
    }
  } catch (error) {
    console.error('[Automation] Error evaluating irrigation rules:', error);
  }
};

module.exports = { evaluateIrrigationRules };
