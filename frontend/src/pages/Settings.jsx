import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import FormField from '../components/FormField';
import { validators } from '../utils/validation';
import { API_URL } from '../config/api';

const T = {
  en: {
    pageTitle: 'Profile & Settings',
    successMsg: 'Settings saved successfully!',
    profileSection: '👤 User Profile',
    thresholdsSection: '⚙️ Automation Thresholds',
    localizationSection: '🌐 Language & Locale',
    passwordSection: '🔐 Change Password',
    notifSection: '🔔 Email Notification Preferences',
    name: 'Full Name', email: 'Email Address', role: 'System Role',
    roleFarmer: 'Farmer', roleAdmin: 'System Administrator',
    roleLabor: 'Labour Worker', roleOffice: 'Office Manager',
    lowMoistureLabel: 'Low Moisture Trigger (%)',
    lowMoistureHint: 'Pump turns ON automatically when soil moisture drops below this level.',
    optimalMoistureLabel: 'Optimal Moisture (%)',
    optimalMoistureHint: 'Pump turns OFF automatically when soil moisture reaches this level.',
    languageLabel: 'System Language',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm New Password',
    passwordHint: 'Leave blank to keep current password.',
    notifyEmail: 'Enable email alerts',
    notifyLowMoisture: 'Alert when soil moisture is low',
    notifyTankEmpty: 'Alert when water tank is critically low',
    notifyPumpAuto: 'Alert when auto-irrigation starts/stops',
    saveBtn: 'Save Settings', saving: 'Saving…',
    loading: 'Loading profile…',
    nameRequired: 'Full name is required',
    nameTooShort: 'Name must be at least 2 characters',
    nameTooLong: 'Name must be under 50 characters',
    nameInvalidChars: 'Name can only contain letters, spaces, hyphens and apostrophes',
    emailRequired: 'Email address is required',
    invalidEmail: 'Enter a valid email address',
    required: 'This field is required',
    mustBeNumber: 'Must be a number',
    mustBeBetween: 'Must be between {min} and {max}',
    thresholdConflict: 'Optimal moisture must be higher than low moisture trigger',
    passwordMismatch: 'Passwords do not match',
    passwordTooShort: 'Password must be at least 8 characters',
    smtpNote: 'Email alerts require SMTP to be configured on the server.',
  },
  am: {
    pageTitle: 'መገለጫ እና ቅንብሮች',
    successMsg: 'ቅንብሮች በተሳካ ሁኔታ ተቀምጠዋል!',
    profileSection: '👤 የተጠቃሚ መገለጫ',
    thresholdsSection: '⚙️ የአውቶሜሽን ገደቦች',
    localizationSection: '🌐 ቋንቋ እና አካባቢ',
    passwordSection: '🔐 የይለፍ ቃል ቀይር',
    notifSection: '🔔 የኢሜይል ማሳወቂያ ምርጫዎች',
    name: 'ሙሉ ስም', email: 'ኢሜይል አድራሻ', role: 'የስርዓት ሚና',
    roleFarmer: 'አርሶ አደር', roleAdmin: 'የስርዓት አስተዳዳሪ',
    roleLabor: 'ሠራተኛ', roleOffice: 'ቢሮ አስተዳዳሪ',
    lowMoistureLabel: 'ዝቅተኛ የአፈር እርጥበት ገደብ (%)',
    lowMoistureHint: 'የአፈር እርጥበት ከዚህ ደረጃ በታች ሲቀንስ ፓምፑ ራስ-ሰር ይበራል።',
    optimalMoistureLabel: 'ምርጥ የአፈር እርጥበት (%)',
    optimalMoistureHint: 'የአፈር እርጥበት ከዚህ ደረጃ ሲደርስ ፓምፑ ራስ-ሰር ይጠፋል።',
    languageLabel: 'የስርዓት ቋንቋ',
    currentPassword: 'አሁን ያለ የይለፍ ቃል',
    newPassword: 'አዲስ የይለፍ ቃል',
    confirmPassword: 'አዲሱን የይለፍ ቃል አረጋግጥ',
    passwordHint: 'ሳይቀይሩ ለመቆየት ባዶ ይተዉ።',
    notifyEmail: 'የኢሜይል ማሳወቂያዎችን አነቃ',
    notifyLowMoisture: 'የአፈር እርጥበት ዝቅ ሲል አሳውቅ',
    notifyTankEmpty: 'ታንከር ሲደርቅ አሳውቅ',
    notifyPumpAuto: 'ፓምፕ ሲጀምር/ሲቆም አሳውቅ',
    saveBtn: 'ቅንብሮችን አስቀምጥ', saving: 'በማስቀመጥ ላይ…',
    loading: 'መገለጫ በመጫን ላይ…',
    nameRequired: 'ሙሉ ስም ያስፈልጋል',
    nameTooShort: 'ስም ቢያንስ 2 ቁምፊዎች መሆን አለበት',
    nameTooLong: 'ስም ከ50 ቁምፊዎች በታች መሆን አለበት',
    nameInvalidChars: 'ስም ፊደሎችን ብቻ ሊይዝ ይችላል',
    emailRequired: 'ኢሜይል አድራሻ ያስፈልጋል',
    invalidEmail: 'ትክክለኛ ኢሜይል አድራሻ ያስፈልጋል',
    required: 'ይህ መስክ ያስፈልጋል',
    mustBeNumber: 'ቁጥር መሆን አለበት',
    mustBeBetween: 'ከ{min} እስከ {max} መሆን አለበት',
    thresholdConflict: 'ምርጥ እርጥበት ከዝቅተኛ ገደቡ ከፍ ያለ መሆን አለበት',
    passwordMismatch: 'የይለፍ ቃሎቹ አይዛመዱም',
    passwordTooShort: 'የይለፍ ቃል ቢያንስ 8 ቁምፊዎች መሆን አለበት',
    smtpNote: 'የኢሜይል ማሳወቂያዎች SMTP ቅንብር ይፈልጋሉ።',
  }
};

