import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import FormField from '../components/FormField';
import { validators } from '../utils/validation';
import { API_URL } from '../config/api';
const T = {
  en: {
    title: 'Create Account', subtitle: 'Join SmartIrrigate OS',
    nameLabel: 'Full Name', emailLabel: 'Email Address',
    passwordLabel: 'Password', confirmPasswordLabel: 'Confirm Password',
    roleLabel: 'Account Role',
    registerButton: 'Create Account', registering: 'Creating account...',
    alreadyHaveAccount: 'Already have an account?', loginHere: 'Sign in',
    registrationFailed: 'Registration failed. Please try again.',
    successMessage: '✅ Account created! Redirecting to login...',
    nameRequired: 'Full name is required',
    nameTooShort: 'Name must be at least 2 characters',
    nameTooLong: 'Name must be under 50 characters',
    nameInvalidChars: 'Name can only contain letters, spaces, hyphens and apostrophes',
    emailRequired: 'Email address is required',
    invalidEmail: 'Enter a valid email address (e.g. user@example.com)',
    passwordRequired: 'Password is required',
    passwordMinLength: 'Password must be at least 8 characters',
    passwordLowercase: 'Add at least one lowercase letter (a-z)',
    passwordUppercase: 'Add at least one uppercase letter (A-Z)',
    passwordNumber: 'Add at least one number (0-9)',
    confirmPasswordRequired: 'Please confirm your password',
    passwordsMustMatch: 'Passwords do not match',
    passwordHint: 'Min 8 chars · uppercase · lowercase · number',
  },
  am: {
    title: 'መለያ ፍጠር', subtitle: 'SmartIrrigate OS ይቀላቀሉ',
    nameLabel: 'ሙሉ ስም', emailLabel: 'ኢሜይል አድራሻ',
    passwordLabel: 'የይለፍ ቃል', confirmPasswordLabel: 'የይለፍ ቃል አረጋግጥ',
    roleLabel: 'የመለያ ሚና',
    registerButton: 'መለያ ፍጠር', registering: 'መለያ በመፍጠር ላይ...',
    alreadyHaveAccount: 'ቀድሞውኑ መለያ አለህ?', loginHere: 'ይግቡ',
    registrationFailed: 'ምዝገባ አልተሳካም። እባክዎ እንደገና ይሞክሩ።',
    successMessage: '✅ መለያ ተፈጥሯል! ወደ መግቢያ በማዞር ላይ...',
    nameRequired: 'ሙሉ ስም ያስፈልጋል',
    nameTooShort: 'ስም ቢያንስ 2 ቁምፊዎች መሆን አለበት',
    nameTooLong: 'ስም ከ50 ቁምፊዎች በታች መሆን አለበት',
    nameInvalidChars: 'ስም ፊደሎችን፣ ክፍተቶችን፣ ሰረዞችን ወይም አፖስትሮፊዎችን ብቻ ሊይዝ ይችላል',
    emailRequired: 'ኢሜይል አድራሻ ያስፈልጋል',
    invalidEmail: 'ትክክለኛ ኢሜይል አድራሻ ያስፈልጋል (ለምሳሌ: user@example.com)',
    passwordRequired: 'የይለፍ ቃል ያስፈልጋል',
    passwordMinLength: 'የይለፍ ቃል ቢያንስ 8 ቁምፊዎች መሆን አለበት',
    passwordLowercase: 'ቢያንስ አንድ ትንሽ ፊደል (a-z) ያክሉ',
    passwordUppercase: 'ቢያንስ አንድ ትልቅ ፊደል (A-Z) ያክሉ',
    passwordNumber: 'ቢያንስ አንድ ቁጥር (0-9) ያክሉ',
    confirmPasswordRequired: 'እባክዎ የይለፍ ቃልዎን ያረጋግጡ',
    passwordsMustMatch: 'የይለፍ ቃሎቹ አይዛመዱም',
    passwordHint: 'ቢያንስ 8 ቁምፊዎች · ትልቅ ፊደል · ትንሽ ፊደል · ቁጥር',
  }
};

const INIT = { name: '', email: '', password: '', confirmPassword: '', role: 'super_administrator' };

