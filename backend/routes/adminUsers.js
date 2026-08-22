/**
 * /api/admin/users
 * ─────────────────────────────────────────────────────────────────────
 * Admin manages the complete user lifecycle (spec §22):
 *   GET  /                     — list users (filterable)
 *   GET  /registrations        — pending registrations queue
 *   GET  /:id                  — single user
 *   POST /                     — admin creates account directly (owner/admin roles)
 *   PUT  /:id                  — update user details / role
 *   POST /:id/approve          — approve pending → active, assign role
 *   POST /:id/reject           — reject pending registration
 *   POST /:id/activate         — reactivate suspended/deactivated
 *   POST /:id/suspend          — suspend active account
 *   POST /:id/deactivate       — deactivate account
 *   POST /:id/reset-password   — admin resets password
 *   DELETE /:id                — hard delete (admin only, not self)
 *
 * Owner routes (/api/owner/users) are handled in ownerUsers.js
 */
const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { check, validationResult } = require('express-validator');
const User    = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { protect, authorize, ROLES } = require('../middleware/authMiddleware');

const ADMIN_ROLES = [ROLES.ADMIN, ROLES.OWNER]; // Owner and Admin can view users

/* ── Helper: log audit event ─────────────────────────────────── */
const audit = async (userId, action, resource, resourceId, details, req) => {
  try {
    await AuditLog.create({
      userId, action, resource, resourceId: resourceId?.toString(),
      details, ipAddress: req.ip,
    });
  } catch (e) { console.warn('Audit log failed:', e.message); }
};

// ── GET /api/admin/users — List Users ───────────────────────────────────────
router.get('/', protect, authorize(...ADMIN_ROLES, ROLES.OFFICE_MANAGER, 'farmer', 'owner'), async (req, res) => {
  try {
    const { assignedRole, role, requestedRole, accountStatus, farmId, search } = req.query;
    const query = {};

    if (assignedRole)  query.assignedRole = assignedRole;
    if (role)          query.role = role;
    if (requestedRole) query.requestedRole = requestedRole;
    if (accountStatus) query.accountStatus = accountStatus;
    
    // Farmer should ideally only see their farm's users, but filtering handled via query or basic visibility
    if (farmId)        query.farmId = farmId;
    if (search) {
      query.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Office Manager can only view ACTIVE employees (spec §29 — not create, just view)
    if (req.user.assignedRole === ROLES.OFFICE_MANAGER) {
      query.accountStatus = 'active';
    }

    const users = await User.find(query)
      .select('-password -resetPasswordToken -resetPasswordExpires -magicLinkToken -magicLinkExpires -refreshToken')
      .populate('farmId',     'name')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

/* ── GET /api/admin/users/registrations — pending queue ─────── */
router.get('/registrations', protect, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const users = await User.find({ accountStatus: 'pending' })
      .select('-password -resetPasswordToken -refreshToken')
      .sort({ createdAt: 1 }); // oldest first — FIFO review
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch registrations', details: err.message });
  }
});

/* ── GET /api/admin/users/:id — single user ─────────────────── */
router.get('/:id', protect, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -resetPasswordToken -refreshToken')
      .populate('farmId',     'name location')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .populate('suspendedBy','name email');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user', details: err.message });
  }
});

/* ── POST /api/admin/users — admin creates account directly ──── */
router.post('/', protect, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const { name, email, password, farmId, language, phone, address } = req.body;

    // Accept assignedRole or role from the frontend form
    const assignedRole = req.body.assignedRole || req.body.role;

    // Manual validation — cleaner than express-validator for this case
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!assignedRole || !['owner', 'admin'].includes(assignedRole)) {
      return res.status(400).json({ error: 'Role must be owner or admin. Other roles register via the Register page.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'A user with this email already exists' });

    const user = await User.create({
      name:          name.trim(),
      email:         email.toLowerCase().trim(),
      password,
      phone:         phone   || '',
      address:       address || '',
      requestedRole: assignedRole,
      assignedRole,
      accountStatus: 'active',
      farmId:        farmId || undefined,
      language:      language || 'en',
      approvedBy:    req.user._id,
      approvedAt:    new Date(),
    });

    await audit(req.user._id, 'USER_CREATED', 'User', user._id,
      `Admin created ${assignedRole} account for ${email}`, req);

    res.status(201).json({
      _id:           user._id,
      name:          user.name,
      email:         user.email,
      assignedRole:  user.assignedRole,
      accountStatus: user.accountStatus,
      farmId:        user.farmId,
      language:      user.language,
      createdAt:     user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user', details: err.message });
  }
});

/* ── PUT /api/admin/users/:id — update details / role ───────── */
router.put(
  '/:id',
  protect,
  authorize(ROLES.ADMIN),
  [
    check('assignedRole').optional().isIn(['owner','admin','office_manager','farmer','labor']),
    check('email').optional().isEmail(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

      const allowed = ['name','email','phone','address','assignedRole','farmId','language'];
      const update  = {};
      allowed.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });
      // Keep requestedRole immutable — only admin can change assignedRole

      const user = await User.findByIdAndUpdate(
        req.params.id, { $set: update }, { new: true, runValidators: true }
      ).select('-password -refreshToken');

      if (!user) return res.status(404).json({ error: 'User not found' });

      if (update.assignedRole) {
        await audit(req.user._id, 'ROLE_CHANGED', 'User', user._id,
          `Role changed to ${update.assignedRole}`, req);
      }
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update user', details: err.message });
    }
  }
);

