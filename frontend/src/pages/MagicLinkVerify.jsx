import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config/api';

const T = {
  en: {
    verifying: 'Verifying your magic link...',
    successTitle: 'Signed in successfully!',
    successSub: 'Redirecting to your dashboard...',
    expiredTitle: 'Link expired or already used',
    expiredSub: 'Magic links can only be used once and expire after 15 minutes.',
    requestNew: '✨ Request a new magic link',
    loginInstead: 'Sign in with password instead',
    errorTitle: 'Something went wrong',
    retry: 'Try again',
  },
  am: {
    verifying: 'ማጂክ ሊንክዎን በማረጋገጥ ላይ...',
    successTitle: 'በተሳካ ሁኔታ ገብተዋል!',
    successSub: 'ወደ ዳሽቦርድ በማዞር ላይ...',
    expiredTitle: 'ሊንኩ ጊዜው አልፏል ወይም ቀድሞ ጥቅም ላይ ውሏል',
    expiredSub: 'ማጂክ ሊንኮች አንድ ጊዜ ብቻ ጥቅም ላይ ሊውሉ ይችላሉ እና ከ15 ደቂቃ በኋላ ያልቃሉ።',
    requestNew: '✨ አዲስ ማጂክ ሊንክ ጠይቅ',
    loginInstead: 'በይለፍ ቃል ይግቡ',
    errorTitle: 'ችግር ተፈጥሯል',
    retry: 'እንደገና ይሞክሩ',
  }
};

const STATUS = { VERIFYING: 'verifying', SUCCESS: 'success', EXPIRED: 'expired', ERROR: 'error' };

const MagicLinkVerify = () => {
  const { updateProfile } = useContext(AuthContext);
  const [params]  = useSearchParams();
  const navigate  = useNavigate();

  const lang = localStorage.getItem('preferredLanguage') || 'en';
  const t    = T[lang] || T.en;

  const [status, setStatus]   = useState(STATUS.VERIFYING);
  const [errMsg, setErrMsg]   = useState('');

  useEffect(() => {
    const token = params.get('token');

    if (!token) {
      setStatus(STATUS.EXPIRED);
      return;
    }

    const verify = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/auth/magic-link/verify`, {
          params: { token }
        });

        const userData = res.data;

        // Store in localStorage + update AuthContext — same as regular login
        localStorage.setItem('userInfo', JSON.stringify(userData));
        if (userData.language) {
          localStorage.setItem('preferredLanguage', userData.language);
        }
        updateProfile(userData);

        setStatus(STATUS.SUCCESS);

        // Redirect to dashboard after short delay
        setTimeout(() => navigate('/dashboard'), 1800);

      } catch (err) {
        const data = err.response?.data;
        if (data?.expired || err.response?.status === 400) {
          setStatus(STATUS.EXPIRED);
        } else {
          setStatus(STATUS.ERROR);
          setErrMsg(data?.error || 'An unexpected error occurred.');
        }
      }
    };

    verify();
  }, []);

  return (
    <div className="auth-container">
      <div className="glass-card auth-card"
        style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>

        {/* ── Verifying ── */}
        {status === STATUS.VERIFYING && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>⏳</div>
            <h2 style={{ color: 'var(--primary)', fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px' }}>
              {t.verifying}
            </h2>
            {/* Animated dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: 'var(--primary)',
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                }}/>
              ))}
            </div>
            <style>{`
              @keyframes bounce {
                0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                40% { transform: scale(1); opacity: 1; }
              }
            `}</style>
          </>
        )}

        {/* ── Success ── */}
        {status === STATUS.SUCCESS && (
          <>
            <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>✅</div>
            <h2 style={{ color: '#15803d', fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px' }}>
              {t.successTitle}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              {t.successSub}
            </p>
            {/* Progress bar */}
            <div style={{ marginTop: 20, height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: 'var(--primary)', borderRadius: 4,
                animation: 'fillBar 1.8s linear forwards'
              }}/>
            </div>
            <style>{`
              @keyframes fillBar {
                from { width: 0%; }
                to   { width: 100%; }
              }
            `}</style>
          </>
        )}

        {/* ── Expired / already used ── */}
        {status === STATUS.EXPIRED && (
          <>
            <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>⏰</div>
            <h2 style={{ color: 'var(--danger)', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 10px' }}>
              {t.expiredTitle}
            </h2>
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8,
              padding: '12px 16px', marginBottom: 24, color: '#7f1d1d',
              fontSize: '0.875rem', lineHeight: 1.6 }}>
              {t.expiredSub}
            </div>
            <Link to="/auth/magic-link" className="btn btn-primary"
              style={{ display: 'block', padding: '13px', marginBottom: 10, fontSize: '0.95rem' }}>
              {t.requestNew}
            </Link>
            <Link to="/login" className="btn btn-outline"
              style={{ display: 'block', padding: '11px', fontSize: '0.9rem' }}>
              ← {t.loginInstead}
            </Link>
          </>
        )}

        {/* ── Generic error ── */}
        {status === STATUS.ERROR && (
          <>
            <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>❌</div>
            <h2 style={{ color: 'var(--danger)', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 10px' }}>
              {t.errorTitle}
            </h2>
            {errMsg && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8,
                padding: '10px 14px', marginBottom: 20, color: '#7f1d1d', fontSize: '0.875rem' }}>
                {errMsg}
              </div>
            )}
            <Link to="/auth/magic-link" className="btn btn-primary"
              style={{ display: 'block', padding: '13px', marginBottom: 10 }}>
              {t.retry}
            </Link>
            <Link to="/login" className="btn btn-outline"
              style={{ display: 'block', padding: '11px' }}>
              ← {t.loginInstead}
            </Link>
          </>
        )}

      </div>
    </div>
  );
};

export default MagicLinkVerify;
