const express = require('express');
const router = express.Router();
const Command = require('../models/Command');
const AuditLog = require('../models/AuditLog');
const Device = require('../models/Device');
const { protect, authorize, isAdmin } = require('../middleware/authMiddleware');

// @route   POST /api/irrigation/manual
// @desc    Trigger pump manually
// @access  Private
router.post('/manual', protect, authorize('owner', 'admin', 'office_manager', 'farmer', 'labor'), async (req, res) => {
  try {
    const { deviceId, action } = req.body;
    if (!['PUMP_ON', 'PUMP_OFF', 'BUZZER_ON', 'BUZZER_OFF'].includes(action)) {
      return res.status(400).json({ error: 'Invalid irrigation action' });
    }
    const device = await Device.findById(deviceId).populate('farmId', 'ownerId');
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const role = req.user.assignedRole || req.user.role;
    const isPrivileged = ['owner', 'admin', 'office_manager'].includes(role);
    const isFarmOwner = device.farmId?.ownerId?.toString() === req.user._id.toString();
    if (!isPrivileged && !isFarmOwner) {
      return res.status(403).json({ error: 'You do not have access to this device.' });
    }
    
    // Create command log
    const command = new Command({
      deviceId,
      commandType: action,
      issuedBy: req.user._id,
      status: 'sent'
    });
    await command.save();

    // Create audit log
    const audit = new AuditLog({
      userId: req.user._id,
      action: 'MANUAL_PUMP_OVERRIDE',
      resource: 'Device',
      resourceId: deviceId,
      details: `Pump manually turned ${action}`,
    });
    await audit.save();

    // In a real application, this is where we would publish to the MQTT broker to signal the ESP32
    // mqttClient.publish(`farm/devices/${deviceId}/command`, JSON.stringify({ action }));

    res.json({ message: `Pump command ${action} sent successfully`, commandId: command._id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send manual command' });
  }
});

module.exports = router;


