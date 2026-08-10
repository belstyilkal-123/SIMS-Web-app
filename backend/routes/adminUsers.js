/**
 * Admin User Management — /api/admin/users
 * Allows administrators to create accounts for labour, office_manager, and farmer roles,
 * list all users, update roles, reset passwords, and deactivate accounts.
 */
const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { check, validationResult } = require('express-validator');
const User    = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');

const generateToken = (id) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return jwt.sign({ id }, secret, { expiresIn: '30d' });
};

// ── GET /api/admin/users — list all users (admin only) ───────────────────
router.get('/', protect, authorize('super_administrator'), async (req, res) => {
  try {
    const { role, farmId, search } = req.query;
    const query = {};
    if (role)   query.role = role;
    if (farmId) query.farmId = farmId;
    if (search) {
      query.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password -resetPasswordToken -resetPasswordExpires -magicLinkToken -magicLinkExpires')
      .populate('farmId', 'name')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// ── POST /api/admin/users — admin creates a new user account ─────────────
router.post(
  '/',
  protect,
  authorize('super_administrator'),
  [
    check('name').notEmpty().withMessage('Name is required'),
    check('email').isEmail().withMessage('Valid email is required'),
    check('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    check('role')
      .isIn(['super_administrator', 'office_manager', 'farmer', 'labor'])
      .withMessage('Invalid role'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { name, email, password, role, farmId, language } = req.body;

      const existing = await User.findOne({ email });
      if (existing) return res.status(409).json({ error: 'A user with this email already exists' });

      const user = await User.create({
        name, email, password,
        role: role || 'labor',
        farmId: farmId || undefined,
        language: language || 'en',
      });

      res.status(201).json({
        _id:      user._id,
        name:     user.name,
        email:    user.email,
        role:     user.role,
        farmId:   user.farmId,
        language: user.language,
        createdAt: user.createdAt,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create user', details: err.message });
    }
  }
);

// ── GET /api/admin/users/:id — single user ───────────────────────────────
router.get('/:id', protect, authorize('super_administrator'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -resetPasswordToken -resetPasswordExpires -magicLinkToken -magicLinkExpires')
      .populate('farmId', 'name');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user', details: err.message });
  }
});

// ── PUT /api/admin/users/:id — update role, farmId, name, email ──────────
router.put(
  '/:id',
  protect,
  authorize('super_administrator'),
  [
    check('role').optional().isIn(['super_administrator', 'office_manager', 'farmer', 'labor']),
    check('email').optional().isEmail(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const allowed = ['name', 'email', 'role', 'farmId', 'language'];
      const update  = {};
      allowed.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: update },
        { new: true, runValidators: true }
      ).select('-password -resetPasswordToken -resetPasswordExpires -magicLinkToken -magicLinkExpires');

      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update user', details: err.message });
    }
  }
);

// ── POST /api/admin/users/:id/reset-password — admin resets a user's pw ──
router.post(
  '/:id/reset-password',
  protect,
  authorize('super_administrator'),
  [check('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      user.password = req.body.password; // pre-save hook hashes it
      await user.save();
      res.json({ message: 'Password reset successfully' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to reset password', details: err.message });
    }
  }
);

// ── DELETE /api/admin/users/:id — deactivate (soft) or hard delete ────────
router.delete('/:id', protect, authorize('super_administrator'), async (req, res) => {
  try {
    // Prevent admin from deleting themselves
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: `User ${user.email} deleted successfully` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
});

module.exports = router;


// ── POST /api/admin/users/:id/suspend — suspend an account ───────────────
router.post('/:id/suspend', protect, authorize('super_administrator'), async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot suspend your own account' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isActive:      false,
          suspendedAt:   new Date(),
          suspendedBy:   req.user._id,
          suspendReason: req.body.reason || '',
        },
      },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: `Account for ${user.email} suspended`, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to suspend account', details: err.message });
  }
});

// ── POST /api/admin/users/:id/activate — reactivate a suspended account ───
router.post('/:id/activate', protect, authorize('super_administrator'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set:   { isActive: true },
        $unset: { suspendedAt: '', suspendedBy: '', suspendReason: '' },
      },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: `Account for ${user.email} activated`, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to activate account', details: err.message });
  }
});

module.exports = router;

