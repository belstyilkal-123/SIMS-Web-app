import React, { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import FormField from '../components/FormField';
import { validators } from '../utils/validation';
import { API_URL } from '../config/api';

const T = {
  en: {
    title: 'Set New Password', subtitle: 'Choose a strong password for your account',
    newPasswordLabel: 'New Password', confirmPasswordLabel: 'Confirm New Password',
    resetButton: 'Set New Password', resetting: 'Saving...',
    loginHere: 'Back to Login', tryAgain: 'Request a new reset link',
    passwordRequired: 'Password is required',
    passwordMinLength: 'Password must be at least 8 characters',
    passwordLowercase: 'Add at least one lowercase letter (a-z)',
    passwordUppercase: 'Add at least one uppercase letter (A-Z)',
    passwordNumber: 'Add at least one number (0-9)',
    confirmPasswordRequired: 'Please confirm your password',
    passwordsMustMatch: 'Passwords do not match',
    passwordHint: 'Min 8 chars · uppercase · lowercase · number',
    successMessage: '✅ Password updated! Redirecting to login...',
    invalidToken: 'Reset link is invalid or expired.',
    invalidTokenHelp: 'Reset links expire after 1 hour and can only be used once.',
    verifying: 'Verifying reset link...',
  },
  am: {
    title: 'አዲስ የይለፍ ቃል ያስጀምሩ', subtitle: 'ለመለያዎ ጠንካራ የይለፍ ቃል ይምረጡ',
    newPasswordLabel: 'አዲስ የይለፍ ቃል', confirmPasswordLabel: 'አዲሱን የይለፍ ቃል ያረጋግጡ',
    resetButton: 'አዲስ የይለፍ ቃል ያስጀምሩ', resetting: 'በማስቀመጥ ላይ...',
    loginHere: 'ወደ መግቢያ ተመለስ', tryAgain: 'አዲስ ዳግም ማስጀመሪያ ሊንክ ጠይቅ',
    passwordRequired: 'የይለፍ ቃል ያስፈልጋል',
    passwordMinLength: 'የይለፍ ቃል ቢያንስ 8 ቁምፊዎች መሆን አለበት',
    passwordLowercase: 'ቢያንስ አንድ ትንሽ ፊደል (a-z) ያክሉ',
    passwordUppercase: 'ቢያንስ አንድ ትልቅ ፊደል (A-Z) ያክሉ',
    passwordNumber: 'ቢያንስ አንድ ቁጥር (0-9) ያክሉ',
    confirmPasswordRequired: 'እባክዎ የይለፍ ቃልዎን ያረጋግጡ',
    passwordsMustMatch: 'የይለፍ ቃሎቹ አይዛመዱም',
    passwordHint: 'ቢያንስ 8 ቁምፊዎች · ትልቅ ፊደል · ትንሽ ፊደል · ቁጥር',
    successMessage: '✅ የይለፍ ቃል ተዘምኗል! ወደ መግቢያ በማዞር ላይ...',
    invalidToken: 'ዳግም ማስጀመሪያ ሊንክ ልክ አይደለም ወይም ጊዜው አልፏል።',
    invalidTokenHelp: 'ዳግም ማስጀመሪያ ሊንኮች ከ1 ሰዓት በኋላ ያልቃሉ እና አንድ ጊዜ ብቻ ጥቅም ላይ ሊውሉ ይችላሉ።',
    verifying: 'ዳግም ማስጀመሪያ ሊንክ በማረጋገጥ ላይ...',
  }
};

const ResetPassword = () => {
  const { user } = useContext(AuthContext);
  const lang = user?.language || localStorage.getItem('preferredLanguage') || 'en';
  const t    = T[lang] || T.en;

  const { token } = useParams();
  const navigate  = useNavigate();

  const [values, setValues]     = useState({ password: '', confirmPassword: '' });
  const [touched, setTouched]   = useState({});
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [submitting, setSub]    = useState(false);
  const [tokenValid, setValid]  = useState(null);

  useEffect(() => {
    if (!token) { setValid(false); return; }
    axios.get(`${API_URL}/api/auth/verify-reset-token/${token}`)
      .then(() => setValid(true))
      .catch(() => setValid(false));
  }, [token]);

  const errors = {
    password:        validators.password(values.password, t),
    confirmPassword: validators.confirmPassword(values.confirmPassword, values.password, t),
  };
  const formValid = errors.password === '' && errors.confirmPassword === '';

  const handleChange = e => setValues(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleBlur   = e => setTouched(prev => ({ ...prev, [e.target.name]: true }));

  const handleSubmit = async e => {
    e.preventDefault();
    setTouched({ password: true, confirmPassword: true });
    if (!formValid) return;
    setSub(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/api/auth/reset-password/${token}`, {
        password: values.password
      });
      setSuccess(res.data.message || t.successMessage);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const msg = err.response?.data?.error || '';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('expired')) {
        setValid(false);
      } else {
        setError(msg || t.passwordMinLength);
      }
    } finally {
      setSub(false);
    }
  };

  /* Verifying */
  if (tokenValid === null) return (
    <div className="auth-container">
      <div className="glass-card auth-card" style={{ textAlign:'center', maxWidth:400 }}>
        <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🔐</div>
        <p style={{ color:'var(--text-muted)', fontSize:'1rem' }}>{t.verifying}</p>
      </div>
    </div>
  );

  /* Expired / invalid */
  if (!tokenValid) return (
    <div className="auth-container">
      <div className="glass-card auth-card" style={{ maxWidth:420, width:'100%' }}>
        <div style={{ textAlign:'center', marginBottom:16 }}>
          <div style={{ fontSize:'3rem' }}>⏰</div>
        </div>
        <h2 style={{ color:'var(--danger)', fontSize:'1.4rem', textAlign:'center', marginBottom:10 }}>
          {t.invalidToken}
        </h2>
        <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, padding:'12px 16px',
          marginBottom:22, color:'#7f1d1d', fontSize:'0.875rem', lineHeight:1.6 }}>
          {t.invalidTokenHelp}
        </div>
        <Link to="/forgot-password" className="btn btn-primary"
          style={{ display:'block', textAlign:'center', marginBottom:10, padding:'12px' }}>
          🔁 {t.tryAgain}
        </Link>
        <Link to="/login" className="btn btn-outline"
          style={{ display:'block', textAlign:'center', padding:'11px' }}>
          ← {t.loginHere}
        </Link>
      </div>
    </div>
  );

  /* Valid form */
  return (
    <div className="auth-container">
      <div className="glass-card auth-card" style={{ maxWidth:430, width:'100%' }}>

        <div style={{ marginBottom:'1.5rem' }}>
          <h2 style={{ margin:0, color:'var(--primary)', fontSize:'1.75rem', fontWeight:700 }}>{t.title}</h2>
          <p style={{ margin:'4px 0 0', color:'var(--text-muted)', fontSize:'0.85rem' }}>{t.subtitle}</p>
        </div>

        {success && (
          <div style={{ background:'#ecfdf5', border:'1px solid #a7f3d0', borderRadius:8,
            padding:'12px 16px', marginBottom:'1rem', color:'#047857', fontWeight:500 }}>
            {success}
          </div>
        )}
        {error && (
          <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8,
            padding:'10px 14px', marginBottom:'1rem', color:'#b91c1c', fontWeight:500, fontSize:'0.875rem' }}>
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <FormField label={t.newPasswordLabel} name="password" type="password" value={values.password}
            onChange={handleChange} onBlur={handleBlur}
            error={errors.password} touched={touched.password}
            showStrength language={lang} hint={t.passwordHint}
            required autoFocus />

          <FormField label={t.confirmPasswordLabel} name="confirmPassword" type="password" value={values.confirmPassword}
            onChange={handleChange} onBlur={handleBlur}
            error={errors.confirmPassword} touched={touched.confirmPassword}
            required />

          <button type="submit" className="btn btn-primary"
            style={{ width:'100%', padding:'12px', fontSize:'1rem', opacity: submitting ? 0.7 : 1 }}
            disabled={submitting}>
            {submitting ? t.resetting : t.resetButton}
          </button>
        </form>

        <p className="text-center mt-4" style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>
          <Link to="/login" style={{ fontWeight:600 }}>← {t.loginHere}</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
