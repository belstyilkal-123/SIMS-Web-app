import React, { useContext, useEffect, useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../config/api';
import './Layout.css';

/* ──────────────────────────────────────────────────────────────────────────
   ROLE META  –  badge colour, icon, display names
────────────────────────────────────────────────────────────────────────── */
const ROLE_META = {
  super_administrator: { en: 'Super Administrator', am: 'ሱፐር አስተዳዳሪ',    color:'#b91c1c', bg:'#fee2e2', icon:'🛡️' },
  office_manager:      { en: 'Office Manager',      am: 'ቢሮ አስተዳዳሪ',      color:'#7c3aed', bg:'#ede9fe', icon:'💼' },
  farmer:              { en: 'Farmer',              am: 'አርሶ አደር',         color:'#15803d', bg:'#dcfce7', icon:'🌾' },
  labor:               { en: 'Labour Worker',       am: 'ሠራተኛ',            color:'#1d4ed8', bg:'#dbeafe', icon:'👷' },
};

/* ──────────────────────────────────────────────────────────────────────────
   NAVIGATION  –  each group declares which roles can see it
   Items can also have a `roles` override for per-item visibility
────────────────────────────────────────────────────────────────────────── */
const NAV = {
  en: [
    /* ── OVERVIEW ───────────────────────────────────────────────────── */
    {
      groupLabel: 'Overview',
      roles: ['super_administrator','office_manager','farmer','labor'],
      items: [
        { path:'/dashboard',       icon:'📊', label:'Dashboard',      roles:['super_administrator','farmer'] },
        { path:'/office/overview', icon:'📊', label:'Dashboard',      roles:['office_manager'] },
        { path:'/labour/dashboard',icon:'🧑‍🌾',label:'My Dashboard',   roles:['labor'] },
        { path:'/notifications',   icon:'🔔', label:'Notifications',   roles:['super_administrator','office_manager','farmer','labor'] },
      ],
    },

    /* ── FARM OPERATIONS  (Super Admin + Farmer) ─────────────────────── */
    {
      groupLabel: 'Farm Operations',
      roles: ['super_administrator','farmer'],
      items: [
        { path:'/farm-control', icon:'🌾🚰', label:'Farm & Irrigation Management' },
        { path:'/history',      icon:'📈',   label:'Analytics & History' },
      ],
    },

    /* ── DEVICES  (Super Admin + Farmer) ─────────────────────────────── */
    {
      groupLabel: 'Devices & Sensors',
      roles: ['super_administrator','farmer'],
      items: [
        { path:'/devices', icon:'🛠️', label:'Device Management' },
      ],
    },

    /* ── PEOPLE & TASKS  (Super Admin + Office Manager) ──────────────── */
    {
      groupLabel: 'People & Tasks',
      roles: ['super_administrator','office_manager'],
      items: [
        { path:'/activities',       icon:'📋', label:'Assign Activities' },
        { path:'/maintenance',      icon:'🔧', label:'Maintenance Tickets' },
        { path:'/inventory',        icon:'📦', label:'Inventory',            roles:['office_manager'] },
        { path:'/office/attendance',icon:'🗓️', label:'Attendance Overview',  roles:['office_manager'] },
        { path:'/admin/attendance', icon:'🗓️', label:'Attendance Management',roles:['super_administrator'] },
      ],
    },

    /* ── USER MANAGEMENT  (Super Admin only) ─────────────────────────── */
    {
      groupLabel: 'User Management',
      roles: ['super_administrator'],
      items: [
        { path:'/admin/users', icon:'👥', label:'User Accounts' },
      ],
    },

    /* ── PAYROLL & FINANCE  (Super Admin + Office Manager) ───────────── */
    {
      groupLabel: 'Payroll & Finance',
      roles: ['super_administrator','office_manager'],
      items: [
        { path:'/payroll',  icon:'💰', label:'Payroll Management' },
        { path:'/billing',  icon:'🧾', label:'Invoice Management' },
      ],
    },

    /* ── REPORTS  (Super Admin + Farmer + Office Manager) ────────────── */
    {
      groupLabel: 'Reports',
      roles: ['super_administrator','office_manager','farmer'],
      items: [
        { path:'/farmer/reports',   icon:'📑', label:'Farm Reports',          roles:['super_administrator','farmer'] },
        { path:'/farmer/labour',    icon:'👷', label:'Labour Attachments',    roles:['super_administrator','farmer'] },
        { path:'/maintenance/farm', icon:'🔧', label:'Maintenance & Support', roles:['farmer'] },
        { path:'/billing/my',       icon:'🧾', label:'My Bills & Payments',   roles:['farmer'] },
      ],
    },

    /* ── SYSTEM  (Super Admin only) ──────────────────────────────────── */
    {
      groupLabel: 'System',
      roles: ['super_administrator'],
      items: [
        { path:'/inventory',  icon:'📦', label:'Inventory' },
        { path:'/audit-logs', icon:'📝', label:'Audit Logs' },
      ],
    },

    /* ── MY WORK  (Labour only) ──────────────────────────────────────── */
    {
      groupLabel: 'My Work',
      roles: ['labor'],
      items: [
        { path:'/labour/activities',  icon:'📋', label:'My Tasks' },
        { path:'/labour/attendance',  icon:'🗓️', label:'My Attendance' },
        { path:'/maintenance/labour', icon:'🔧', label:'Maintenance' },
      ],
    },

    /* ── MY PAY  (Labour only) ───────────────────────────────────────── */
    {
      groupLabel: 'My Pay',
      roles: ['labor'],
      items: [
        { path:'/labour/payslips', icon:'💵', label:'My Payslips' },
      ],
    },

    /* ── HELP  (All roles) ───────────────────────────────────────────── */
    {
      groupLabel: 'Help & Support',
      roles: ['super_administrator','office_manager','farmer','labor'],
      items: [
        { path:'/about',   icon:'❓', label:'About System' },
        { path:'/contact', icon:'📞', label:'Contact Support' },
      ],
    },
  ],

  am: [
    {
      groupLabel: 'አጠቃላይ',
      roles: ['super_administrator','office_manager','farmer','labor'],
      items: [
        { path:'/dashboard',       icon:'📊', label:'ዳሽቦርድ',         roles:['super_administrator','farmer'] },
        { path:'/office/overview', icon:'📊', label:'ዳሽቦርድ',         roles:['office_manager'] },
        { path:'/labour/dashboard',icon:'🧑‍🌾',label:'ዳሽቦርዴ',        roles:['labor'] },
        { path:'/notifications',   icon:'🔔', label:'ማሳወቂያዎች',      roles:['super_administrator','office_manager','farmer','labor'] },
      ],
    },
    {
      groupLabel: 'የእርሻ ስራዎች',
      roles: ['super_administrator','farmer'],
      items: [
        { path:'/farm-control', icon:'🌾🚰', label:'እርሻ እና የመስኖ አስተዳደር' },
        { path:'/history',      icon:'📈',   label:'ትንታኔ እና ታሪክ' },
      ],
    },
    {
      groupLabel: 'መሣሪያዎች',
      roles: ['super_administrator','farmer'],
      items: [
        { path:'/devices', icon:'🛠️', label:'የመሣሪያ አስተዳደር' },
      ],
    },
    {
      groupLabel: 'ሰዎች እና ተግባሮች',
      roles: ['super_administrator','office_manager'],
      items: [
        { path:'/activities',       icon:'📋', label:'ሥራ ማዛወሪያ' },
        { path:'/maintenance',      icon:'🔧', label:'የጥገና ትኬቶች' },
        { path:'/inventory',        icon:'📦', label:'ክምችት',                  roles:['office_manager'] },
        { path:'/office/attendance',icon:'🗓️', label:'የመገኘት አጠቃላይ',         roles:['office_manager'] },
        { path:'/admin/attendance', icon:'🗓️', label:'የመገኘት አስተዳደር',         roles:['super_administrator'] },
      ],
    },
    {
      groupLabel: 'የተጠቃሚ አስተዳደር',
      roles: ['super_administrator'],
      items: [
        { path:'/admin/users', icon:'👥', label:'የተጠቃሚ ሒሳቦች' },
      ],
    },
    {
      groupLabel: 'ደሞዝ እና ፋይናንስ',
      roles: ['super_administrator','office_manager'],
      items: [
        { path:'/payroll', icon:'💰', label:'የደሞዝ አስተዳደር' },
        { path:'/billing', icon:'🧾', label:'የክፍያ አስተዳደር' },
      ],
    },
    {
      groupLabel: 'ሪፖርቶች',
      roles: ['super_administrator','office_manager','farmer'],
      items: [
        { path:'/farmer/reports',   icon:'📑', label:'የእርሻ ሪፖርቶች',    roles:['super_administrator','farmer'] },
        { path:'/farmer/labour',    icon:'👷', label:'ሠራተኞች',          roles:['super_administrator','farmer'] },
        { path:'/maintenance/farm', icon:'🔧', label:'ጥገና እና ድጋፍ',    roles:['farmer'] },
        { path:'/billing/my',       icon:'🧾', label:'ክፍያዎቼ',           roles:['farmer'] },
      ],
    },
    {
      groupLabel: 'ስርዓት',
      roles: ['super_administrator'],
      items: [
        { path:'/inventory',  icon:'📦', label:'ክምችት' },
        { path:'/audit-logs', icon:'📝', label:'የስርዓት ምዝግብ' },
      ],
    },
    {
      groupLabel: 'ሥራዬ',
      roles: ['labor'],
      items: [
        { path:'/labour/activities',  icon:'📋', label:'ተግባሮቼ' },
        { path:'/labour/attendance',  icon:'🗓️', label:'መገኘቴ' },
        { path:'/maintenance/labour', icon:'🔧', label:'ጥገና' },
      ],
    },
    {
      groupLabel: 'ክፍያዬ',
      roles: ['labor'],
      items: [
        { path:'/labour/payslips', icon:'💵', label:'የደሞዝ ወረቀቶቼ' },
      ],
    },
    {
      groupLabel: 'እርዳታ',
      roles: ['super_administrator','office_manager','farmer','labor'],
      items: [
        { path:'/about',   icon:'❓', label:'ስለ ስርዓቱ' },
        { path:'/contact', icon:'📞', label:'ድጋፍ' },
      ],
    },
  ],
};

/* Bottom items — Profile & Settings always visible, never duplicated in nav */
const BOTTOM = {
  en: { path:'/settings', icon:'⚙️', label:'Profile & Settings' },
  am: { path:'/settings', icon:'⚙️', label:'መገለጫ እና ቅንብሮች' },
};

/* Filter helpers */
const filterItems = (items, role) =>
  items.filter(i => !i.roles || i.roles.includes(role));

const buildNav = (groups, role) =>
  groups
    .filter(g => g.roles.includes(role))
    .map(g => ({ ...g, items: filterItems(g.items, role) }))
    .filter(g => g.items.length > 0);

/* ──────────────────────────────────────────────────────────────────────────
   LAYOUT COMPONENT
────────────────────────────────────────────────────────────────────────── */
const Layout = () => {
  const { user, logout, loading, updateProfile } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [language, setLanguage]                 = useState(user?.language || localStorage.getItem('preferredLanguage') || 'en');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen]           = useState(false);
  const [refreshing, setRefreshing]             = useState(false);

  /* Fetch weather chip */
  useEffect(() => {
    axios.get(`${API_URL}/api/weather?lat=11.5742&lon=37.3614`)
      .then(r => {
        if (!r.data?.unavailable)
          setWeatherChip({
            temp: r.data.temp != null ? `${r.data.temp}°C` : '--',
            emoji: r.data.emoji || '⛅',
            condition: r.data.condition || '',
          });
      }).catch(() => {});
  }, []);

  useEffect(() => { if (user?.language) setLanguage(user.language); }, [user?.language]);
  useEffect(() => { if (!loading && !user) navigate('/login'); }, [user, loading, navigate]);

  /* Close dropdown on outside click */
  useEffect(() => {
    const h = () => setProfileOpen(false);
    if (profileOpen) document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [profileOpen]);

  if (loading) return (
    <div className="si-loading-screen">
      <div className="si-loading-logo">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="#10b981" strokeWidth="4" strokeDasharray="8 4"/>
          <path d="M24 8C24 8 18 18 18 26c0 4.4 2.7 8 6 8s6-3.6 6-8c0-8-6-18-6-18Z" fill="#10b981"/>
        </svg>
      </div>
      <p>Loading SmartIrrigate SIMS…</p>
    </div>
  );
  if (!user) return null;

  const isAm      = language === 'am';
  const role      = user?.role || 'labor';
  const meta      = ROLE_META[role] || ROLE_META.labor;
  const roleLabel = isAm ? meta.am : meta.en;

  const navGroups  = buildNav(isAm ? NAV.am : NAV.en, role);
  const bottomItem = isAm ? BOTTOM.am : BOTTOM.en;

  /* Page title from active route */
  const allItems  = navGroups.flatMap(g => g.items);
  const active    = allItems.find(i => i.path === location.pathname)
                 || (location.pathname === '/settings' ? bottomItem : null);
  const pageTitle = active ? `${active.icon} ${active.label}` : '📊 Dashboard';

  const handleLangChange = async (lang) => {
    setLanguage(lang);
    localStorage.setItem('preferredLanguage', lang);
    try {
      const r = await axios.put(
        `${API_URL}/api/auth/profile`,
        { language: lang },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      updateProfile(r.data);
    } catch {}
  };

  /* Reload the current page data without a full browser refresh */
  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    // Navigate to a blank route then back — forces all useEffect hooks to re-run
    const current = location.pathname;
    navigate('/');
    setTimeout(() => {
      navigate(current);
      setRefreshing(false);
    }, 350);
  };

  return (
    <div className={`si-layout ${sidebarCollapsed ? 'si-collapsed' : ''}`}>

      {/* ── TOP HEADER ──────────────────────────────────────────── */}
      <header className="si-topbar">
        <div className="si-topbar-left">
          <button
            className="si-collapse-btn"
            onClick={() => setSidebarCollapsed(v => !v)}
            title="Toggle sidebar"
            aria-label="Toggle sidebar">
            <span /><span /><span />
          </button>
          <div className="si-brand">
            <svg className="si-brand-icon" viewBox="0 0 40 50" fill="none">
              <path d="M20 2C20 2 4 22 4 33c0 9.4 7.2 15 16 15s16-5.6 16-15c0-11-16-31-16-31Z" fill="url(#dg)"/>
              <ellipse cx="14" cy="30" rx="4" ry="6" fill="rgba(255,255,255,0.35)" transform="rotate(-20 14 30)"/>
              <defs>
                <linearGradient id="dg" x1="4" y1="2" x2="36" y2="48" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#34d399"/>
                  <stop offset="100%" stopColor="#059669"/>
                </linearGradient>
              </defs>
            </svg>
            <div className="si-brand-text">
              <span className="si-brand-name">SmartIrrigate</span>
              <span className="si-brand-sub">SIMS v2.5</span>
            </div>
          </div>
        </div>

        <div className="si-topbar-center">
          <h1 className="si-page-title">{pageTitle}</h1>
        </div>

        <div className="si-topbar-right">
          {/* Alerts link */}
          <Link to="/notifications" className="si-chip si-chip-alert">
            <span>🔔</span>
            <span>{isAm ? 'ማሳወቂያ' : 'Alerts'}</span>
          </Link>

          {/* Refresh button */}
          <button
            className={`si-refresh-btn ${refreshing ? 'spinning' : ''}`}
            onClick={handleRefresh}
            title={isAm ? 'ዳግም ጫን' : 'Refresh page'}
            aria-label="Refresh page"
            style={{ position:'relative' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6"/>
              <path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>

          {/* Language toggle */}
          <div className="si-lang-toggle" role="group" aria-label="Language">
            <button
              className={language === 'en' ? 'active' : ''}
              onClick={() => handleLangChange('en')}
              aria-pressed={language === 'en'}>EN</button>
            <button
              className={language === 'am' ? 'active' : ''}
              onClick={() => handleLangChange('am')}
              aria-pressed={language === 'am'}>አማ</button>
          </div>

          {/* Profile dropdown */}
          <div
            className="si-profile-wrap"
            onClick={e => { e.stopPropagation(); setProfileOpen(v => !v); }}>
            <div className="si-profile-btn">
              <div className="si-avatar">{(user.name || 'U').charAt(0).toUpperCase()}</div>
              <div className="si-profile-info">
                <span className="si-profile-name">{user.name || 'User'}</span>
                <span style={{
                  display:'inline-flex', alignItems:'center', gap:3,
                  fontSize:'0.65rem', fontWeight:700, padding:'1px 7px',
                  borderRadius:20, marginTop:2,
                  background:meta.bg, color:meta.color,
                }}>
                  {meta.icon} {roleLabel}
                </span>
              </div>
              <span className="si-chevron">{profileOpen ? '▲' : '▼'}</span>
            </div>

            {profileOpen && (
              <div className="si-profile-dropdown">
                <Link to="/settings" className="si-dropdown-item">
                  ⚙️ {isAm ? 'ቅንብሮች' : 'Settings'}
                </Link>
                <div className="si-dropdown-divider"/>
                <button className="si-dropdown-item si-dropdown-logout" onClick={logout}>
                  🚪 {isAm ? 'ውጣ' : 'Logout'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── BODY ────────────────────────────────────────────────── */}
      <div className="si-body">

        {/* SIDEBAR */}
        <aside className="si-sidebar">
          <div className="si-sidebar-inner">

            {/* Role context banner */}
            <div className="si-role-banner" style={{ background:meta.bg, borderBottom:`2px solid ${meta.color}22` }}>
              <span style={{ fontSize:'1.1rem' }}>{meta.icon}</span>
              <div>
                <div style={{ fontSize:'0.7rem', fontWeight:700, color:meta.color,
                  textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  {roleLabel}
                </div>
                <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', marginTop:1,
                  maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {user.name}
                </div>
              </div>
            </div>

            {/* Nav groups */}
            <nav className="si-nav" aria-label="Main navigation">
              {navGroups.map(group => (
                <div key={group.groupLabel} className="si-nav-group">
                  <span className="si-nav-group-label">{group.groupLabel}</span>
                  {group.items.map(item => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`si-nav-item ${location.pathname === item.path ? 'active' : ''}`}
                      title={sidebarCollapsed ? item.label : ''}>
                      <span className="si-nav-icon">{item.icon}</span>
                      <span className="si-nav-label">{item.label}</span>
                      {location.pathname === item.path && <span className="si-active-bar"/>}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>

            {/* Bottom: Settings + Logout */}
            <div className="si-sidebar-bottom">
              <Link
                to={bottomItem.path}
                className={`si-nav-item ${location.pathname === bottomItem.path ? 'active' : ''}`}
                title={sidebarCollapsed ? bottomItem.label : ''}>
                <span className="si-nav-icon">{bottomItem.icon}</span>
                <span className="si-nav-label">{bottomItem.label}</span>
                {location.pathname === bottomItem.path && <span className="si-active-bar"/>}
              </Link>
              <button
                className="si-nav-item si-logout-item"
                onClick={logout}
                title={sidebarCollapsed ? (isAm ? 'ውጣ' : 'Logout') : ''}>
                <span className="si-nav-icon">🚪</span>
                <span className="si-nav-label">{isAm ? 'ውጣ' : 'Logout'}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="si-workspace">
          <div className="si-content">
            <Outlet />
          </div>

          {/* FOOTER */}
          <footer className="si-footer-full">
            <div className="si-footer-row">
              <div className="si-footer-contact-inline">
                <span>📧 https://www.bdu.edu.et/ict4d/</span>
                <span>📞 +251 911 901 055</span>
              </div>
              <div className="si-footer-vdivider"/>
              <Link to="/about" className="si-footer-navlink">
                {isAm ? 'ስለ እኛ' : 'About'}
              </Link>
              <div className="si-footer-spacer"/>
              <span className="si-footer-copy">
                © {new Date().getFullYear()} {isAm
                  ? 'ስማርት የመስኖ አስተዳደር ስርዓት (SIMS). መብቱ የተጠበቀ ነው።'
                  : 'Smart Irrigation Management System (SIMS). All Rights Reserved.'}
              </span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default Layout;