const ROLE_LABELS = {
  en: { administrator: 'System Administrator', farmer: 'Farmer', labor: 'Labour Worker', office_manager: 'Office Manager' },
  am: { administrator: 'የስርዓት አስተዳዳሪ', farmer: 'አርሶ አደር', labor: 'ሠራተኛ', office_manager: 'ቢሮ አስተዳዳሪ' },
};

export default function Settings() {
  const { user, updateProfile } = useContext(AuthContext);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '', email: '', role: 'farmer',
    lowMoistureThreshold: 30, optimalMoistureThreshold: 70, language: 'en',
    notifyEmail: true, notifyLowMoisture: true,
    notifyTankEmpty: true, notifyPumpAuto: false,
  });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [touched, setTouched]   = useState({});
  const [pwTouched, setPwTouched] = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [banner, setBanner]     = useState({ type: '', text: '' });
  const [pwBanner, setPwBanner] = useState({ type: '', text: '' });

  const isAm = form.language === 'am';
  const t    = T[isAm ? 'am' : 'en'];

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    axios.get(`${API_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${user.token}` },
    }).then(res => {
      const d = res.data;
      setForm({
        name: d.name || '',
        email: d.email || '',
        role: d.role || 'farmer',
        lowMoistureThreshold:    d.lowMoistureThreshold    ?? 30,
        optimalMoistureThreshold: d.optimalMoistureThreshold ?? 70,
        language: d.language || 'en',
        notifyEmail:        d.notifyEmail        ?? true,
        notifyLowMoisture:  d.notifyLowMoisture  ?? true,
        notifyTankEmpty:    d.notifyTankEmpty     ?? true,
        notifyPumpAuto:     d.notifyPumpAuto      ?? false,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, navigate]);

  // ── Profile form validation ────────────────────────────────────────────────
  const errors = {
    name:  validators.name(form.name, t),
    email: validators.email(form.email, t),
    lowMoistureThreshold:    validators.threshold(form.lowMoistureThreshold, 0, 99, t),
    optimalMoistureThreshold: validators.threshold(form.optimalMoistureThreshold, 1, 100, t),
    thresholdRelation: Number(form.optimalMoistureThreshold) <= Number(form.lowMoistureThreshold)
      ? t.thresholdConflict : '',
  };
  const formValid = Object.values(errors).every(e => e === '');

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox'
        ? checked
        : name.endsWith('Threshold') ? (value === '' ? '' : Number(value)) : value,
    }));
  };
  const handleBlur = e => setTouched(prev => ({ ...prev, [e.target.name]: true }));

  const handleSubmit = async e => {
    e.preventDefault();
    setTouched({ name: true, email: true, lowMoistureThreshold: true, optimalMoistureThreshold: true });
    if (!formValid) {
      setBanner({ type: 'error', text: isAm ? 'እባክዎ ስህተቶቹን ያስተካክሉ' : 'Please fix the errors above.' });
      return;
    }
    setSaving(true); setBanner({ type: '', text: '' });
    try {
      const res = await axios.put(`${API_URL}/api/auth/profile`, form, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      updateProfile(res.data);
      setBanner({ type: 'success', text: t.successMsg });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.error || 'Failed to update settings.' });
    } finally { setSaving(false); }
  };

  // ── Password change ────────────────────────────────────────────────────────
  const pwErrors = {
    newPassword:     pwForm.newPassword && pwForm.newPassword.length < 8 ? t.passwordTooShort : '',
    confirmPassword: pwForm.confirmPassword && pwForm.confirmPassword !== pwForm.newPassword ? t.passwordMismatch : '',
  };
  const pwValid = pwForm.newPassword.length >= 8 && pwForm.newPassword === pwForm.confirmPassword;

  const handlePasswordChange = async e => {
    e.preventDefault();
    setPwTouched({ newPassword: true, confirmPassword: true });
    if (!pwValid) return;
    setPwSaving(true); setPwBanner({ type: '', text: '' });
    try {
      await axios.put(`${API_URL}/api/auth/profile`, { password: pwForm.newPassword }, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setPwBanner({ type: 'success', text: isAm ? 'የይለፍ ቃል ተቀይሯል!' : 'Password changed successfully!' });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwTouched({});
    } catch (err) {
      setPwBanner({ type: 'error', text: err.response?.data?.error || 'Failed to change password.' });
    } finally { setPwSaving(false); }
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>{t.loading}</div>
  );

  const Card = ({ children, style }) => (
    <div className="glass-card" style={{ padding: 26, ...style }}>{children}</div>
  );
  const SectionTitle = ({ children }) => (
    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 20, paddingBottom: 10,
      borderBottom: '1px solid var(--border)', color: 'var(--text-main)' }}>
      {children}
    </h3>
  );

  const Toggle = ({ name, label }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
      padding: '8px 0', borderBottom: '1px solid var(--border)', userSelect: 'none' }}>
      <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-main)' }}>{label}</span>
      <span style={{
        position: 'relative', display: 'inline-block',
        width: 42, height: 24, flexShrink: 0,
      }}>
        <input type="checkbox" name={name} checked={!!form[name]}
          onChange={handleChange}
          style={{ opacity: 0, width: 0, height: 0 }} />
        <span style={{
          position: 'absolute', inset: 0, borderRadius: 24,
          background: form[name] ? '#16a34a' : '#cbd5e1',
          transition: 'background 0.2s', cursor: 'pointer',
        }}>
          <span style={{
            position: 'absolute', left: form[name] ? 20 : 3,
            top: 3, width: 18, height: 18, borderRadius: '50%',
            background: 'white', transition: 'left 0.2s',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }} />
        </span>
      </span>
    </label>
  );

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
        {t.pageTitle}
      </h1>

      {/* ── Banner ───────────────────────────────────────────── */}
      {banner.text && (
        <div style={{
          padding: '12px 18px', borderRadius: 8, fontWeight: 500, fontSize: '0.9rem',
          display: 'flex', alignItems: 'center', gap: 10,
          background: banner.type === 'success' ? '#ecfdf5' : '#fee2e2',
          border: `1px solid ${banner.type === 'success' ? '#a7f3d0' : '#fca5a5'}`,
          color: banner.type === 'success' ? '#047857' : '#b91c1c',
        }}>
          {banner.type === 'success' ? '✅' : '❌'} {banner.text}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'contents' }}>

        {/* Profile */}
        <Card>
          <SectionTitle>{t.profileSection}</SectionTitle>
          <FormField label={t.name} name="name" value={form.name}
            onChange={handleChange} onBlur={handleBlur}
            error={errors.name} touched={touched.name} required />
          <FormField label={t.email} name="email" type="email" value={form.email}
            onChange={handleChange} onBlur={handleBlur}
            error={errors.email} touched={touched.email} required />
          {/* Role — display only, no self-elevation */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600,
              fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {t.role}
            </label>
            <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface-hover)', fontSize: '0.9rem', color: 'var(--text-main)' }}>
              {ROLE_LABELS[isAm ? 'am' : 'en'][form.role] || form.role}
            </div>
          </div>
        </Card>

        {/* Thresholds */}
        <Card>
          <SectionTitle>{t.thresholdsSection}</SectionTitle>
          {touched.lowMoistureThreshold && touched.optimalMoistureThreshold && errors.thresholdRelation && (
            <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8,
              padding: '10px 14px', marginBottom: 16, color: '#856404', fontSize: '0.85rem' }}>
              ⚠️ {errors.thresholdRelation}
            </div>
          )}
          <FormField label={t.lowMoistureLabel} name="lowMoistureThreshold" type="number"
            value={form.lowMoistureThreshold} onChange={handleChange} onBlur={handleBlur}
            error={errors.lowMoistureThreshold} touched={touched.lowMoistureThreshold}
            min={0} max={99} hint={t.lowMoistureHint} required />
          <FormField label={t.optimalMoistureLabel} name="optimalMoistureThreshold" type="number"
            value={form.optimalMoistureThreshold} onChange={handleChange} onBlur={handleBlur}
            error={errors.optimalMoistureThreshold} touched={touched.optimalMoistureThreshold}
            min={1} max={100} hint={t.optimalMoistureHint} required />
        </Card>

        {/* Language */}
        <Card>
          <SectionTitle>{t.localizationSection}</SectionTitle>
          <FormField label={t.languageLabel} name="language" value={form.language}
            onChange={handleChange} onBlur={handleBlur} error="" touched={false}>
            <option value="en">English (US)</option>
            <option value="am">አማርኛ (Amharic)</option>
          </FormField>
        </Card>

        {/* Notification preferences */}
        <Card>
          <SectionTitle>{t.notifSection}</SectionTitle>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14, marginTop: -10 }}>
            ℹ️ {t.smtpNote}
          </p>
          <Toggle name="notifyEmail"       label={t.notifyEmail} />
          <Toggle name="notifyLowMoisture" label={t.notifyLowMoisture} />
          <Toggle name="notifyTankEmpty"   label={t.notifyTankEmpty} />
          <Toggle name="notifyPumpAuto"    label={t.notifyPumpAuto} />
        </Card>

        <button type="submit" className="btn btn-primary"
          style={{ padding: 13, fontSize: '1rem', fontWeight: 700, borderRadius: 10,
            opacity: saving ? 0.7 : 1 }}
          disabled={saving}>
          💾 {saving ? t.saving : t.saveBtn}
        </button>
      </form>

      {/* ── Password change (separate form) ──────────────────── */}
      <Card>
        <SectionTitle>{t.passwordSection}</SectionTitle>

        {pwBanner.text && (
          <div style={{
            padding: '11px 16px', borderRadius: 8, fontWeight: 500, fontSize: '0.875rem',
            marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center',
            background: pwBanner.type === 'success' ? '#ecfdf5' : '#fee2e2',
            border: `1px solid ${pwBanner.type === 'success' ? '#a7f3d0' : '#fca5a5'}`,
            color: pwBanner.type === 'success' ? '#047857' : '#b91c1c',
          }}>
            {pwBanner.type === 'success' ? '✅' : '❌'} {pwBanner.text}
          </div>
        )}

        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16, marginTop: -8 }}>
          {t.passwordHint}
        </p>

        <form onSubmit={handlePasswordChange} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { key: 'newPassword',     label: t.newPassword,     err: pwErrors.newPassword },
              { key: 'confirmPassword', label: t.confirmPassword,  err: pwErrors.confirmPassword },
            ].map(({ key, label, err }) => (
              <div key={key}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600,
                  fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {label}
                </label>
                <input
                  type="password"
                  value={pwForm[key]}
                  onChange={e => setPwForm(prev => ({ ...prev, [key]: e.target.value }))}
                  onBlur={() => setPwTouched(prev => ({ ...prev, [key]: true }))}
                  className="form-input"
                  autoComplete={key === 'newPassword' ? 'new-password' : 'new-password'}
                />
                {pwTouched[key] && err && (
                  <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: 4 }}>⚠️ {err}</div>
                )}
              </div>
            ))}
          </div>
          <button type="submit" className="btn btn-primary"
            style={{ marginTop: 18, padding: '11px 28px', fontWeight: 700, opacity: pwSaving ? 0.7 : 1 }}
            disabled={pwSaving}>
            🔐 {pwSaving ? t.saving : (isAm ? 'የይለፍ ቃል ቀይር' : 'Change Password')}
          </button>
        </form>
      </Card>
    </div>
  );
}
