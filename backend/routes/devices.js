/**
 * Device Routes
 * 
 * Role Permissions Matrix:
 * - Owner: Full access (View, Add, Edit, Remove, Assign, Control Pump)
 * - Farmer: View ✅, Add ✅, Edit ✅, Remove 🟡, Assign ✅, Control Pump ✅, View Sensor Data ✅
 * - Admin: View 🟡 (read-only), View Sensor Data 🟡, View Device History 🟡
 * - Labour: View 🟡 (limited), View Sensor Data 🟡, Report Problem ✅
 * - Office Manager: No access
 */

const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const Farm = require('../models/Farm');
const User = require('../models/User');
const SensorData = require('../models/SensorData');
const IrrigationLog = require('../models/IrrigationLog');
const { protect, authorize, isAdmin } = require('../middleware/authMiddleware');

// ── Role constants ────────────────────────────────────────────────────────
const OWNER = 'owner';
const ADMIN = 'admin';
const FM = 'farmer';
const LABOR = 'labor';

// ── Helper: Get user role ─────────────────────────────────────────────────
const getRole = (user) => user.assignedRole || user.role;

// ── Helper: Get farm IDs accessible to user ───────────────────────────────
async function accessibleFarmIds(user) {
  const role = getRole(user);
  
  if (role === OWNER || role === ADMIN) {
    return null; // Owner and Admin can see all
  }
  
  if (role === FM) {
    // Farmer sees devices on their own farms
    const farms = await Farm.find({ ownerId: user._id }).select('_id');
    return farms.map((farm) => farm._id);
  }
  
  if (role === LABOR) {
    // Labour sees devices on assigned farms
    const userDoc = await User.findById(user._id).select('assignedFarms farmId');
    if (userDoc?.assignedFarms?.length > 0) {
      return userDoc.assignedFarms;
    }
    if (userDoc?.farmId) {
      return [userDoc.farmId];
    }
  }
  
  return [];
}

// ── Helper: Check if user can access device ───────────────────────────────
async function canAccessDevice(deviceId, user) {
  const device = await Device.findById(deviceId).populate('farmId', 'name ownerId');
  if (!device) return { access: false, device: null };
  
  const role = getRole(user);
  
  // Owner and Admin can access any device
  if (role === OWNER || role === ADMIN) {
    return { access: true, device };
  }
  
  // Farmer can access devices on their own farms
  if (role === FM && device.farmId?.ownerId?.toString() === user._id.toString()) {
    return { access: true, device };
  }
  
  // Labour can access devices on assigned farms
  if (role === LABOR) {
    const farmIds = await accessibleFarmIds(user);
    if (farmIds && farmIds.some(id => id.toString() === device.farmId?._id?.toString())) {
      return { access: true, device };
    }
  }
  
  return { access: false, device };
}

// ── Helper: Add connection status to device ───────────────────────────────
function withConnectionStatus(device) {
  const result = device.toObject ? device.toObject() : device;
  const seconds = result.lastSeen ? Math.floor((Date.now() - new Date(result.lastSeen)) / 1000) : null;
  result.secondsSinceLastSeen = seconds;
  result.isConnected = seconds !== null && seconds < 30;
  return result;
}

