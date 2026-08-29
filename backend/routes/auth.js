const express    = require('express');
const router     = express.Router();
const jwt        = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const User       = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

/* ── Token helpers ───────────────────────────────────────────────────── */
const generateAccessToken = (id) => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  const expiry = process.env.NODE_ENV === 'production' ? '15m' : '8h';
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: expiry });
};

const generateRefreshToken = () => crypto.randomBytes(40).toString('hex');
const hashToken            = (t) => crypto.createHash('sha256').update(t).digest('hex');

const saveRefreshToken = async (userId, rawToken) => {
  const hashed  = hashToken(rawToken);
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await User.findByIdAndUpdate(userId, { refreshToken: hashed, refreshTokenExpires: expires });
};

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   30 * 24 * 60 * 60 * 1000,
    path:     '/api/auth',
  });
};

/* ═══════════════════════════════════════════════════════════════════════
   POST /api/auth/register
   ─────────────────────────────────────────────────────────────────────
   SPEC §46-§53:
   • Creates a PENDING account — NO token issued.
   • Only farmer, office_manager, labor allowed for self-registration.
   • owner and admin must be created by an existing admin (via /api/admin/users).
   • Notifies admins of new pending registration.
═══════════════════════════════════════════════════════════════════════ */
const SELF_REGISTER_ROLES = ['farmer', 'office_manager', 'labor'];

router.post(
  '/register',
  [
    check('name').notEmpty().withMessage('Name is required'),
    check('email').isEmail().withMessage('Please include a valid email'),
    check('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    check('requestedRole')
      .isIn(SELF_REGISTER_ROLES)
      .withMessage(`Role must be one of: ${SELF_REGISTER_ROLES.join(', ')}`),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { name, email, password, requestedRole, phone, address, language } = req.body;

      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }

      // Create PENDING account — no assignedRole, no token
      const user = await User.create({
        name,
        email,
        password,
        phone:         phone    || '',
        address:       address  || '',
        language:      language || 'en',
        requestedRole,
        assignedRole:  null,    // set by admin on approval
        accountStatus: 'pending',
      });

      // Notify all active admins of a new pending registration
      try {
        const notifSvc = require('../services/notificationService');
        const admins   = await User.find({ assignedRole: 'admin', accountStatus: 'active' }).select('email name');
        for (const admin of admins) {
          await notifSvc.sendAlertEmail(
            admin.email,
            `New Registration Pending — ${name}`,
            `A new user has registered requesting the <strong>${requestedRole}</strong> role.<br><br>
             Name: ${name}<br>Email: ${email}<br><br>
             Please log in to the Admin portal to review and approve or reject this registration.`
          );
        }
      } catch (notifErr) {
        console.warn('[Register] Notification failed:', notifErr.message);
      }

      // Return 202 Accepted — no token, account is pending
      res.status(202).json({
        message: 'Registration submitted successfully. Your account is pending approval. You will be notified by email once reviewed.',
        message_am: 'ምዝገባዎ ተልኳል። መለያዎ ሲፀድቅ ማሳወቂያ ይደርስዎታል።',
        accountStatus: 'pending',
        email: user.email,
      });

    } catch (error) {
      res.status(500).json({
        error:    'Registration failed',
        error_am: 'ምዝገባ አልተሳካም',
        details:  error.message,
      });
    }
  }
);

/* ═══════════════════════════════════════════════════════════════════════
   POST /api/auth/login
   ─────────────────────────────────────────────────────────────────────
   Returns clear accountStatus so frontend can show correct message.
═══════════════════════════════════════════════════════════════════════ */
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

      // No user or wrong password — generic message (prevents enumeration)
      if (!user || !(await user.matchPassword(password))) {
        return res.status(401).json({
          error:    'Invalid email or password.',
          error_am: 'ኢሜይል ወይም የይለፍ ቃል ትክክል አይደለም',
        });
      }

      // Account status gate — return specific status so frontend shows correct page
      if (user.accountStatus !== 'active') {
        const statusMessages = {
          pending:     { en: 'Your account is pending approval. You will be notified once reviewed.', am: 'መለያዎ ሲፀድቅ ይጠብቁ።' },
          rejected:    { en: 'Your account registration was rejected. Please contact the administrator.', am: 'ምዝገባዎ ተቀባይነት አላገኘም።' },
          suspended:   { en: 'Your account has been suspended. Please contact the administrator.', am: 'መለያዎ ታግዷል።' },
          deactivated: { en: 'Your account has been deactivated.', am: 'መለያዎ ተሰርዟል።' },
        };
        const msgs = statusMessages[user.accountStatus] || statusMessages.pending;
        return res.status(403).json({
          error:         msgs.en,
          error_am:      msgs.am,
          accountStatus: user.accountStatus,
        });
      }

      // Issue tokens
      const accessToken  = generateAccessToken(user._id);
      const refreshToken = generateRefreshToken();
      await saveRefreshToken(user._id, refreshToken);
      setRefreshCookie(res, refreshToken);

      res.json({
        _id:                     user._id,
        name:                    user.name,
        email:                   user.email,
        role:                    user.assignedRole,   // use assignedRole
        assignedRole:            user.assignedRole,
        accountStatus:           user.accountStatus,
        language:                user.language || 'en',
        lowMoistureThreshold:    user.lowMoistureThreshold,
        optimalMoistureThreshold:user.optimalMoistureThreshold,
        notifyEmail:             user.notifyEmail,
        notifyLowMoisture:       user.notifyLowMoisture,
        notifyTankEmpty:         user.notifyTankEmpty,
        notifyPumpAuto:          user.notifyPumpAuto,
        avatar:                  user.avatar,
        token:                   accessToken,
      });

    } catch (error) {
      res.status(500).json({ error: 'Login failed', error_am: 'መግባት አልተሳካም', details: error.message });
    }
  }
);

