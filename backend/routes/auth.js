const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// ── Token helpers ─────────────────────────────────────────────────────────────
const generateAccessToken = (id) => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  // Short-lived: 15 minutes in production, 8 hours in dev for convenience
  const expiry = process.env.NODE_ENV === 'production' ? '15m' : '8h';
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: expiry });
};

const generateRefreshToken = () => crypto.randomBytes(40).toString('hex');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Store hashed refresh token on the user record
const saveRefreshToken = async (userId, rawToken) => {
  const hashed  = hashToken(rawToken);
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await User.findByIdAndUpdate(userId, {
    refreshToken: hashed,
    refreshTokenExpires: expires,
  });
};

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   30 * 24 * 60 * 60 * 1000, // 30 days
    path:     '/api/auth',
  });
};

// Helper kept for backward compat — used by existing profile update endpoint
const generateToken = generateAccessToken;

// Register a new user
router.post(
  '/register',
  [
    check('name').notEmpty().withMessage('Name is required'),
    check('email').isEmail().withMessage('Please include a valid email'),
    check('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    check('role')
      .optional()
      .isIn(['super_administrator', 'office_manager', 'farmer', 'labor'])
      .withMessage('Invalid role'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { name, email, password, language } = req.body;

      // Accept any valid role from the registration form.
      // Defaults to 'farmer' if none provided.
      const VALID_ROLES = ['super_administrator', 'office_manager', 'farmer', 'labor'];
      const role = VALID_ROLES.includes(req.body.role) ? req.body.role : 'farmer';

      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({ error: 'User already exists' });
      }

      const user = await User.create({ name, email, password, role, language: language || 'en' });
      if (user) {
        const accessToken  = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken();
        await saveRefreshToken(user._id, refreshToken);
        setRefreshCookie(res, refreshToken);

        res.status(201).json({
          _id:      user._id,
          name:     user.name,
          email:    user.email,
          role:     user.role,
          language: user.language || 'en',
          token:    accessToken,
        });
      } else {
        res.status(400).json({
          error:    'Invalid user data',
          error_am: 'ልክ ያልሆነ የተጠቃሚ ውሂብ',
        });
      }
    } catch (error) {
      res.status(500).json({
        error:    'Registration failed',
        error_am: 'ምዝገባ አልተሳካም',
        details:  error.message,
      });
    }
  }
);

// Login user
router.post(
  '/login',
  [
    check('email').isEmail().withMessage('Please include a valid email'),
    check('password').exists().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { email, password } = req.body;
      const user = await User.findOne({ email });

      if (user && (await user.matchPassword(password))) {
        const accessToken  = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken();
        await saveRefreshToken(user._id, refreshToken);
        setRefreshCookie(res, refreshToken);

        res.json({
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          language: user.language || 'en',
          lowMoistureThreshold: user.lowMoistureThreshold,
          optimalMoistureThreshold: user.optimalMoistureThreshold,
          notifyEmail: user.notifyEmail,
          notifyLowMoisture: user.notifyLowMoisture,
          notifyTankEmpty: user.notifyTankEmpty,
          notifyPumpAuto: user.notifyPumpAuto,
          token: accessToken,
        });
      } else {
        res.status(401).json({
          error: 'Invalid email or password',
          error_am: 'ኢሜይል ወይም የይለፍ ቃል ትክክል አይደለም'
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Login failed',
        error_am: 'መግባት አልተሳካም',
        details: error.message
      });
    }
  }
);

