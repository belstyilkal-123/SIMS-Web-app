import React, { useState, useContext } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ROLE_HOME = {
  owner:          '/owner/dashboard',
  admin:          '/admin/dashboard',
  office_manager: '/office/overview',
  farmer:         '/dashboard',
  labor:          '/labour/dashboard',
};

const T = {
  en: {
    badge: 'Smart Farming Technology',
    title: 'SmartIrrigate OS',
    subtitle: 'Monitor soil moisture, automate irrigation zones, and manage your entire farm — from any device, anywhere in the world.',
    login: 'Sign In',
    register: 'Get Started Free',
    feature1Title: 'Real-Time Monitoring',
    feature1Desc: 'Live soil moisture, pH, temperature and water tank levels from ESP8266 sensors.',
    feature2Title: 'Auto Irrigation',
    feature2Desc: 'Set moisture thresholds and let the system trigger your water pumps automatically.',
    feature3Title: 'Satellite Maps',
    feature3Desc: 'View your farm zones on live satellite imagery with device status pins.',
    stat1: 'Uptime', stat2: 'Sensor Types', stat3: 'Languages',
  },
  am: {
    badge: 'ዘመናዊ የእርሻ ቴክኖሎጂ',
    title: 'SmartIrrigate OS',
    subtitle: 'የአፈር እርጥበት ይከታተሉ፣ የመስኖ ዞኖችን ራስ-ሰር ያድርጉ፣ እና መላ እርሻዎን ያስተዳድሩ — ከማንኛውም መሳሪያ፣ ከዓለም ማናቸውም ቦታ።',
    login: 'ይግቡ',
    register: 'ይጀምሩ',
    feature1Title: 'ቅጽበታዊ ክትትል',
    feature1Desc: 'ከESP8266 ሴንሰሮች የህያው የአፈር እርጥበት፣ pH፣ ሙቀት እና የውሃ ታንክ ደረጃዎች።',
    feature2Title: 'ራስ-ሰር መስኖ',
    feature2Desc: 'የእርጥበት ወሰን ያስቀምጡ እና ስርዓቱ የውሃ ፓምፖቻቸዎን ራስ-ሰር ያበራ።',
    feature3Title: 'ሳተላይት ካርታዎች',
    feature3Desc: 'የእርሻ ዞኖቻቸዎን በህያው ሳተላይት ምስሎች ላይ ከመሣሪያ ሁኔታ ፒኖች ጋር ይመልከቱ።',
    stat1: 'ሥራ ጊዜ', stat2: 'ሴንሰር ዓይነቶች', stat3: 'ቋንቋዎች',
  }
};

const features = [
  { icon: '🌱', key: 'feature1', color: '#dcfce7', iconBg: '#15803d' },
  { icon: '💧', key: 'feature2', color: '#dbeafe', iconBg: '#2563eb' },
  { icon: '🛰️', key: 'feature3', color: '#fef3c7', iconBg: '#d97706' },
];

