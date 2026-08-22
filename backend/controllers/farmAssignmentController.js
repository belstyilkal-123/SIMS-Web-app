const User = require('../models/User');
const Farm = require('../models/Farm');
const AuditLog = require('../models/AuditLog');

/**
 * Farm Assignment Controller
 * ─────────────────────────────────────────────────────────────────────────
 * Owner assigns farmers to farms
 * Farmer works on their assigned farm
 */

/* ── Safe audit log helper ───────────────────────────────────────────────── */
const logAudit = async (userId, action, resource, resourceId, details, ip) => {
  try {
    await AuditLog.create({
      userId,
      action,
      resource,
      resourceId: resourceId,   // keep as ObjectId
      metadata: { details },     // AuditLog uses metadata not details
      ipAddress: ip || '',
    });
  } catch (e) {
    // never crash the main request over audit failures
    console.warn('[Audit] Failed to write log:', e.message);
  }
};

/**
 * GET /api/farm-assignments
 * Get all farm assignments (Owner only)
 */
const getAssignments = async (req, res) => {
  try {
    // All active farmers with their farm assignments
    const farmers = await User.find({
      assignedRole: 'farmer',
      accountStatus: 'active'
    })
      .populate('farmId', 'name location cropType')
      .select('name email phone farmId');

    // All farms
    const farms = await Farm.find({})
      .populate('ownerId', 'name email')
      .select('name location cropType ownerId');

    // Build assignment list (every farmer appears, assigned or not)
    const assignments = farmers.map(farmer => ({
      farmer: {
        _id:   farmer._id,
        name:  farmer.name,
        email: farmer.email,
        phone: farmer.phone,
      },
      farm: farmer.farmId
        ? {
            _id:      farmer.farmId._id,
            name:     farmer.farmId.name,
            location: farmer.farmId.location,
            cropType: farmer.farmId.cropType,
          }
        : null,
    }));

    res.json({
      assignments,
      farms,
      unassignedFarmers: farmers
        .filter(f => !f.farmId)
        .map(f => ({ _id: f._id, name: f.name, email: f.email })),
    });
  } catch (err) {
    console.error('[getAssignments]', err);
    res.status(500).json({ error: 'Failed to fetch assignments', details: err.message });
  }
};

/**
 * POST /api/farm-assignments
 * Assign a farmer to a farm (Owner only)
 */
const AssignmentRequest = require('../models/AssignmentRequest');
const assignFarmer = async (req, res) => {
  try {
    const { farmerId, farmId } = req.body;

    if (!farmerId || !farmId) {
      return res.status(400).json({ error: 'farmerId and farmId are required' });
    }

    // Verify farmer exists and is a farmer role
    const farmer = await User.findById(farmerId);
    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }
    const farmerRole = farmer.assignedRole || farmer.role;
    if (farmerRole !== 'farmer') {
      return res.status(400).json({ error: `User has role "${farmerRole}", not farmer` });
    }

    // Verify farm exists
    const farm = await Farm.findById(farmId);
    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    // Use findByIdAndUpdate to skip the password pre-save hook entirely
    const role = req.user.assignedRole || req.user.role;
    if (role === 'office_manager') {
      await AssignmentRequest.create({ type: 'farm_farmer', targetUserId: farmerId, farmId, requestedBy: req.user._id });
      return res.json({ message: 'Assignment request submitted for owner approval' });
    }
    const updated = await User.findByIdAndUpdate(
      farmerId,
      { $set: { farmId: farm._id } },
      { new: true, runValidators: false }
    ).populate('farmId', 'name location cropType');

    await logAudit(
      req.user._id,
      'FARM_ASSIGNMENT',
      'User',
      farmer._id,
      `Assigned farmer ${farmer.name} to farm ${farm.name}`,
      req.ip
    );

    res.json({
      message:    `${farmer.name} assigned to ${farm.name}`,
      assignment: updated,
    });
  } catch (err) {
    console.error('[assignFarmer]', err);
    res.status(500).json({ error: 'Failed to assign farmer', details: err.message });
  }
};

/**
 * DELETE /api/farm-assignments/:farmerId
 * Remove farmer from a farm (Owner only)
 */
const unassignFarmer = async (req, res) => {
  try {
    const { farmerId } = req.params;

    const farmer = await User.findById(farmerId);
    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    await User.findByIdAndUpdate(
      farmerId,
      { $unset: { farmId: '' } },
      { runValidators: false }
    );

    await logAudit(
      req.user._id,
      'FARM_UNASSIGNMENT',
      'User',
      farmer._id,
      `Removed farmer ${farmer.name} from farm`,
      req.ip
    );

    res.json({ message: `${farmer.name} unassigned from farm` });
  } catch (err) {
    console.error('[unassignFarmer]', err);
    res.status(500).json({ error: 'Failed to unassign farmer', details: err.message });
  }
};

/**
 * GET /api/farm-assignments/farm/:farmId/farmers
 * Get all farmers assigned to a specific farm
 */
const getFarmFarmers = async (req, res) => {
  try {
    const farmers = await User.find({
      assignedRole: 'farmer',
      farmId: req.params.farmId,
      accountStatus: 'active',
    }).select('name email phone');

    res.json(farmers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch farm farmers', details: err.message });
  }
};

/**
 * GET /api/farm-assignments/available-farmers
 * Get farmers without a farm assignment
 */
const getAvailableFarmers = async (req, res) => {
  try {
    const farmers = await User.find({
      assignedRole: 'farmer',
      accountStatus: 'active',
      $or: [
        { farmId: null },
        { farmId: { $exists: false } },
      ],
    }).select('name email phone');

    res.json(farmers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch available farmers', details: err.message });
  }
};

module.exports = {
  getAssignments,
  assignFarmer,
  unassignFarmer,
  getFarmFarmers,
  getAvailableFarmers,
};