// Forgot password
router.post('/forgot-password', [
  check('email').isEmail().withMessage('Please include a valid email'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: 'If that email is in our system, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');

    // Use updateOne to bypass the pre-save password hook entirely
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordToken: hashed,
          resetPasswordExpires: Date.now() + 3600000  // 1 hour
        }
      }
    );

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${token}`;

    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOpts = {
        from: process.env.SMTP_FROM || 'no-reply@example.com',
        to: user.email,
        subject: 'Password reset',
        text: `You requested a password reset. Use this link to reset your password: ${resetUrl}`,
      };

      await transporter.sendMail(mailOpts);
      return res.json({ message: 'If that email is in our system, a reset link has been sent.' });
    }

    return res.json({ message: 'Reset link generated (dev)', resetUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate reset token', details: error.message });
  }
});

// Verify reset token (used by frontend to pre-check before showing form)
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: Date.now() }
    });
    if (!user) return res.status(400).json({ valid: false, error: 'Invalid or expired token' });
    res.json({ valid: true });
  } catch (error) {
    res.status(500).json({ valid: false, error: 'Verification failed' });
  }
});

// Reset password
router.post('/reset-password/:token', [
  check('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const token = req.params.token;
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    // Set new password — pre-save hook will hash it correctly
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password', details: error.message });
  }
});

// Get user profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile and settings
router.put('/profile', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // If a password change is requested, handle it separately via save()
    // so the pre-save bcrypt hook fires only for that case
    if (req.body.password) {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      user.password = req.body.password;
      await user.save(); // intentionally triggers password hashing
    }

    // Update all other fields with findByIdAndUpdate (bypasses pre-save hook)
    const updateFields = {};
    if (req.body.name !== undefined)                    updateFields.name = req.body.name;
    if (req.body.email !== undefined)                   updateFields.email = req.body.email;
    if (req.body.language !== undefined)                updateFields.language = req.body.language;
    if (req.body.lowMoistureThreshold !== undefined)    updateFields.lowMoistureThreshold = req.body.lowMoistureThreshold;
    if (req.body.optimalMoistureThreshold !== undefined) updateFields.optimalMoistureThreshold = req.body.optimalMoistureThreshold;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      language: updatedUser.language,
      lowMoistureThreshold: updatedUser.lowMoistureThreshold,
      optimalMoistureThreshold: updatedUser.optimalMoistureThreshold,
      token: generateToken(updatedUser._id)
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
});

module.exports = router;

// Update user profile and settings
router.put('/profile', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    if (req.body.password) {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      user.password = req.body.password;
      await user.save();
    }

    const updateFields = {};
    const allowed = [
      'name', 'email', 'language',
      'lowMoistureThreshold', 'optimalMoistureThreshold',
      'notifyEmail', 'notifyLowMoisture', 'notifyTankEmpty', 'notifyPumpAuto',
    ];
    allowed.forEach(f => { if (req.body[f] !== undefined) updateFields[f] = req.body[f]; });

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { returnDocument: 'after', runValidators: true }
    ).select('-password -refreshToken');

    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      language: updatedUser.language,
      lowMoistureThreshold: updatedUser.lowMoistureThreshold,
      optimalMoistureThreshold: updatedUser.optimalMoistureThreshold,
      notifyEmail: updatedUser.notifyEmail,
      notifyLowMoisture: updatedUser.notifyLowMoisture,
      notifyTankEmpty: updatedUser.notifyTankEmpty,
      notifyPumpAuto: updatedUser.notifyPumpAuto,
      token: generateAccessToken(updatedUser._id),
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
});

// ── POST /api/auth/refresh — exchange refresh token cookie for new access token ──
router.post('/refresh', async (req, res) => {
  const rawToken = req.cookies?.refreshToken;
  if (!rawToken) {
    return res.status(401).json({ error: 'No refresh token provided' });
  }
  try {
    const hashed = hashToken(rawToken);
    const user = await User.findOne({
      refreshToken: hashed,
      refreshTokenExpires: { $gt: new Date() },
    }).select('+refreshToken');

    if (!user) {
      res.clearCookie('refreshToken', { path: '/api/auth' });
      return res.status(401).json({ error: 'Invalid or expired refresh token. Please log in again.' });
    }

    // Rotate: issue a new refresh token on every use
    const newRefresh = generateRefreshToken();
    await saveRefreshToken(user._id, newRefresh);
    setRefreshCookie(res, newRefresh);

    res.json({ token: generateAccessToken(user._id) });
  } catch (err) {
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ── POST /api/auth/logout — revoke refresh token ─────────────────────────────
router.post('/logout', async (req, res) => {
  const rawToken = req.cookies?.refreshToken;
  if (rawToken) {
    const hashed = hashToken(rawToken);
    await User.findOneAndUpdate(
      { refreshToken: hashed },
      { $unset: { refreshToken: '', refreshTokenExpires: '' } }
    );
  }
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;

