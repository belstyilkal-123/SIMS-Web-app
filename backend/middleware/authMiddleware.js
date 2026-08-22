const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/* ── Bilingual error messages ──────────────────────────────────── */
const MSG = {
  en: {
    tokenFailed: 'Not authorized — token failed',
    noToken:     'Not authorized — no token provided',
    pending:     'Your account is pending approval. You will be notified once approved.',
    rejected:    'Your account registration was rejected. Please contact the administrator.',
    suspended:   'Your account has been suspended. Please contact the administrator.',
    deactivated: 'Your account has been deactivated.',
    noPermission:'Access denied — insufficient permissions for this action',
    notAdmin:    'Access denied — Admin role required',
  },
  am: {
    tokenFailed: 'ስልጣን አልተሰጠም — ቶከን ተሳናል',
    noToken:     'ስልጣን አልተሰጠም — ቶከን አልቀረበም',
    pending:     'መለያዎ ሲፀድቅ ይጠብቁ። ሲፈቀድ ማሳወቂያ ይደርስዎታል።',
    rejected:    'ምዝገባዎ ተቀባይነት አላገኘም። አስተዳዳሪውን ያነጋግሩ።',
    suspended:   'መለያዎ ታግዷል። አስተዳዳሪውን ያነጋግሩ።',
    deactivated: 'መለያዎ ተሰርዟል።',
    noPermission:'መዳረሻ ተከልክሏል — በቂ ፈቃድ የለም',
    notAdmin:    'መዳረሻ ተከልክሏል — የአስተዳዳሪ ሚና ያስፈልጋል',
  },
};

const getLang = (req) => {
  const l = req.headers['accept-language'] || req.query.lang || 'en';
  return l.startsWith('am') ? 'am' : 'en';
};

/* ──────────────────────────────────────────────────────────────────
   ROLES — five-level hierarchy (spec §2)
────────────────────────────────────────────────────────────────── */
const ROLES = {
  OWNER:          'owner',
  ADMIN:          'admin',
  OFFICE_MANAGER: 'office_manager',
  FARMER:         'farmer',
  LABOR:          'labor',
};

const ALL_ROLES = Object.values(ROLES);

/* ──────────────────────────────────────────────────────────────────
   PERMISSIONS — granular permission constants (spec §56)
   Used as a reference map; enforce via hasPermission() helper
────────────────────────────────────────────────────────────────── */
const PERMISSIONS = {
  // User management
  USER_VIEW:        'user:view',
  USER_CREATE:      'user:create',
  USER_APPROVE:     'user:approve',
  USER_REJECT:      'user:reject',
  USER_SUSPEND:     'user:suspend',
  USER_ACTIVATE:    'user:activate',
  USER_DEACTIVATE:  'user:deactivate',
  USER_RESET:       'user:reset',
  ROLE_ASSIGN:      'role:assign',
  ROLE_CHANGE:      'role:change',

  // Farm management
  FARM_VIEW:        'farm:view',
  FARM_CREATE:      'farm:create',
  FARM_UPDATE:      'farm:update',
  FARM_DELETE:      'farm:delete',

  // Device / Sensor
  DEVICE_VIEW:      'device:view',
  DEVICE_CREATE:    'device:create',
  DEVICE_UPDATE:    'device:update',
  DEVICE_DELETE:    'device:delete',
  SENSOR_VIEW:      'sensor:view',

  // Irrigation
  IRRIGATION_VIEW:     'irrigation:view',
  IRRIGATION_START:    'irrigation:start',
  IRRIGATION_STOP:     'irrigation:stop',
  IRRIGATION_SCHEDULE: 'irrigation:schedule',

  // Tasks
  TASK_VIEW:        'task:view',
  TASK_CREATE:      'task:create',
  TASK_ASSIGN:      'task:assign',
  TASK_UPDATE:      'task:update',
  TASK_COMPLETE:    'task:complete',

  // Attendance
  ATTENDANCE_VIEW:   'attendance:view',
  ATTENDANCE_RECORD: 'attendance:record',
  ATTENDANCE_UPDATE: 'attendance:update',

  // Payroll
  PAYROLL_VIEW:     'payroll:view',
  PAYROLL_CREATE:   'payroll:create',
  PAYROLL_SUBMIT:   'payroll:submit',
  PAYROLL_APPROVE:  'payroll:approve',  // Owner only

  // Salary
  SALARY_VIEW:      'salary:view',
  SALARY_UPDATE:    'salary:update',

  // Funds / Finance (Owner only)
  FUND_VIEW:        'fund:view',
  FUND_MANAGE:      'fund:manage',
  EXPENSE_VIEW:     'expense:view',
  EXPENSE_CREATE:   'expense:create',
  EXPENSE_APPROVE:  'expense:approve',
  PAYMENT_VIEW:     'payment:view',
  PAYMENT_APPROVE:  'payment:approve',

  // Reports
  REPORT_VIEW:      'report:view',
  REPORT_EXPORT:    'report:export',

  // System
  AUDIT_LOG_VIEW:       'audit_log:view',
  SYSTEM_SETTINGS_VIEW: 'system:settings:view',
  SYSTEM_SETTINGS_MANAGE:'system:settings:manage',
};