/* ── Forgot password ─────────────────────────────────────────── */
router.post('/forgot-password', [
  check('email').isEmail().withMessage('Please include a valid email'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const email = (req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user) return res.json({ message: 'If that email is in our system, a reset link has been sent.' });

    const token  = crypto.randomBytes(20).toString('hex');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    await User.updateOne({ _id: user._id }, {
      $set: { resetPasswordToken: hashed, resetPasswordExpires: Date.now() + 3600000 }
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${token}`;

    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        const isGmail = (process.env.SMTP_HOST || '').includes('gmail');
        const transporter = nodemailer.createTransport(
          isGmail
            ? {
                service: 'gmail',
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
              }
            : {
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 587,
                secure: Number(process.env.SMTP_PORT) === 465,
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
              }
        );

        await transporter.sendMail({
          from: process.env.SMTP_FROM || `"SmartIrrigate SIMS" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: 'Password Reset — SIMS',
          text: `Reset your password: ${resetUrl}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
              <h2 style="color: #2e7d32; text-align: center;">Smart Irrigation Management System</h2>
              <p>Hello,</p>
              <p>You recently requested to reset your password for your SIMS account. Click the button below to reset it:</p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="${resetUrl}" style="background-color: #2e7d32; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
              </div>
              <p style="color: #666; font-size: 0.9em;">Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; color: #1976d2; font-size: 0.85em;">${resetUrl}</p>
              <p style="color: #888; font-size: 0.85em; margin-top: 20px;">This password reset link is valid for 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
          `
        });
        console.log(`[SMTP] Password Reset Email sent to ${user.email}`);
        return res.json({ message: 'If that email is in our system, a reset link has been sent.' });
      } catch (mailErr) {
        console.warn('⚠️ [SMTP Email Failed]:', mailErr.message);
        console.log(`\n======================================================`);
        console.log(`🔗 [DEV FALLBACK] Password Reset Link for ${user.email}:`);
        console.log(`${resetUrl}`);
        console.log(`======================================================\n`);
        return res.json({ 
          message: 'If that email is in our system, a reset link has been sent.' 
        });
      }
    }

    console.log(`\n======================================================`);
    console.log(`[DEV MODE] Password Reset Link for ${user.email}: ${resetUrl}`);
    console.log(`======================================================\n`);
    return res.json({ message: 'If that email is in our system, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process password reset', details: err.message });
  }
});

/* ── Verify reset token ──────────────────────────────────────── */
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ valid: false, error: 'Invalid or expired token' });
    res.json({ valid: true });
  } catch (err) {
    res.status(500).json({ valid: false, error: 'Verification failed' });
  }
});

/* ── Reset password ──────────────────────────────────────────── */
router.post('/reset-password/:token', [
  check('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password', details: err.message });
  }
});

/* ── Get profile ─────────────────────────────────────────────── */
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -refreshToken');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/* ── Update profile & settings ───────────────────────────────── */
router.put('/profile', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    if (req.body.password) {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      user.password = req.body.password;
      await user.save();
    }

    const allowed = [
      'name', 'email', 'phone', 'address', 'language',
      'lowMoistureThreshold', 'optimalMoistureThreshold',
      'notifyEmail', 'notifyLowMoisture', 'notifyTankEmpty', 'notifyPumpAuto', 'avatar'
    ];
    const updateFields = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updateFields[f] = req.body[f]; });

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { returnDocument: 'after', runValidators: true }
    ).select('-password -refreshToken');

    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    res.json({
      _id:                     updatedUser._id,
      name:                    updatedUser.name,
      email:                   updatedUser.email,
      role:                    updatedUser.assignedRole,
      assignedRole:            updatedUser.assignedRole,
      accountStatus:           updatedUser.accountStatus,
      language:                updatedUser.language,
      lowMoistureThreshold:    updatedUser.lowMoistureThreshold,
      optimalMoistureThreshold:updatedUser.optimalMoistureThreshold,
      notifyEmail:             updatedUser.notifyEmail,
      notifyLowMoisture:       updatedUser.notifyLowMoisture,
      notifyTankEmpty:         updatedUser.notifyTankEmpty,
      notifyPumpAuto:          updatedUser.notifyPumpAuto,
      avatar:                  updatedUser.avatar,
      token:                   generateAccessToken(updatedUser._id),
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile', details: err.message });
  }
});

/* ── Refresh token ───────────────────────────────────────────── */
router.post('/refresh', async (req, res) => {
  const rawToken = req.cookies?.refreshToken;
  if (!rawToken) return res.status(401).json({ error: 'No refresh token provided' });
  try {
    const hashed = hashToken(rawToken);
    const user   = await User.findOne({ refreshToken: hashed, refreshTokenExpires: { $gt: new Date() } })
      .select('+refreshToken');
    if (!user) {
      res.clearCookie('refreshToken', { path: '/api/auth' });
      return res.status(401).json({ error: 'Invalid or expired refresh token. Please log in again.' });
    }
    const newRefresh = generateRefreshToken();
    await saveRefreshToken(user._id, newRefresh);
    setRefreshCookie(res, newRefresh);
    res.json({ token: generateAccessToken(user._id) });
  } catch (err) {
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/* ── Logout ──────────────────────────────────────────────────── */
router.post('/logout', async (req, res) => {
  const rawToken = req.cookies?.refreshToken;
  if (rawToken) {
    const hashed = hashToken(rawToken);
    await User.findOneAndUpdate({ refreshToken: hashed }, { $unset: { refreshToken: '', refreshTokenExpires: '' } });
  }
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
