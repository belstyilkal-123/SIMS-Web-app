import React, { useState, useContext } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import FormField from '../components/FormField';
import { validators } from '../utils/validation';
import { API_URL } from '../config/api';

const T = {
  en: {
    title: 'Sign In with Magic Link',
    subtitle: 'Enter your email — we\'ll send you a one-click sign-in link. No password needed.',
    emailLabel: 'Email Address',
    sendButton: 'Send Magic Link',
    sending: 'Sending...',
    backToLogin: 'Back to Login',
    emailRequired: 'Email address is required',
    invalidEmail: 'Enter a valid email address',
    devModeTitle: 'Dev Mode — Magic Link Ready',
    devModeNote: 'SMTP is not configured. Click the button below to sign in directly:',
    devModeBtn: '✨ Click here to sign in',
    devModeCopy: 'Or copy this URL:',
    tryAgain: 'Try a different email',
    successTitle: 'Check your email!',
    successNote: 'A sign-in link has been sent to',
    successSub: 'Click the link in the email to sign in. It expires in 15 minutes.',
    spamNote: '(Check your spam folder if you don\'t see it)',
  },
  am: {
    title: 'በማጂክ ሊንክ ይግቡ',
    subtitle: 'ኢሜይልዎን ያስፈልጋሉ — ምንም የይለፍ ቃል አያስፈልግም። አንድ-ጠቅ ሊንክ እንልክልዎታለን።',
    emailLabel: 'ኢሜይል አድራሻ',
    sendButton: 'ማጂክ ሊንክ ላክ',
    sending: 'በመላክ ላይ...',
    backToLogin: 'ወደ መግቢያ ተመለስ',
    emailRequired: 'ኢሜይል አድራሻ ያስፈልጋል',
    invalidEmail: 'ትክክለኛ ኢሜይል አድራሻ ያስፈልጋል',
    devModeTitle: 'ሙከራ ሁኔታ — ማጂክ ሊንክ ዝግጁ ነው',
    devModeNote: 'SMTP አልተዋቀረም። ቀጥታ ለመግባት ከታች ያለውን ቁልፍ ይጫኑ:',
    devModeBtn: '✨ ለመግባት ይጫኑ',
    devModeCopy: 'ወይም ይህን URL ይቅዱ:',
    tryAgain: 'ሌላ ኢሜይል ሞክር',
    successTitle: 'ኢሜይልዎን ይፈትሹ!',
    successNote: 'ሊንክ ወደዚህ ተልኳል:',
    successSub: 'ኢሜይሉ ውስጥ ያለውን ሊንክ ጠቅ ያድርጉ። ከ15 ደቂቃ በኋላ ያልቃል።',
    spamNote: '(ካላዩት የስፓም ፎልደርዎን ይፈትሹ)',
  }
};

const RequestMagicLink = () => {
  const { user } = useContext(AuthContext);
  const lang = user?.language || localStorage.getItem('preferredLanguage') || 'en';
  const t    = T[lang] || T.en;
  const navigate = useNavigate();

  const [email, setEmail]       = useState('');
  const [touched, setTouched]   = useState(false);
  const [submitting, setSub]    = useState(false);
  const [magicUrl, setMagicUrl] = useState('');   // dev mode direct link
  const [smtpSent, setSmtpSent] = useState(false); // production email sent
  const [error, setError]       = useState('');

  const emailError = validators.email(email, t);
  const showError  = touched && emailError;

  const handleSubmit = async e => {
    e.preventDefault();
    setTouched(true);
    if (emailError) return;

    setSub(true);
    setError('');
    setMagicUrl('');
    setSmtpSent(false);

    try {
      const res = await axios.post(`${API_URL}/api/auth/magic-link/request`, {
        email: email.trim().toLowerCase()
      });

      if (res.data.magicUrl) {
        // Dev mode — show clickable link
        setMagicUrl(res.data.magicUrl);
      } else {
        // Production — email was sent
        setSmtpSent(true);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send magic link. Please try again.');
    } finally {
      setSub(false);
    }
  };

  // Navigate internally using the token from the URL
  const handleDevClick = () => {
    const parts = magicUrl.split('/auth/magic-link/verify');
    if (parts.length === 2) {
      navigate(`/auth/magic-link/verify${parts[1]}`);
    } else {
      window.location.href = magicUrl;
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-card auth-card" style={{ maxWidth: 440, width: '100%' }}>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>✨</div>
          <h2 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.6rem', fontWeight: 700 }}>
            {t.title}
          </h2>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
            {t.subtitle}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8,
            padding: '10px 14px', marginBottom: '1rem', color: '#b91c1c', fontWeight: 500, fontSize: '0.875rem' }}>
            ❌ {error}
          </div>
        )}

        {/* SMTP success panel */}
        {smtpSent && (
          <div style={{ background: '#ecfdf5', border: '2px solid #10b981', borderRadius: 10,
            padding: '22px', textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📬</div>
            <h3 style={{ color: '#15803d', margin: '0 0 8px', fontSize: '1.15rem' }}>{t.successTitle}</h3>
            <p style={{ color: '#374151', fontSize: '0.875rem', margin: '0 0 4px' }}>
              {t.successNote} <strong>{email}</strong>
            </p>
            <p style={{ color: '#374151', fontSize: '0.875rem', margin: '0 0 8px' }}>{t.successSub}</p>
            <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: 0 }}>{t.spamNote}</p>
          </div>
        )}

        {/* Dev mode panel */}
        {magicUrl && (
          <div style={{ background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: 10,
            padding: '18px', marginBottom: '1rem' }}>
            <p style={{ fontWeight: 700, color: '#92400e', marginBottom: 6, fontSize: '0.95rem' }}>
              🛠️ {t.devModeTitle}
            </p>
            <p style={{ color: '#78350f', fontSize: '0.82rem', marginBottom: 14, lineHeight: 1.5 }}>
              {t.devModeNote}
            </p>
            <button onClick={handleDevClick} className="btn btn-primary"
              style={{ width: '100%', padding: '13px', fontSize: '1rem', marginBottom: 14 }}>
              {t.devModeBtn}
            </button>
            <p style={{ color: '#92400e', fontSize: '0.75rem', marginBottom: 5 }}>{t.devModeCopy}</p>
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6,
              padding: '8px 10px', fontSize: '0.72rem', wordBreak: 'break-all',
              color: '#451a03', fontFamily: 'monospace', userSelect: 'all' }}>
              {magicUrl}
            </div>
          </div>
        )}

        {/* Form — hide after success */}
        {!smtpSent && !magicUrl && (
          <form onSubmit={handleSubmit} noValidate>
            <FormField
              label={t.emailLabel} name="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              error={emailError} touched={touched}
              placeholder="you@example.com"
              required autoFocus />

            <button type="submit" className="btn btn-primary"
              style={{ width: '100%', padding: '13px', fontSize: '1rem',
                opacity: submitting ? 0.7 : 1 }}
              disabled={submitting}>
              {submitting ? t.sending : t.sendButton}
            </button>
          </form>
        )}

        {/* Try different email after sending */}
        {(smtpSent || magicUrl) && (
          <button onClick={() => { setSmtpSent(false); setMagicUrl(''); setEmail(''); setTouched(false); }}
            className="btn btn-outline" style={{ width: '100%', marginTop: 12 }}>
            ← {t.tryAgain}
          </button>
        )}

        <p className="text-center mt-4" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          <Link to="/login" style={{ fontWeight: 600 }}>← {t.backToLogin}</Link>
        </p>

      </div>
    </div>
  );
};

export default RequestMagicLink;
