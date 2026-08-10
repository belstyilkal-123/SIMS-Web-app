/**
 * Role definitions and permission helpers.
 * Single source of truth for all role-based decisions in the frontend.
 */

export const ROLES = {
  ADMIN:  'super_administrator',
  FARMER: 'farmer',
  LABOR:  'labor',
};

// What each role can access
export const PERMISSIONS = {
  administrator: {
    canViewDevices:       true,
    canControlPump:       true,
    canManageFarms:       true,
    canViewAnalytics:     true,
    canViewAuditLogs:     true,
    canManageUsers:       true,
    canViewSettings:      true,
    canViewNotifications: true,
    canViewHistory:       true,
  },
  farmer: {
    canViewDevices:       true,
    canControlPump:       true,
    canManageFarms:       true,
    canViewAnalytics:     true,
    canViewAuditLogs:     false,
    canManageUsers:       false,
    canViewSettings:      false,
    canViewNotifications: true,
    canViewHistory:       true,
  },
  labor: {
    canViewDevices:       false,
    canControlPump:       false,
    canManageFarms:       false,
    canViewAnalytics:     false,
    canViewAuditLogs:     false,
    canManageUsers:       false,
    canViewSettings:      false,
    canViewNotifications: true,
    canViewHistory:       true,
  },
};

export const can = (user, permission) => {
  if (!user?.role) return false;
  return PERMISSIONS[user.role]?.[permission] ?? false;
};

export const ROLE_META = {
  administrator: {
    label_en: 'super_administrator',
    label_am: 'አስተዳዳሪ',
    icon: '🛡️',
    color: '#ef4444',
    bg: '#fee2e2',
    description_en: 'Full system control & user management',
    description_am: 'ሙሉ የስርዓት ቁጥጥር እና የተጠቃሚ አስተዳደር',
  },
  farmer: {
    label_en: 'Farmer',
    label_am: 'አርሶ አደር',
    icon: '🌾',
    color: '#15803d',
    bg: '#dcfce7',
    description_en: 'Farm control, sensors & reports',
    description_am: 'የእርሻ ቁጥጥር፣ ሴንሰሮች እና ሪፖርቶች',
  },
  labor: {
    label_en: 'Labor',
    label_am: 'ሠራተኛ',
    icon: '👷',
    color: '#2563eb',
    bg: '#dbeafe',
    description_en: 'Sensor monitoring & history',
    description_am: 'የሴንሰር ክትትል እና ታሪክ',
  },
};