/* ── POST /:id/approve — approve pending registration ───────── */
// Spec §48: Admin verifies, assigns role, sets ACTIVE
router.post('/:id/approve', protect, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const { assignedRole, farmId, notes } = req.body;

    if (!assignedRole) return res.status(400).json({ error: 'assignedRole is required' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.accountStatus !== 'pending') {
      return res.status(400).json({ error: `Account is ${user.accountStatus}, not pending` });
    }

    user.assignedRole  = assignedRole;
    user.accountStatus = 'active';
    user.approvedBy    = req.user._id;
    user.approvedAt    = new Date();
    if (farmId) user.farmId = farmId;
    await user.save();

    // Notify the user
    try {
      const notifSvc = require('../services/notificationService');
      await notifSvc.sendAlertEmail(
        user.email,
        'Your SIMS Account Has Been Approved',
        `Congratulations ${user.name},<br><br>
         Your account has been approved and you have been assigned the role of <strong>${assignedRole}</strong>.<br>
         You can now log in at <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login">SIMS Login</a>.`
      );
    } catch {}

    await audit(req.user._id, 'USER_APPROVED', 'User', user._id,
      `Approved as ${assignedRole}. ${notes || ''}`, req);

    res.json({ message: `Account approved as ${assignedRole}`, user: { _id: user._id, name: user.name, assignedRole, accountStatus: 'active' } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve account', details: err.message });
  }
});

/* ── POST /:id/reject — reject pending registration ─────────── */
router.post('/:id/reject', protect, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.accountStatus !== 'pending') {
      return res.status(400).json({ error: `Account is ${user.accountStatus}, not pending` });
    }

    user.accountStatus  = 'rejected';
    user.rejectedBy     = req.user._id;
    user.rejectedAt     = new Date();
    user.rejectedReason = reason || '';
    await user.save();

    try {
      const notifSvc = require('../services/notificationService');
      await notifSvc.sendAlertEmail(
        user.email,
        'Your SIMS Registration Was Not Approved',
        `Hello ${user.name},<br><br>
         We were unable to approve your registration at this time.<br>
         ${reason ? `Reason: ${reason}<br>` : ''}
         Please contact the administrator for more information.`
      );
    } catch {}

    await audit(req.user._id, 'USER_REJECTED', 'User', user._id,
      `Rejected. Reason: ${reason || 'none'}`, req);

    res.json({ message: 'Registration rejected', userId: user._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject registration', details: err.message });
  }
});

/* ── POST /:id/activate — reactivate suspended/deactivated ──── */
router.post('/:id/activate', protect, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { accountStatus: 'active' }, $unset: { suspendedAt: '', suspendedBy: '', suspendReason: '' } },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    await audit(req.user._id, 'USER_ACTIVATED', 'User', user._id, 'Account activated', req);
    res.json({ message: `Account for ${user.email} activated`, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to activate account', details: err.message });
  }
});

/* ── POST /:id/suspend ───────────────────────────────────────── */
router.post('/:id/suspend', protect, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot suspend your own account' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { accountStatus: 'suspended', suspendedAt: new Date(), suspendedBy: req.user._id, suspendReason: req.body.reason || '' } },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    await audit(req.user._id, 'USER_SUSPENDED', 'User', user._id,
      `Suspended. Reason: ${req.body.reason || 'none'}`, req);
    res.json({ message: `Account for ${user.email} suspended`, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to suspend account', details: err.message });
  }
});

/* ── POST /:id/deactivate ────────────────────────────────────── */
router.post('/:id/deactivate', protect, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id, { $set: { accountStatus: 'deactivated' } }, { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    await audit(req.user._id, 'USER_DEACTIVATED', 'User', user._id, 'Account deactivated', req);
    res.json({ message: `Account for ${user.email} deactivated`, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate account', details: err.message });
  }
});

/* ── POST /:id/reset-password ────────────────────────────────── */
router.post('/:id/reset-password', protect, authorize(ROLES.ADMIN), [
  check('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.password = req.body.password;
    await user.save();

    await audit(req.user._id, 'PASSWORD_RESET', 'User', user._id, 'Admin reset password', req);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password', details: err.message });
  }
});

/* ── DELETE /:id — hard delete (admin only) ──────────────────── */
router.delete('/:id', protect, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await audit(req.user._id, 'USER_DELETED', 'User', req.params.id,
      `Deleted user ${user.email}`, req);
    res.json({ message: `User ${user.email} deleted` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
});

module.exports = router;
