import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import FormField from '../components/FormField';
import { validators } from '../utils/validation';
import { API_URL } from '../config/api';

const T = {
  en: {
    title: 'Request Account',
    subtitle: 'Submit a registration request',
    nameLabel: 'Full Name', emailLabel: 'Email Address',
    phoneLabel: 'Phone Number (optional)', addressLabel: 'Address (optional)',
    passwordLabel: 'Password', confirmPasswordLabel: 'Confirm Password',
    roleLabel: 'Requested Role',
    registerButton: 'Submit Registration', registering: 'Submitting…',
    alreadyHaveAccount: 'Already have an account?', loginHere: 'Sign in',
    registrationFailed: 'Registration failed. Please try again.',
    pendingTitle: '✅ Registration Submitted!',
    pendingMessage: 'Your registration has been submitted and is pending review by the administrator. You will receive an email notification once your account is approved or rejected. Do NOT attempt to log in until you receive approval.',
    pendingMessage_am: 'ምዝገባዎ ተልኳል። አስተዳዳሪው ሲያጸድቅ ኢሜይል ይደርስዎታል።',
    pendingNote: 'Accounts are not activated automatically. This protects the organization.',
    nameRequired: 'Full name is required',
    nameTooShort: 'Name must be at least 2 characters',
    nameTooLong: 'Name must be under 50 characters',
    nameInvalidChars: 'Name can only contain letters, spaces, hyphens and apostrophes',
    emailRequired: 'Email address is required',
    invalidEmail: 'Enter a valid email address',
    passwordRequired: 'Password is required',
    passwordMinLength: 'Password must be at least 8 characters',
    passwordLowercase: 'Add at least one lowercase letter (a-z)',
    passwordUppercase: 'Add at least one uppercase letter (A-Z)',
    passwordNumber: 'Add at least one number (0-9)',
    confirmPasswordRequired: 'Please confirm your password',
    passwordsMustMatch: 'Passwords do not match',
    passwordHint: 'Min 8 chars · uppercase · lowercase · number',
    roleNote: 'Owner and Admin accounts are created by the system administrator. You cannot self-register for those roles.',
  },
  am: {
    title: 'መለያ ጠይቅ',
    subtitle: 'የምዝገባ ጥያቄ ያስገቡ',
    nameLabel: 'ሙሉ ስም', emailLabel: 'ኢሜይል አድራሻ',
    phoneLabel: 'ስልክ ቁጥር (አማራጭ)', addressLabel: 'አድራሻ (አማራጭ)',
    passwordLabel: 'የይለፍ ቃል', confirmPasswordLabel: 'የይለፍ ቃል አረጋግጥ',
    roleLabel: 'የተፈለገ ሚና',
    registerButton: 'ምዝገባ ያስገቡ', registering: 'በማስገባት ላይ…',
    alreadyHaveAccount: 'ቀድሞውኑ መለያ አለህ?', loginHere: 'ይግቡ',
    registrationFailed: 'ምዝገባ አልተሳካም። እባክዎ እንደገና ይሞክሩ።',
    pendingTitle: '✅ ምዝገባ ተልኳል!',
    pendingMessage: 'ምዝገባዎ ተልኳል። አስተዳዳሪው ሲያጸድቅ ኢሜይል ይደርስዎታል። ፈቃድ እስኪደርስዎ ወደ ስርዓቱ ለመግባት አይሞክሩ።',
    pendingNote: 'መለያዎች ራስ-ሰር አይነቃቁም። ይህ ድርጅቱን ይጠብቃል።',
    nameRequired: 'ሙሉ ስም ያስፈልጋል',
    nameTooShort: 'ስም ቢያንስ 2 ቁምፊዎች መሆን አለበት',
    nameTooLong: 'ስም ከ50 ቁምፊዎች በታች መሆን አለበት',
    nameInvalidChars: 'ስም ፊደሎችን ብቻ ሊይዝ ይችላል',
    emailRequired: 'ኢሜይል አድራሻ ያስፈልጋል',
    invalidEmail: 'ትክክለኛ ኢሜይል አድራሻ ያስፈልጋል',
    passwordRequired: 'የይለፍ ቃል ያስፈልጋል',
    passwordMinLength: 'የይለፍ ቃል ቢያንስ 8 ቁምፊዎች መሆን አለበት',
    passwordLowercase: 'ቢያንስ አንድ ትንሽ ፊደል (a-z) ያክሉ',
    passwordUppercase: 'ቢያንስ አንድ ትልቅ ፊደል (A-Z) ያክሉ',
    passwordNumber: 'ቢያንስ አንድ ቁጥር (0-9) ያክሉ',
    confirmPasswordRequired: 'እባክዎ የይለፍ ቃልዎን ያረጋግጡ',
    passwordsMustMatch: 'የይለፍ ቃሎቹ አይዛመዱም',
    passwordHint: 'ቢያንስ 8 ቁምፊዎች · ትልቅ · ትንሽ · ቁጥር',
    roleNote: 'የባለቤት እና አስተዳዳሪ መለያዎች በስርዓቱ አስተዳዳሪ ይፈጠራሉ። ለእነዚህ ሚናዎች ራሰዎን ማስመዝገብ አይችሉም።',
  },
};

