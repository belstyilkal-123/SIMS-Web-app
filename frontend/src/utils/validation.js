/**
 * Shared validation helpers used across all forms.
 * Returns a string error message or '' if valid.
 */

export const validators = {
  name: (value, t) => {
    if (!value || !value.trim()) return t.nameRequired;
    if (value.trim().length < 2) return t.nameTooShort;
    if (value.trim().length > 50) return t.nameTooLong;
    if (!/^[a-zA-Z\u1200-\u137F\s'-]+$/.test(value.trim()))
      return t.nameInvalidChars;
    return '';
  },

  email: (value, t) => {
    if (!value || !value.trim()) return t.emailRequired;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
      return t.invalidEmail;
    return '';
  },

  password: (value, t) => {
    if (!value) return t.passwordRequired;
    if (value.length < 8) return t.passwordMinLength;
    if (!/[a-z]/.test(value)) return t.passwordLowercase;
    if (!/[A-Z]/.test(value)) return t.passwordUppercase;
    if (!/[0-9]/.test(value)) return t.passwordNumber;
    return '';
  },

  confirmPassword: (value, password, t) => {
    if (!value) return t.confirmPasswordRequired;
    if (value !== password) return t.passwordsMustMatch;
    return '';
  },

  threshold: (value, min, max, t) => {
    const n = Number(value);
    if (value === '' || value === null || value === undefined) return t.required || 'Required';
    if (isNaN(n)) return t.mustBeNumber || 'Must be a number';
    if (n < min || n > max) return (t.mustBeBetween || `Must be between ${min} and ${max}`)
      .replace('{min}', min).replace('{max}', max);
    return '';
  },

  message: (value, t) => {
    if (!value || !value.trim()) return t.messageRequired;
    if (value.trim().length < 10) return t.messageTooShort;
    if (value.trim().length > 1000) return t.messageTooLong;
    return '';
  }
};

/** Password strength: returns 0-4 */
export const passwordStrength = (password) => {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return score;
};

export const strengthLabel = {
  en: ['', 'Weak', 'Fair', 'Good', 'Strong'],
  am: ['', 'ደካማ', 'መካከለኛ', 'ጥሩ', 'ጠንካራ']
};

export const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