// ── GET /api/devices — List devices ──────────────────────────────────────
// Owner ✅ | Admin 🟡 (read-only) | Farmer ✅ | Labour 🟡 (limited)
router.get('/', protect, authorize(OWNER, ADMIN, FM, LABOR), async (req, res) => {
  try {
    const farmIds = await accessibleFarmIds(req.user);
    const query = farmIds ? { farmId: { $in: farmIds } } : {};
    
    // Filter by specific farm if provided
    if (req.query.farmId) {
      if (farmIds && !farmIds.some((id) => id.toString() === req.query.farmId)) {
        return res.status(403).json({ error: 'You do not have access to this farm.' });
      }
      query.farmId = req.query.farmId;
    }
    
    let devices = await Device.find(query).populate('farmId', 'name ownerId');
    
    // For Labour, limit the data returned
    const role = getRole(req.user);
    if (role === LABOR) {
      devices = devices.map(d => ({
        _id: d._id,
        name: d.name,
        status: d.status,
        lastSeen: d.lastSeen,
        isConnected: withConnectionStatus(d).isConnected,
        farmId: d.farmId?._id,
        farmName: d.farmId?.name,
      }));
    } else {
      devices = devices.map(withConnectionStatus);
    }
    
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// ── GET /api/devices/:id — Single device ─────────────────────────────────
router.get('/:id', protect, authorize(OWNER, ADMIN, FM, LABOR), async (req, res) => {
  try {
    const { access, device } = await canAccessDevice(req.params.id, req.user);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    if (!access) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(withConnectionStatus(device));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

// ── POST /api/devices — Register device ──────────────────────────────────
// Owner ✅ | Farmer ✅
router.post('/', protect, authorize(OWNER, FM, ADMIN), async (req, res) => {
  try {
    const { farmId, macAddress, name, firmwareVersion } = req.body;
    
    if (!farmId || !macAddress || !name) {
      return res.status(400).json({ error: 'Farm ID, MAC address, and name are required' });
    }
    
    // Verify farm exists and user has access
    const farm = await Farm.findById(farmId);
    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }
    
    const role = getRole(req.user);
    
    // Farmer can only add devices to their own farm
    if (role === FM && farm.ownerId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only add devices to your own farm' });
    }
    
    // Check for duplicate MAC address
    if (await Device.exists({ macAddress })) {
      return res.status(409).json({ error: 'Device with this MAC address already exists' });
    }
    
    const device = await Device.create({
      farmId,
      macAddress,
      name,
      firmwareVersion: firmwareVersion || '1.0.0',
    });
    
    res.status(201).json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// ── PUT /api/devices/:id — Update device ─────────────────────────────────
// Owner ✅ | Farmer ✅ (own farm devices) | Admin ✅
router.put('/:id', protect, authorize(OWNER, FM, ADMIN), async (req, res) => {
  try {
    const { access, device } = await canAccessDevice(req.params.id, req.user);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    if (!access) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const allowed = ['farmId', 'macAddress', 'name', 'firmwareVersion'];
    const updates = {};
    
    for (const [key, value] of Object.entries(req.body)) {
      if (allowed.includes(key)) {
        updates[key] = value;
      }
    }
    
    // If changing farm, verify access to new farm
    if (updates.farmId) {
      const newFarm = await Farm.findById(updates.farmId);
      if (!newFarm) {
        return res.status(404).json({ error: 'Target farm not found' });
      }
      
      const role = getRole(req.user);
      if (role === FM && newFarm.ownerId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'You can only assign devices to your own farm' });
      }
    }
    
    const updated = await Device.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('farmId', 'name');
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update device' });
  }
});

// ── DELETE /api/devices/:id — Remove device ──────────────────────────────
// Owner ✅ | Farmer 🟡 (own farm devices only)
router.delete('/:id', protect, authorize(OWNER, FM, ADMIN), async (req, res) => {
  try {
    const { access, device } = await canAccessDevice(req.params.id, req.user);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    if (!access) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // For Farmer, verify they own the farm
    const role = getRole(req.user);
    if (role === FM) {
      const farm = await Farm.findById(device.farmId);
      if (!farm || farm.ownerId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'You can only remove devices from your own farm' });
      }
    }
    
    await device.deleteOne();
    res.json({ message: 'Device removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// ── GET /api/devices/:id/status — Device status ──────────────────────────
// Owner ✅ | Admin 🟡 | Farmer ✅ | Labour 🟡
router.get('/:id/status', protect, authorize(OWNER, ADMIN, FM, LABOR), async (req, res) => {
  try {
    const { access, device } = await canAccessDevice(req.params.id, req.user);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    if (!access) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = withConnectionStatus(device);
    result.connectionQuality = 
      device.signalStrength > -50 ? 'Excellent' :
      device.signalStrength > -70 ? 'Good' :
      device.signalStrength > -80 ? 'Fair' : 'Poor';
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch device status' });
  }
});

// ── GET /api/devices/:id/sensor-data — Sensor readings ────────────────────
// Owner ✅ | Admin 🟡 | Farmer ✅ | Labour 🟡
router.get('/:id/sensor-data', protect, authorize(OWNER, ADMIN, FM, LABOR), async (req, res) => {
  try {
    const { access, device } = await canAccessDevice(req.params.id, req.user);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    if (!access) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { limit = 100 } = req.query;
    
    const sensorData = await SensorData.find({ deviceId: device._id })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    res.json(sensorData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sensor data' });
  }
});

// ── GET /api/devices/:id/history — Device operation history ──────────────
// Owner ✅ | Admin 🟡 | Farmer 🟡
router.get('/:id/history', protect, authorize(OWNER, ADMIN, FM), async (req, res) => {
  try {
    const { access, device } = await canAccessDevice(req.params.id, req.user);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    if (!access) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { limit = 50 } = req.query;
    
    const logs = await IrrigationLog.find({ deviceId: device._id })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch device history' });
  }
});

// ── POST /api/devices/:id/problem — Report device problem ────────────────
// Owner ✅ | Farmer ✅ | Labour ✅
router.post('/:id/problem', protect, authorize(OWNER, FM, LABOR), async (req, res) => {
  try {
    const { access, device } = await canAccessDevice(req.params.id, req.user);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    if (!access) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { problem, description } = req.body;
    
    if (!problem) {
      return res.status(400).json({ error: 'Problem description is required' });
    }
    
    // Create a maintenance ticket or notification
    // This could be extended to integrate with the maintenance system
    const MaintenanceTicket = require('../models/MaintenanceTicket');
    
    const ticket = await MaintenanceTicket.create({
      deviceId: device._id,
      farmId: device.farmId,
      reportedBy: req.user._id,
      title: `Device Problem: ${problem}`,
      description: description || '',
      priority: 'medium',
      status: 'open',
    });
    
    res.status(201).json({ 
      message: 'Problem reported successfully', 
      ticket 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to report problem' });
  }
});

module.exports = router;