// Only these 3 roles may self-register (spec §47, §51)
const SELF_REGISTER_ROLES = [
  { value: 'farmer',         icon: '🌾', label_en: 'Farmer',         label_am: 'አርሶ አደር' },
  { value: 'office_manager', icon: '💼', label_en: 'Office Manager',  label_am: 'ቢሮ አስተዳዳሪ' },
  { value: 'labor',          icon: '👷', label_en: 'Labour Worker',   label_am: 'ሠራተኛ' },
];

const INIT = {
  name: '', email: '', phone: '', address: '',
  password: '', confirmPassword: '', requestedRole: 'farmer',
};

export default function Register() {
  const [lang, setLang]          = useState(localStorage.getItem('preferredLanguage') || 'en');
  const [values, setValues]      = useState(INIT);
  const [touched, setTouched]    = useState({});
  const [globalError, setGlobal] = useState('');
  const [submitted, setSubmitted] = useState(false); // show pending screen
  const [submitting, setSub]     = useState(false);
  const navigate = useNavigate();

  const t    = T[lang] || T.en;
  const isAm = lang === 'am';

  const errors = {
    name:            validators.name(values.name, t),
    email:           validators.email(values.email, t),
    password:        validators.password(values.password, t),
    confirmPassword: validators.confirmPassword(values.confirmPassword, values.password, t),
  };
  const formValid = Object.values(errors).every(e => e === '');

  const handleChange = e => setValues(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleBlur   = e => setTouched(prev => ({ ...prev, [e.target.name]: true }));
  const touchAll = () => setTouched({ name: true, email: true, password: true, confirmPassword: true });

  const handleSubmit = async e => {
    e.preventDefault();
    touchAll();
    if (!formValid) return;
    setSub(true);
    setGlobal('');
    try {
      await axios.post(`${API_URL}/api/auth/register`, {
        name:          values.name.trim(),
        email:         values.email.trim().toLowerCase(),
        password:      values.password,
        requestedRole: values.requestedRole,
        phone:         values.phone.trim(),
        address:       values.address.trim(),
        language:      lang,
      });
      setSubmitted(true); // show pending success screen
    } catch (err) {
      const data = err.response?.data;
      setGlobal(isAm && data?.error_am ? data.error_am : data?.error || t.registrationFailed);
    } finally {
      setSub(false);
    }
  };

  /* ── Pending success screen ────────────────────────────────── */
  if (submitted) {
    return (
      <div className="auth-container">
        <div className="glass-card auth-card" style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
          <h2 style={{ color: 'var(--primary)', fontWeight: 800, margin: '0 0 12px' }}>{t.pendingTitle}</h2>
          <p style={{ color: 'var(--text-main)', lineHeight: 1.7, marginBottom: 16, fontSize: '0.95rem' }}>
            {isAm ? t.pendingMessage_am : t.pendingMessage}
          </p>
          <div style={{
            background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8,
            padding: '10px 16px', marginBottom: 20, fontSize: '0.82rem', color: '#92400e',
          }}>
            ⚠️ {t.pendingNote}
          </div>
          <Link to="/login" className="btn btn-primary"
            style={{ display: 'block', width: '100%', padding: 12, fontWeight: 700, textDecoration: 'none' }}>
            {isAm ? 'ወደ መግቢያ ይሂዱ' : 'Go to Login'}
          </Link>
        </div>
      </div>
    );
  }

  /* ── Registration form ─────────────────────────────────────── */
  return (
    <div className="auth-container">
      <div className="glass-card auth-card" style={{ maxWidth: 460, width: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.75rem', fontWeight: 700 }}>{t.title}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.subtitle}</p>
          </div>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {['en', 'am'].map(l => (
              <button key={l} onClick={() => { setLang(l); localStorage.setItem('preferredLanguage', l); if (l === 'am') { document.cookie = 'googtrans=/en/am; path=/'; document.cookie = 'googtrans=/en/am; path=/; domain=' + window.location.hostname; } else { document.cookie = 'googtrans=/en/en; path=/'; document.cookie = 'googtrans=/en/en; path=/; domain=' + window.location.hostname; } window.location.reload(); }}
                style={{ padding: '4px 10px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem',
                  background: lang === l ? 'var(--primary)' : 'var(--surface)',
                  color:      lang === l ? 'white' : 'var(--text-muted)' }}>
                {l === 'en' ? 'EN' : 'አማ'}
              </button>
            ))}
          </div>
        </div>

        {/* Info note about owner/admin */}
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8,
          padding: '9px 14px', marginBottom: 18, fontSize: '0.79rem', color: '#15803d',
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span>ℹ️</span>
          <span>{t.roleNote}</span>
        </div>

        {globalError && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8,
            padding: '10px 14px', marginBottom: '1rem', color: '#b91c1c', fontSize: '0.875rem', fontWeight: 500 }}>
            ❌ {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <FormField label={t.nameLabel} name="name" type="text" value={values.name}
            onChange={handleChange} onBlur={handleBlur}
            error={errors.name} touched={touched.name}
            placeholder={isAm ? 'ሙሉ ስምዎን ያስፈልጋል' : 'Your full name'} required autoFocus />

          <FormField label={t.emailLabel} name="email" type="email" value={values.email}
            onChange={handleChange} onBlur={handleBlur}
            error={errors.email} touched={touched.email}
            placeholder="you@example.com" required />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label={t.phoneLabel} name="phone" type="tel" value={values.phone}
              onChange={handleChange} onBlur={handleBlur}
              error="" touched={false} placeholder="+251 9xx xxx xxx" />
            <FormField label={t.addressLabel} name="address" type="text" value={values.address}
              onChange={handleChange} onBlur={handleBlur}
              error="" touched={false} placeholder={isAm ? 'ከተማ' : 'City / Area'} />
          </div>

          <FormField label={t.passwordLabel} name="password" type="password" value={values.password}
            onChange={handleChange} onBlur={handleBlur}
            error={errors.password} touched={touched.password}
            showStrength language={lang} hint={t.passwordHint} required />

          <FormField label={t.confirmPasswordLabel} name="confirmPassword" type="password" value={values.confirmPassword}
            onChange={handleChange} onBlur={handleBlur}
            error={errors.confirmPassword} touched={touched.confirmPassword} required />

          {/* Role selector */}
          <div className="fv-group">
            <label className="fv-label">{t.roleLabel} <span className="fv-required">*</span></label>
            <div style={{ position: 'relative' }}>
              <select name="requestedRole" value={values.requestedRole} onChange={handleChange}
                style={{
                  width: '100%', padding: '10px 38px 10px 14px', borderRadius: 8,
                  border: '1.5px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text-main)', fontSize: '0.95rem', appearance: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(21,128,61,0.15)'; }}
                onBlur={e  => { e.target.style.borderColor = 'var(--border)';  e.target.style.boxShadow = 'none'; }}>
                {SELF_REGISTER_ROLES.map(r => (
                  <option key={r.value} value={r.value}>
                    {r.icon} {isAm ? r.label_am : r.label_en}
                  </option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                pointerEvents: 'none', color: 'var(--text-muted)', fontSize: '0.75rem' }}>▼</span>
            </div>
          </div>

          <button type="submit" className="btn btn-primary"
            style={{ width: '100%', padding: 12, fontSize: '1rem', marginTop: 4, opacity: submitting ? 0.7 : 1 }}
            disabled={submitting}>
            {submitting ? t.registering : t.registerButton}
          </button>
        </form>

        <p className="text-center mt-4" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {t.alreadyHaveAccount}{' '}
          <Link to="/login" style={{ fontWeight: 600 }}>{t.loginHere}</Link>
        </p>
      </div>
    </div>
  );
}