/* ── Role-Permission Matrix (spec §57) ──────────────────────── */
const ROLE_PERMISSIONS = {
  owner: [
    PERMISSIONS.USER_VIEW, PERMISSIONS.USER_ACTIVATE, PERMISSIONS.USER_DEACTIVATE,
    PERMISSIONS.USER_SUSPEND, PERMISSIONS.ROLE_ASSIGN,
    PERMISSIONS.FARM_VIEW, PERMISSIONS.FARM_CREATE, PERMISSIONS.FARM_UPDATE, PERMISSIONS.FARM_DELETE,
    PERMISSIONS.DEVICE_VIEW, PERMISSIONS.SENSOR_VIEW,
    PERMISSIONS.IRRIGATION_VIEW, PERMISSIONS.IRRIGATION_START, PERMISSIONS.IRRIGATION_STOP, PERMISSIONS.IRRIGATION_SCHEDULE,
    PERMISSIONS.TASK_VIEW, PERMISSIONS.TASK_CREATE, PERMISSIONS.TASK_ASSIGN,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_APPROVE,
    PERMISSIONS.SALARY_VIEW,
    PERMISSIONS.FUND_VIEW, PERMISSIONS.FUND_MANAGE,
    PERMISSIONS.EXPENSE_VIEW, PERMISSIONS.EXPENSE_CREATE, PERMISSIONS.EXPENSE_APPROVE,
    PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.PAYMENT_APPROVE,
    PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.AUDIT_LOG_VIEW,
  ],
  admin: [
    PERMISSIONS.USER_VIEW, PERMISSIONS.USER_CREATE, PERMISSIONS.USER_APPROVE,
    PERMISSIONS.USER_REJECT, PERMISSIONS.USER_SUSPEND, PERMISSIONS.USER_ACTIVATE,
    PERMISSIONS.USER_DEACTIVATE, PERMISSIONS.USER_RESET,
    PERMISSIONS.ROLE_ASSIGN, PERMISSIONS.ROLE_CHANGE,
    PERMISSIONS.DEVICE_VIEW, PERMISSIONS.SENSOR_VIEW,
    PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.AUDIT_LOG_VIEW,
    PERMISSIONS.SYSTEM_SETTINGS_VIEW, PERMISSIONS.SYSTEM_SETTINGS_MANAGE,
  ],
  office_manager: [
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.FARM_VIEW, PERMISSIONS.FARM_UPDATE,
    PERMISSIONS.DEVICE_VIEW,
    PERMISSIONS.TASK_VIEW, PERMISSIONS.TASK_CREATE, PERMISSIONS.TASK_ASSIGN, PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ATTENDANCE_RECORD, PERMISSIONS.ATTENDANCE_UPDATE,
    PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_CREATE, PERMISSIONS.PAYROLL_SUBMIT,
    PERMISSIONS.SALARY_VIEW, PERMISSIONS.SALARY_UPDATE,
    PERMISSIONS.EXPENSE_VIEW,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_EXPORT,
  ],
  farmer: [
    PERMISSIONS.FARM_VIEW, PERMISSIONS.FARM_UPDATE,
    PERMISSIONS.DEVICE_VIEW,
    PERMISSIONS.SENSOR_VIEW,
    PERMISSIONS.IRRIGATION_VIEW, PERMISSIONS.IRRIGATION_START, PERMISSIONS.IRRIGATION_STOP, PERMISSIONS.IRRIGATION_SCHEDULE,
    PERMISSIONS.TASK_VIEW, PERMISSIONS.TASK_CREATE, PERMISSIONS.TASK_ASSIGN, PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_EXPORT,
  ],
  labor: [
    PERMISSIONS.TASK_VIEW, PERMISSIONS.TASK_COMPLETE, PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ATTENDANCE_RECORD,
    PERMISSIONS.IRRIGATION_VIEW,
    PERMISSIONS.REPORT_VIEW,
  ],
};