const Register = () => {
  const [lang, setLang]         = useState(localStorage.getItem('preferredLanguage') || 'en');
  const [values, setValues]     = useState(INIT);
  const [touched, setTouched]   = useState({});
  const [globalError, setGlobal] = useState('');
  const [success, setSuccess]   = useState('');
  const [submitting, setSub]    = useState(false);
  const navigate = useNavigate();

  const t   = T[lang] || T.en;
  const isAm = lang === 'am';

  // Live errors
  const errors = {
    name:            validators.name(values.name, t),
    email:           validators.email(values.email, t),
    password:        validators.password(values.password, t),
    confirmPassword: validators.confirmPassword(values.confirmPassword, values.password, t),
  };
  const formValid = Object.values(errors).every(e => e === '');

  const handleChange = e => {
    const { name, value } = e.target;
    setValues(prev => ({ ...prev, [name]: value }));
  };
  const handleBlur = e => {
    setTouched(prev => ({ ...prev, [e.target.name]: true }));
  };
  const touchAll = () =>
    setTouched({ name: true, email: true, password: true, confirmPassword: true });

  const handleSubmit = async e => {
    e.preventDefault();
    touchAll();
    if (!formValid) return;
    setSub(true);
    setGlobal('');
    try {
      await axios.post(`${API_URL}/api/auth/register`, {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        role: values.role,
        language: lang,
      });
      setSuccess(t.successMessage);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setGlobal(err.response?.data?.error || t.registrationFailed);
    } finally {
      setSub(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-card auth-card" style={{ maxWidth: 440, width: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.75rem', fontWeight: 700 }}>{t.title}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.subtitle}</p>
          </div>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {['en','am'].map(l => (
              <button key={l} onClick={() => { setLang(l); localStorage.setItem('preferredLanguage', l); }}
                style={{ padding: '4px 10px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem',
                  background: lang === l ? 'var(--primary)' : 'var(--surface)',
                  color: lang === l ? 'white' : 'var(--text-muted)' }}>
                {l === 'en' ? 'EN' : 'አማ'}
              </button>
            ))}
          </div>
        </div>

        {/* Global messages */}
        {globalError && (
          <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, padding:'10px 14px', marginBottom:'1rem', color:'#b91c1c', fontSize:'0.875rem', fontWeight:500 }}>
            ❌ {globalError}
          </div>
        )}
        {success && (
          <div style={{ background:'#ecfdf5', border:'1px solid #a7f3d0', borderRadius:8, padding:'10px 14px', marginBottom:'1rem', color:'#047857', fontSize:'0.875rem', fontWeight:500 }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <FormField label={t.nameLabel} name="name" type="text" value={values.name}
            onChange={handleChange} onBlur={handleBlur}
            error={errors.name} touched={touched.name}
            placeholder={isAm ? 'ሙሉ ስምዎን ያስፈልጋል' : 'Your full name'}
            required autoFocus />

          <FormField label={t.emailLabel} name="email" type="email" value={values.email}
            onChange={handleChange} onBlur={handleBlur}
            error={errors.email} touched={touched.email}
            placeholder="you@example.com" required />

          <FormField label={t.passwordLabel} name="password" type="password" value={values.password}
            onChange={handleChange} onBlur={handleBlur}
            error={errors.password} touched={touched.password}
            showStrength language={lang}
            hint={t.passwordHint} required />

          <FormField label={t.confirmPasswordLabel} name="confirmPassword" type="password" value={values.confirmPassword}
            onChange={handleChange} onBlur={handleBlur}
            error={errors.confirmPassword} touched={touched.confirmPassword}
            required />

          {/* ── Role dropdown ───────────────────────────────── */}
          <div className="fv-group">
            <label className="fv-label">
              {t.roleLabel} <span className="fv-required">*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <select
                name="role"
                value={values.role}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '10px 38px 10px 14px',
                  borderRadius: 8,
                  border: '1.5px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-main)',
                  fontSize: '0.95rem',
                  appearance: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(21,128,61,0.15)'; }}
                onBlur={e  => { e.target.style.borderColor = 'var(--border)';  e.target.style.boxShadow = 'none'; }}
              >
                <option value="super_administrator">{isAm ? '🛡️ ሱፐር አስተዳዳሪ' : '🛡️ Super Administrator'}</option>
                <option value="office_manager">     {isAm ? '💼 ቢሮ አስተዳዳሪ'   : '💼 Office Manager'      }</option>
                <option value="farmer">             {isAm ? '🌾 አርሶ አደር'       : '🌾 Farmer'              }</option>
                <option value="labor">              {isAm ? '👷 ሠራተኛ'          : '👷 Labour Worker'       }</option>
              </select>
              <span style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none', color: 'var(--text-muted)', fontSize: '0.75rem',
              }}>▼</span>
            </div>
          </div>

          <button type="submit"
            className="btn btn-primary"
            style={{ width:'100%', padding:'12px', fontSize:'1rem', marginTop:4, opacity: submitting ? 0.7 : 1 }}
            disabled={submitting}>
            {submitting ? t.registering : t.registerButton}
          </button>
        </form>

        <p className="text-center mt-4" style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>
          {t.alreadyHaveAccount} <Link to="/login" style={{ fontWeight:600 }}>{t.loginHere}</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;