const Home = () => {
  const { user, loading } = useContext(AuthContext);
  const [lang, setLang] = useState(localStorage.getItem('preferredLanguage') || 'en');
  const t = T[lang] || T.en;

  const changeLang = (l) => { setLang(l); localStorage.setItem('preferredLanguage', l); if (l === 'am') { document.cookie = 'googtrans=/en/am; path=/'; document.cookie = 'googtrans=/en/am; path=/; domain=' + window.location.hostname; } else { document.cookie = 'googtrans=/en/en; path=/'; document.cookie = 'googtrans=/en/en; path=/; domain=' + window.location.hostname; } window.location.reload(); };

  // ── Auto-redirect logged-in users to their dashboard ─────────────────────
  if (!loading && user) {
    const role = user.assignedRole || user.role;
    const dest = ROLE_HOME[role] || '/dashboard';
    return <Navigate to={dest} replace />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `
        linear-gradient(160deg, rgba(8,32,14,0.82) 0%, rgba(12,50,22,0.70) 45%, rgba(8,28,14,0.85) 100%),
        url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1600&q=80&fit=crop')
      `,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>

      {/* ── Top nav bar ─────────────────────────── */}
      <nav style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 40px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="30" height="38" viewBox="0 0 40 50" fill="none">
            <path d="M20 2C20 2 4 22 4 33C4 42.4 11.2 48 20 48C28.8 48 36 42.4 36 33C36 22 20 2 20 2Z"
              fill="url(#hg)"/>
            <ellipse cx="14" cy="30" rx="4" ry="6" fill="rgba(255,255,255,0.3)" transform="rotate(-20 14 30)"/>
            <defs>
              <linearGradient id="hg" x1="4" y1="2" x2="36" y2="48">
                <stop offset="0%" stopColor="#34d399"/>
                <stop offset="100%" stopColor="#059669"/>
              </linearGradient>
            </defs>
          </svg>
          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#a3e8c6', letterSpacing: '-0.01em' }}>
            SmartIrrigate
          </span>
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Language toggle */}
          <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, overflow: 'hidden' }}>
            {['en','am'].map(l => (
              <button key={l} onClick={() => changeLang(l)}
                style={{
                  padding: '5px 11px', border: 'none', cursor: 'pointer',
                  fontWeight: 600, fontSize: '0.75rem',
                  background: lang === l ? 'rgba(21,128,61,0.9)' : 'transparent',
                  color: lang === l ? 'white' : 'rgba(255,255,255,0.65)',
                  transition: 'all 0.2s',
                }}>
                {l === 'en' ? 'EN' : 'አማ'}
              </button>
            ))}
          </div>
          <Link to="/login" style={{
            padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem',
            color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.25)',
            textDecoration: 'none', backdropFilter: 'blur(4px)', transition: 'all 0.2s',
          }}>
            {t.login}
          </Link>
        </div>
      </nav>

      {/* ── Hero section ───────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px 40px', textAlign: 'center',
      }}>

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '5px 16px', borderRadius: 20, marginBottom: 28,
          background: 'rgba(21,128,61,0.25)', border: '1px solid rgba(21,128,61,0.5)',
          color: '#6ee7b7', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
          {t.badge}
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(2.8rem, 6vw, 5rem)', fontWeight: 900,
          color: '#ffffff', lineHeight: 1.08, marginBottom: 22,
          textShadow: '0 2px 24px rgba(0,0,0,0.4)', letterSpacing: '-0.02em',
        }}>
          {t.title}
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'rgba(255,255,255,0.72)',
          maxWidth: 580, lineHeight: 1.7, marginBottom: 40,
        }}>
          {t.subtitle}
        </p>

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/register" style={{
            padding: '14px 36px', borderRadius: 10, fontWeight: 700, fontSize: '1rem',
            background: 'linear-gradient(135deg,#15803d,#166534)',
            color: 'white', textDecoration: 'none',
            boxShadow: '0 4px 24px rgba(21,128,61,0.45)',
            transition: 'all 0.2s',
          }}>
            {t.register} →
          </Link>
          <Link to="/login" style={{
            padding: '14px 32px', borderRadius: 10, fontWeight: 600, fontSize: '1rem',
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: 'white', textDecoration: 'none',
            backdropFilter: 'blur(8px)', transition: 'all 0.2s',
          }}>
            {t.login}
          </Link>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex', gap: 40, marginTop: 56,
          padding: '18px 40px', borderRadius: 14,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(10px)',
          flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {[['99.9%', t.stat1], ['5', t.stat2], ['2', t.stat3]].map(([val, lbl]) => (
            <div key={lbl} style={{ textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#6ee7b7' }}>{val}</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginTop: 3, fontWeight: 500 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feature cards row ──────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
        gap: 16, padding: '0 32px 48px', maxWidth: 1000, margin: '0 auto', width: '100%',
      }}>
        {features.map(f => (
          <div key={f.key} style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 14, padding: '22px 24px',
            backdropFilter: 'blur(12px)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: f.iconBg, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '1.3rem',
            }}>
              {f.icon}
            </div>
            <strong style={{ color: '#ffffff', fontSize: '0.95rem' }}>{t[f.key + 'Title']}</strong>
            <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.82rem', lineHeight: 1.55, margin: 0 }}>
              {t[f.key + 'Desc']}
            </p>
          </div>
        ))}
      </div>

      {/* ── Footer watermark ───────────────────── */}
      <div style={{
        textAlign: 'center', padding: '14px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.30)', fontSize: '0.72rem',
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        © {new Date().getFullYear()} AgriSmart Technologies · SmartIrrigate OS v2.4.1
      </div>
    </div>
  );
};

export default Home;
