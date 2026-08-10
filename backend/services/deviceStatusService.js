const Device = require('../models/Device');

// Device is offline if no heartbeat or data received in last 30 seconds
const OFFLINE_THRESHOLD_MS = 30000;

async function markStaleDevicesOffline(io) {
  const cutoff = new Date(Date.now() - OFFLINE_THRESHOLD_MS);
  const staleDevices = await Device.find({
    status: 'online',
    lastSeen: { $lt: cutoff },
  });

  for (const device of staleDevices) {
    device.status = 'offline';
    await device.save();
    console.log(`[Device Status] Device ${device.name} (${device._id}) marked OFFLINE (last seen: ${device.lastSeen})`);
    if (io) {
      io.emit('device:status', { 
        deviceId: device._id.toString(), 
        status: 'offline',
        lastSeen: device.lastSeen 
      });
    }
  }
  
  if (staleDevices.length > 0) {
    console.log(`[Device Status] Marked ${staleDevices.length} device(s) as offline`);
  }
}

function startDeviceStatusMonitor(io, intervalMs = 10000) {
  console.log('[Device Status Monitor] Starting with check interval:', intervalMs, 'ms');
  console.log('[Device Status Monitor] Offline threshold:', OFFLINE_THRESHOLD_MS, 'ms');
  
  // Run immediately on startup
  markStaleDevicesOffline(io);
  
  // Then run periodically
  return setInterval(() => markStaleDevicesOffline(io), intervalMs);
}

module.exports = { markStaleDevicesOffline, startDeviceStatusMonitor, OFFLINE_THRESHOLD_MS };
