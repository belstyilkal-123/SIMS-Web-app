/**
 * Magic Link (Passwordless) Login
 *
 * Flow:
 *   1. POST /api/auth/magic-link/request  { email }
 *      → generates token, stores hashed version in DB (15 min expiry)
 *      → sends email with link (or returns link in dev mode)
 *
 *   2. GET /api/auth/magic-link/verify?token=xxx
 *      → validates token, clears it, returns JWT + user payload
 *      → frontend stores JWT and redirects to /dashboard
 */

const express    = require('express');
const router     = express.Router();
const crypto     = require('crypto');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User       = require('../models/User');

const MAGIC_LINK_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/* ── JWT generator ─────────────────────────────────────────── */
const generateJWT = (id) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return jwt.sign({ id }, secret, { expiresIn: '30d' });
};

/* ── Email sender ──────────────────────────────────────────── */
const sendMagicLinkEmail = async (email, magicUrl) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@sims-agri.com',
    to: email,
    subject: 'Your SmartIrrigate OS Sign-In Link',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f4f6f4;border-radius:12px">
        <h2 style="color:#15803d;margin-bottom:8px">SmartIrrigate OS</h2>
        <p style="color:#374151;font-size:1rem;margin-bottom:24px">
          Click the button below to sign in. This link expires in <strong>15 minutes</strong> and can only be used once.
        </p>
        <a href="${magicUrl}"
          style="display:inline-block;padding:14px 32px;background:#15803d;color:white;text-decoration:none;border-radius:8px;font-weight:700;font-size:1rem">
          Sign In to SIMS
        </a>
        <p style="color:#6b7280;font-size:0.8rem;margin-top:24px">
          If you did not request this, you can safely ignore this email.
        </p>
      </div>
    `,
    text: `Sign in to SmartIrrigate OS: ${magicUrl}\n\nThis link expires in 15 minutes.`,
  });
};

/* ══════════════════════════════════════════════════════════════
   POST /api/auth/magic-link/request
   Body: { email }
   ══════════════════════════════════════════════════════════════ */
router.post('/request', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    // Find existing user OR create a minimal one (they can fill profile later)
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name:  email.split('@')[0],   // temporary name from email prefix
        email,
        role: 'farmer',
      });
    }

    // Generate raw token + hashed version
    const rawToken    = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Store hashed token — use updateOne to skip pre-save password hook
    await User.updateOne(
      { _id: user._id },
      { $set: {
          magicLinkToken:   hashedToken,
          magicLinkExpires: new Date(Date.now() + MAGIC_LINK_EXPIRY_MS)
        }
      }
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const magicUrl    = `${frontendUrl}/auth/magic-link/verify?token=${rawToken}`;

    // ── Production: send real email ──
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      await sendMagicLinkEmail(email, magicUrl);
      return res.json({
        message: 'Magic link sent! Check your email inbox (and spam folder).',
        expiresInMinutes: 15,
      });
    }

    // ── Dev mode: return link directly ──
    return res.json({
      message: 'Magic link generated (dev mode — SMTP not configured).',
      magicUrl,
      expiresInMinutes: 15,
    });

  } catch (err) {
    console.error('[Magic Link Request]', err);
    res.status(500).json({ error: 'Failed to generate magic link. Please try again.' });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/auth/magic-link/verify?token=xxx
   ══════════════════════════════════════════════════════════════ */
router.get('/verify', async (req, res) => {
  try {
    const rawToken = (req.query.token || '').trim();
    if (!rawToken) {
      return res.status(400).json({ error: 'Missing token.' });
    }

    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await User.findOne({
      magicLinkToken:   hashedToken,
      magicLinkExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        error: 'This magic link is invalid or has expired. Please request a new one.',
        expired: true,
      });
    }

    // Clear the token so it can only be used once
    await User.updateOne(
      { _id: user._id },
      { $unset: { magicLinkToken: 1, magicLinkExpires: 1 } }
    );

    // Return full JWT payload — same shape as email/password login
    const token = generateJWT(user._id);
    res.json({
      _id:      user._id,
      name:     user.name,
      email:    user.email,
      role:     user.role,
      language: user.language || 'en',
      avatar:   user.avatar   || null,
      lowMoistureThreshold:     user.lowMoistureThreshold,
      optimalMoistureThreshold: user.optimalMoistureThreshold,
      token,
    });

  } catch (err) {
    console.error('[Magic Link Verify]', err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

module.exports = router;
