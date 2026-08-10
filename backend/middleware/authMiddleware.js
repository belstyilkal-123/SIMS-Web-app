const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/* ── Bilingual error messages ──────────────────────────────────────────── */
const MSG = {
  en: {
    tokenFailed: 'Not authorized, token failed',
    noToken:     'Not authorized, no token',
    suspended:   'Your account has been suspended. Contact your administrator.',
    notAdmin:    'Access denied — Super Administrator role required',
    noPermission:'Access denied — insufficient permissions',
  },
  am: {
    tokenFailed: 'ስልጣን አልተሰጠም፣ ቶከን ተሳናል',
    noToken:     'ስልጣን አልተሰጠም፣ ቶከን የለም',
    suspended:   'መለያዎ ታግዷል። አስተዳዳሪዎን ያነጋግሩ።',
    notAdmin:    'መዳረሻ ተከልክሏል — ሱፐር አስተዳዳሪ ሚና ያስፈልጋል',
    noPermission:'መዳረሻ ተከልክሏል — በቂ ፈቃድ የለም',
  },
};

const getLang = (req) => {
  const l = req.headers['accept-language'] || req.query.lang || 'en';
  return l.startsWith('am') ? 'am' : 'en';
};

/* ── protect — verify JWT and load user ───────────────────────────────── */
const protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    const m = MSG[getLang(req)];
    return res.status(401).json({ error: m.noToken });
  }
  try {
    const token   = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ error: MSG[getLang(req)].tokenFailed });
    }

    // Block suspended accounts from all API calls
    if (!user.isActive) {
      return res.status(403).json({ error: MSG[user.language || getLang(req)].suspended });
    }

    req.user = user;
    req.lang = user.language || getLang(req);
    return next();
  } catch {
    return res.status(401).json({ error: MSG[getLang(req)].tokenFailed });
  }
};

/* ── authorize(...roles) ──────────────────────────────────────────────── */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    const m = MSG[req.lang || getLang(req)];
    return res.status(403).json({ error: m.noPermission });
  }
  next();
};

/* ── admin (legacy alias) ─────────────────────────────────────────────── */
const admin = (req, res, next) => {
  if (req.user?.role === 'super_administrator') return next();
  const m = MSG[req.lang || getLang(req)];
  return res.status(403).json({ error: m.notAdmin });
};

/* ── Role constants ───────────────────────────────────────────────────── */
const ROLES = {
  SUPER_ADMIN:    'super_administrator',
  OFFICE_MANAGER: 'office_manager',
  FARMER:         'farmer',
  LABOR:          'labor',
};

/* ── Role checker helpers ─────────────────────────────────────────────── */
const isSuperAdmin     = (u) => u?.role === ROLES.SUPER_ADMIN;
const isAdmin          = isSuperAdmin;          // backward-compat alias
const isAdministrator  = isSuperAdmin;          // backward-compat alias (used in dashboard.js)
const isOfficeManager  = (u) => u?.role === ROLES.OFFICE_MANAGER;
const isFarmer         = (u) => u?.role === ROLES.FARMER;
const isLabor          = (u) => u?.role === ROLES.LABOR;

/* ── ALL_ROLES helper array ───────────────────────────────────────────── */
const ALL_ROLES = Object.values(ROLES);

module.exports = {
  protect, admin, authorize,
  ROLES, ALL_ROLES,
  isSuperAdmin, isAdmin, isAdministrator,
  isOfficeManager, isFarmer, isLabor,
};
