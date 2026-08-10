import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ROLE_META } from '../utils/roles';

const T = {
  en: {
    title: 'Access Denied',
    subtitle: 'You do not have permission to view this page.',
    yourRole: 'Your current role is',
    backBtn: 'Go to Dashboard',
    contactAdmin: 'Contact your administrator if you believe this is an error.',
  },
  am: {
    title: 'መዳረሻ ተከልክሏል',
    subtitle: 'ይህን ገጽ ለማየት ፈቃድ የለዎትም።',
    yourRole: 'የአሁኑ ሚናዎ',
    backBtn: 'ወደ ዳሽቦርድ ተመለስ',
    contactAdmin: 'ይህ ስህተት ነው ብለው ካሰቡ አስተዳዳሪዎን ያነጋግሩ።',
  }
};

const AccessDenied = () => {
  const { user } = useContext(AuthContext);
  const isAm  = user?.language === 'am';
  const t     = isAm ? T.am : T.en;
  const role  = user?.role || 'labor';
  const meta  = ROLE_META[role] || ROLE_META.labor;

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:'70vh', flexDirection:'column', gap:20, textAlign:'center', padding:'0 24px' }}>

      {/* Icon */}
      <div style={{ fontSize:'4rem' }}>🚫</div>

      {/* Title */}
      <h1 style={{ fontSize:'1.8rem', fontWeight:800, color:'var(--danger)', margin:0 }}>
        {t.title}
      </h1>
      <p style={{ color:'var(--text-muted)', fontSize:'1rem', maxWidth:400, margin:0 }}>
        {t.subtitle}
      </p>

      {/* Role badge */}
      <div style={{ display:'flex', alignItems:'center', gap:10,
        padding:'10px 20px', borderRadius:12,
        background: meta.bg, border:`1.5px solid ${meta.color}` }}>
        <span style={{ fontSize:'1.3rem' }}>{meta.icon}</span>
        <div>
          <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{t.yourRole}: </span>
          <strong style={{ color: meta.color, fontSize:'0.95rem' }}>
            {isAm ? meta.label_am : meta.label_en}
          </strong>
        </div>
      </div>

      <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', maxWidth:380 }}>
        {t.contactAdmin}
      </p>

      <Link to="/dashboard" className="btn btn-primary" style={{ padding:'12px 32px', fontSize:'0.95rem' }}>
        ← {t.backBtn}
      </Link>
    </div>
  );
};

export default AccessDenied;
