import React, { useState, useContext } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import FormField from '../components/FormField';
import { validators } from '../utils/validation';
import { API_URL } from '../config/api';

const T = {
  en: {
    title: 'Forgot Password', subtitle: 'Enter your email to receive a reset link',
    emailLabel: 'Email Address', sendButton: 'Send Reset Link', sending: 'Sending...',
    remembered: 'Remembered it?', loginHere: 'Back to Login',
    emailRequired: 'Email address is required',
    invalidEmail: 'Enter a valid email address',
    errorMessage: 'Failed to send reset link. Please try again.',
    successMessage: 'If that email is in our system, a reset link has been sent.',
    tryDifferent: 'Try a different email',
  },
  am: {
    title: 'የይለፍ ቃል ረሳህው?', subtitle: 'ዳግም ማስጀመሪያ ሊንክ ለማግኘት ኢሜይልዎን ያስፈልጋል',
    emailLabel: 'ኢሜይል አድራሻ', sendButton: 'ዳግም ማስጀመሪያ ሊንክ ላክ', sending: 'በመላክ ላይ...',
    remembered: 'አስታውሰሃል?', loginHere: 'ወደ መግቢያ ተመለስ',
    emailRequired: 'ኢሜይል አድራሻ ያስፈልጋል',
    invalidEmail: 'ትክክለኛ ኢሜይል አድራሻ ያስፈልጋል',
    errorMessage: 'ዳግም ማስጀመሪያ ሊንክ ማላክ አልተቻለም። እንደገና ይሞክሩ።',
    successMessage: 'ኢሜይሉ በስርዓታችን ውስጥ ካለ፣ ዳግም ማስጀመሪያ ሊንክ ተልኳል።',
    tryDifferent: 'ሌላ ኢሜይል ሞክር',
  }
};

const ForgotPassword = () => {
  const { user } = useContext(AuthContext);
  const lang = user?.language || localStorage.getItem('preferredLanguage') || 'en';
  const t    = T[lang] || T.en;

  const [email, setEmail]       = useState('');
  const [touched, setTouched]   = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError]       = useState('');
  const [submitting, setSub]    = useState(false);

  const emailError = validators.email(email, t);
  const showError  = touched && emailError;

  const handleSubmit = async e => {
    e.preventDefault();
    setTouched(true);
    if (emailError) return;

    setSub(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await axios.post(`${API_URL}/api/auth/forgot-password`, {
        email: email.trim().toLowerCase()
      });
      setSuccessMsg(res.data.message || t.successMessage);
    } catch (err) {
      setError(err.response?.data?.error || t.errorMessage);
    } finally {
      setSub(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-card auth-card" style={{ maxWidth: 430, width: '100%' }}>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.75rem', fontWeight: 700 }}>{t.title}</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.subtitle}</p>
        </div>

        {/* Success */}
        {successMsg && (
          <div style={{ background:'#ecfdf5', border:'1px solid #a7f3d0', borderRadius:8,
            padding:'12px 16px', marginBottom:'1rem', color:'#047857', fontWeight:500, fontSize:'0.875rem' }}>
            ✅ {successMsg}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8,
            padding:'10px 14px', marginBottom:'1rem', color:'#b91c1c', fontWeight:500, fontSize:'0.875rem' }}>
            ❌ {error}
          </div>
        )}

        {/* Form — hide after success message is shown */}
        {!successMsg && (
          <form onSubmit={handleSubmit} noValidate>
            <FormField
              label={t.emailLabel} name="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              error={emailError} touched={touched}
              placeholder="you@example.com" required autoFocus />

            <button type="submit" className="btn btn-primary"
              style={{ width:'100%', padding:'12px', fontSize:'1rem', opacity: submitting ? 0.7 : 1 }}
              disabled={submitting}>
              {submitting ? t.sending : t.sendButton}
            </button>
          </form>
        )}

        {/* Try different email */}
        {successMsg && (
          <button onClick={() => { setSuccessMsg(''); setEmail(''); setTouched(false); }}
            className="btn btn-outline" style={{ width:'100%', marginTop:10 }}>
            ← {t.tryDifferent}
          </button>
        )}

        <p className="text-center mt-4" style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>
          {t.remembered} <Link to="/login" style={{ fontWeight:600 }}>{t.loginHere}</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