/* ── protect — verify JWT, load user, check account status ──── */
const protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: MSG[getLang(req)].noToken });
  }
  try {
    const token   = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('-password');

    if (!user) return res.status(401).json({ error: MSG[getLang(req)].tokenFailed });

    const lang = user.language || getLang(req);

    // Enforce account status
    switch (user.accountStatus) {
      case 'pending':
        return res.status(403).json({ error: MSG[lang].pending, accountStatus: 'pending' });
      case 'rejected':
        return res.status(403).json({ error: MSG[lang].rejected, accountStatus: 'rejected' });
      case 'suspended':
        return res.status(403).json({ error: MSG[lang].suspended, accountStatus: 'suspended' });
      case 'deactivated':
        return res.status(403).json({ error: MSG[lang].deactivated, accountStatus: 'deactivated' });
      case 'active':
        break;
      default:
        return res.status(403).json({ error: MSG[lang].pending, accountStatus: user.accountStatus });
    }

    req.user = user;
    req.lang = lang;
    return next();
  } catch {
    return res.status(401).json({ error: MSG[getLang(req)].tokenFailed });
  }
};

/* ── Helper: Get user role ───────────────────────────────────── */
// Always prefer assignedRole (official granted role after approval)
// Falls back to role field for backward compatibility
const getUserRole = (u) => u?.assignedRole || u?.role;

/* ── authorize(...roles) — role-based middleware ───────────────  */
const authorize = (...allowedRoles) => (req, res, next) => {
  const role = getUserRole(req.user);
  if (!req.user || !allowedRoles.includes(role)) {
    return res.status(403).json({ error: MSG[req.lang || 'en'].noPermission });
  }
  next();
};

/* ── requirePermission(permission) — permission-based middleware */
const requirePermission = (permission) => (req, res, next) => {
  const role = getUserRole(req.user);
  const perms = ROLE_PERMISSIONS[role] || [];
  if (!perms.includes(permission)) {
    return res.status(403).json({ error: MSG[req.lang || 'en'].noPermission });
  }
  next();
};

/* ── hasPermission helper (use in route handlers) ───────────── */
const hasPermission = (user, permission) => {
  const role = getUserRole(user);
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
};

/* ── admin legacy middleware ─────────────────────────────────── */
const admin = (req, res, next) => {
  if (getUserRole(req.user) === ROLES.ADMIN) return next();
  return res.status(403).json({ error: MSG[req.lang || 'en'].notAdmin });
};

/* ── Role checker helpers ────────────────────────────────────── */
const isOwner         = (u) => getUserRole(u) === ROLES.OWNER;
const isAdmin         = (u) => getUserRole(u) === ROLES.ADMIN;
const isAdministrator = isAdmin;   // backward-compat
const isSuperAdmin    = isAdmin;   // backward-compat alias
const isOfficeManager = (u) => getUserRole(u) === ROLES.OFFICE_MANAGER;
const isFarmer        = (u) => getUserRole(u) === ROLES.FARMER;
const isLabor         = (u) => getUserRole(u) === ROLES.LABOR;

module.exports = {
  protect, admin, authorize, requirePermission, hasPermission, getUserRole,
  ROLES, ALL_ROLES, PERMISSIONS, ROLE_PERMISSIONS,
  isOwner, isAdmin, isAdministrator, isSuperAdmin,
  isOfficeManager, isFarmer, isLabor,
};
