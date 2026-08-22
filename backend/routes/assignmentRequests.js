const express = require('express');
const router = express.Router();
const AssignmentRequest = require('../models/AssignmentRequest');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');

// OM requests assignment, Owner approves

// Get pending requests (Owner + OM)
router.get('/', protect, authorize('owner', 'office_manager'), async (req, res) => {
  try {
    const reqs = await AssignmentRequest.find({ status: 'pending' })
      .populate('targetUserId', 'name email assignedRole')
      .populate('farmId', 'name')
      .populate('requestedBy', 'name');
    res.json(reqs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Approve request (Owner only)
router.post('/:id/approve', protect, authorize('owner'), async (req, res) => {
  try {
    const request = await AssignmentRequest.findById(req.params.id);
    if (!request || request.status !== 'pending') return res.status(404).json({ error: 'Invalid request' });
    
    request.status = 'approved';
    await request.save();

    // Apply the assignment!
    await User.findByIdAndUpdate(request.targetUserId, { farmId: request.farmId });
    
    res.json({ message: 'Request approved and applied' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// Reject request (Owner only)
router.post('/:id/reject', protect, authorize('owner'), async (req, res) => {
  try {
    const request = await AssignmentRequest.findById(req.params.id);
    if (!request || request.status !== 'pending') return res.status(404).json({ error: 'Invalid request' });
    
    request.status = 'rejected';
    await request.save();
    
    res.json({ message: 'Request rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

module.exports = router;
