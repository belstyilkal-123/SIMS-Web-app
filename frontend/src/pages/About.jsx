import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const T = {
  en: {
    title: 'About SmartIrrigate OS',
    subtitle: 'v2.4.1 · Built for precision agriculture',
    description: 'SmartIrrigate OS is an IoT-powered irrigation management platform built for modern Ethiopian agriculture. It connects physical ESP8266 hardware sensors directly to a cloud dashboard, enabling real-time soil monitoring, automated pump control, and satellite-view farm management.',
    featuresTitle: 'Platform Capabilities',
    stackTitle: 'Technology Stack',
    features: [
      { icon: '🌱', text: 'Live soil moisture, pH, temperature & water level monitoring' },
      { icon: '💧', text: 'True Blue action controls — manual and automated pump scheduling' },
      { icon: '🛰️', text: 'Satellite GIS map overlay with live device pins per farm zone' },
      { icon: '📡', text: 'ESP8266 heartbeat system — devices auto-mark offline after 30s' },
      { icon: '🌐', text: 'Full bilingual support — English and Amharic across all screens' },
      { icon: '🔐', text: 'JWT authentication with secure password reset flow' },
      { icon: '📈', text: '30-day trend charts and exportable irrigation logs' },
      { icon: '⚡', text: 'Real-time WebSocket updates — zero page refresh needed' },
    ],
    stack: [
      { layer: 'Frontend', tech: 'React 19 + Vite + Recharts + Leaflet' },
      { layer: 'Backend',  tech: 'Node.js + Express 5 + Socket.IO' },
      { layer: 'Database', tech: 'MongoDB + Mongoose 9' },
      { layer: 'Hardware', tech: 'ESP8266 NodeMCU + DHT11 + Soil Moisture Sensor' },
    ]
  },
  am: {
    title: 'ስለ SmartIrrigate OS',
    subtitle: 'v2.4.1 · ለዘመናዊ ግብርና የተሰራ',
    description: 'SmartIrrigate OS ለዘመናዊ የኢትዮጵያ ግብርና የተሰራ IoT-ተሞልቶ የመስኖ አስተዳደር መድረክ ነው። ሊፊዚካዊ ESP8266 ሃርድዌር ሴንሰሮችን ቀጥታ ወደ ክላውድ ዳሽቦርድ ያገናኛል፣ ቅጽበታዊ የአፈር ክትትልን፣ ራስ-ሰር የፓምፕ ቁጥጥርን እና ሳተላይት-ቪው የእርሻ አስተዳደርን ያስቻላል።',
    featuresTitle: 'የስርዓቱ ችሎታዎች',
    stackTitle: 'የቴክኖሎጂ ቁሶች',
    features: [
      { icon: '🌱', text: 'ቅጽበታዊ የአፈር እርጥበት፣ pH፣ ሙቀት እና የውሃ ደረጃ ክትትል' },
      { icon: '💧', text: 'ሰማያዊ የቁጥጥር ቁልፎች — በእጅ እና ራስ-ሰር ፓምፕ ጅምር' },
      { icon: '🛰️', text: 'ሳተላይት GIS ካርታ ከቀጥታ የመሣሪያ ፒኖች ጋር' },
      { icon: '📡', text: 'ESP8266 የልብ ምት ስርዓት — መሣሪያዎች ከ30 ሰ. ኦፍላይን ይሆናሉ' },
      { icon: '🌐', text: 'ሙሉ ባለሁለት ቋንቋ ድጋፍ — እንግሊዝኛ እና አማርኛ' },
      { icon: '🔐', text: 'JWT ማረጋገጫ ከደህንነቱ የተጠበቀ የይለፍ ቃል ዳግም ማስጀመሪያ' },
      { icon: '📈', text: 'የ30 ቀናት አዝማሚያ ቻርቶች እና የሚላኩ ምዝገቦች' },
      { icon: '⚡', text: 'ቅጽበታዊ WebSocket ዝመናዎች — ምንም የገጽ ዳግም ጫናን አይፈልግም' },
    ],
    stack: [
      { layer: 'የፊት ቅጽ',  tech: 'React 19 + Vite + Recharts + Leaflet' },
      { layer: 'የኋላ ቅጽ',  tech: 'Node.js + Express 5 + Socket.IO' },
      { layer: 'ዳታቤዝ',    tech: 'MongoDB + Mongoose 9' },
      { layer: 'ሃርድዌር',   tech: 'ESP8266 NodeMCU + DHT11 + Soil Moisture Sensor' },
    ]
  }
};

const About = () => {
  const { user } = useContext(AuthContext);
  const isAm = user?.language === 'am';
  const t = T[isAm ? 'am' : 'en'];

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Header card */}
      <div style={{ background: 'linear-gradient(135deg,#15803d,#166534)', borderRadius: 14,
        padding: '28px 32px', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg width="44" height="56" viewBox="0 0 40 50" fill="none">
            <path d="M20 2C20 2 4 22 4 33C4 42.4 11.2 48 20 48C28.8 48 36 42.4 36 33C36 22 20 2 20 2Z"
              fill="url(#ag)"/>
            <ellipse cx="14" cy="30" rx="4" ry="6" fill="rgba(255,255,255,0.35)" transform="rotate(-20 14 30)"/>
            <defs>
              <linearGradient id="ag" x1="4" y1="2" x2="36" y2="48">
                <stop offset="0%" stopColor="#86efac"/>
                <stop offset="100%" stopColor="#dcfce7"/>
              </linearGradient>
            </defs>
          </svg>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>{t.title}</h1>
            <p style={{ margin: '4px 0 0', opacity: 0.75, fontSize: '0.82rem' }}>{t.subtitle}</p>
          </div>
        </div>
        <p style={{ marginTop: 18, lineHeight: 1.7, opacity: 0.9, fontSize: '0.9rem', maxWidth: 620 }}>
          {t.description}
        </p>
      </div>

      {/* Features */}
      <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)', padding: '24px 28px' }}>
        <h3 style={{ margin: '0 0 18px', fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{t.featuresTitle}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {t.features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 14px', background: 'var(--surface-hover)', borderRadius: 10 }}>
              <span style={{ fontSize: '1.15rem', flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.5 }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stack */}
      <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)', padding: '24px 28px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{t.stackTitle}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {t.stack.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16,
              padding: '10px 16px', background: 'var(--surface-hover)', borderRadius: 8 }}>
              <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#15803d',
                minWidth: 80, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.layer}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontFamily: 'monospace' }}>{s.tech}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default About;
