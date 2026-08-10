const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { protect, admin } = require('../middleware/authMiddleware');

// @route   GET /api/audit-logs
// @desc    Get all audit logs (Admin only)
// @access  Private/Admin
router.get('/', protect, admin, async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(100); // Limit to last 100 for performance, pagination can be added later
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
