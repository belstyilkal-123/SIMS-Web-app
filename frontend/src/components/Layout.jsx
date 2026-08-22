import React, { useContext, useEffect, useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import GoogleTranslate from './GoogleTranslate';

import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../config/api';
import './Layout.css';

/* ──────────────────────────────────────────────────────────────────────────
   ROLE META  –  badge colour, icon, display names (5 roles)
────────────────────────────────────────────────────────────────────────── */
const ROLE_META = {
  owner:          { en: 'Investor / Owner', am: 'ባለቤት / ባለሃብት',  color: '#92400e', bg: '#fef3c7', icon: '👑' },
  admin:          { en: 'Administrator',    am: 'አስተዳዳሪ',          color: '#b91c1c', bg: '#fee2e2', icon: '🛡️' },
  office_manager: { en: 'Office Manager',   am: 'ቢሮ አስተዳዳሪ',      color: '#7c3aed', bg: '#ede9fe', icon: '💼' },
  farmer:         { en: 'Farmer',           am: 'አርሶ አደር',         color: '#15803d', bg: '#dcfce7', icon: '🌾' },
  labor:          { en: 'Labour Worker',    am: 'ሠራተኛ',            color: '#1d4ed8', bg: '#dbeafe', icon: '👷' },
};

/* ──────────────────────────────────────────────────────────────────────────
   NAVIGATION  –  5-role matrix (spec §63)
   Each group declares which roles can see it.
   Items can also have a `roles` override for per-item visibility.
────────────────────────────────────────────────────────────────────────── */
const NAV = {
  en: [
    {
      groupLabel: 'Overview',
      roles: ['owner','admin','office_manager','farmer','labor'],
      items: [
        { path:'/owner/dashboard',  icon:'👑', label:'Dashboard',    roles:['owner'] },
        { path:'/admin/dashboard',  icon:'🛡️', label:'Dashboard',      roles:['admin'] },
        { path:'/office/overview',  icon:'📊', label:'Dashboard',            roles:['office_manager'] },
        { path:'/dashboard',        icon:'📊', label:'Dashboard',       roles:['farmer'] },
        { path:'/labour/dashboard', icon:'🧑‍🌾',label:'Dashboard',         roles:['labor'] },
        { path:'/notifications',    icon:'🔔', label:'Notifications',        roles:['owner','admin','office_manager','farmer','labor'] },
      ],
    },
    /* ── OWNER: Business & Finance ──────────────────────────── */
    {
      groupLabel: 'Business',
      roles: ['owner'],
      items: [
        { path:'/expenses',          icon:'✅', label:'Expense Approvals' },
        { path:'/reports/financial', icon:'📊', label:'Finance' },
        { path:'/owner/farms',       icon:'🌾', label:'Farms' },
        { path:'/owner/approvals',   icon:'✅', label:'Labour Approval' },
          { path:'/owner/attendance',  icon:'🗓️', label:'Attendance' },
        { path:'/tasks',             icon:'📋', label:'Tasks' },
          { path:'/farm-assignments',  icon:'🧑‍🌾', label:'Farm Assignments' },
        { path:'/audit-logs',        icon:'📝', label:'Audits' },
      ],
    },
    /* ── ADMIN: System & Security ───────────────────────────── */
    {
      groupLabel: 'System',
      roles: ['admin'],
      items: [
        { path:'/admin/users',      icon:'👥', label:'Users' },
        { path:'/devices',          icon:'🛠️', label:'Devices' },
        { path:'/audit-logs',       icon:'📝', label:'Audits' },
      ],
    },
    /* ── ADMIN: Farm view-only ──────────────────────────────── */
    {
      groupLabel: 'Overview',
      roles: ['admin'],
      items: [
        { path:'/farm-control', icon:'🌾🚰', label:'Farms' },
        { path:'/history',      icon:'📈',   label:'Analytics' },
      ],
    },
    /* ── FARMER: Farm Operations ─────────────────────────────── */
    {
      groupLabel: 'Operations',
      roles: ['farmer'],
      items: [
        { path:'/farm-control', icon:'🌾🚰', label:'Farms' },
        { path:'/history',      icon:'📈',   label:'Analytics' },
      ],
    },
    /* ── OFFICE MANAGER: People & Tasks ─────────────────────── */
    {
      groupLabel: 'People',
      roles: ['office_manager'],
      items: [
        { path:'/tasks',        icon:'📋', label:'Tasks' },
          { path:'/farm-assignments',  icon:'🧑‍🌾', label:'Farm Assignments' },
        { path:'/maintenance',       icon:'🔧', label:'Maintenance' },
        { path:'/office/attendance', icon:'🗓️', label:'Attendance' },
      ],
    },
    /* ── OFFICE MANAGER: Finance ─────────────────────────────── */
    {
      groupLabel: 'Finance',
      roles: ['office_manager'],
      items: [
        { path:'/payroll',            icon:'💰', label:'Payroll' },
        { path:'/expenses',           icon:'💵', label:'Expenses' },
        { path:'/reports/financial',  icon:'📊', label:'Finance' },
      ],
    },
    /* ── FARMER: Reports ─────────────────────────────────────── */
    {
      groupLabel: 'Reports',
      roles: ['farmer'],
      items: [
          { path:'/farmer/reports',   icon:'📑', label:'Reports' },
          { path:'/farmer/labour',    icon:'👷', label:'Labour' },
          { path:'/tasks',            icon:'📋', label:'Tasks' },
          { path:'/maintenance', icon:'🔧', label:'Maintenance' },
          { path:'/farmer/attendance',icon:'🗓️', label:'Attendance' },
        { path:'/expenses',         icon:'💵', label:'Expenses' },
      ],
    },
    /* ── LABOUR: My Work ────────────────────────────────────── */
    {
      groupLabel: 'Work',
      roles: ['labor'],
      items: [
        { path:'/labour/tasks',  icon:'📋', label:'Tasks' },
        { path:'/labour/attendance',  icon:'🗓️', label:'Attendance' },
        { path:'/maintenance', icon:'🔧', label:'Maintenance' },
      ],
    },

    /* ── LABOUR: My Pay ─────────────────────────────────────── */
    {
      groupLabel: 'Pay',
      roles: ['labor'],
      items: [
        { path:'/labour/payslips', icon:'💵', label:'Payslips' },
      ],
    },
    /* ── HELP (All roles) ───────────────────────────────────── */
    {
      groupLabel: 'Support',
      roles: ['owner','admin','office_manager','farmer','labor'],
      items: [
        { path:'/about',   icon:'❓', label:'About' },
        { path:'/contact', icon:'📞', label:'Contact' },
      ],
    },
  ],

  am: [
    {
      groupLabel: 'አጠቃላይ',
      roles: ['owner','admin','office_manager','farmer','labor'],
      items: [
        { path:'/owner/dashboard',  icon:'👑', label:'ዳሽቦርድ',    roles:['owner'] },
        { path:'/admin/dashboard',  icon:'🛡️', label:'ዳሽቦርድ',   roles:['admin'] },
        { path:'/office/overview',  icon:'📊', label:'ዳሽቦርድ',           roles:['office_manager'] },
        { path:'/dashboard',        icon:'📊', label:'ዳሽቦርድ',     roles:['farmer'] },
        { path:'/labour/dashboard', icon:'🧑‍🌾',label:'ዳሽቦርድ',          roles:['labor'] },
        { path:'/notifications',    icon:'🔔', label:'ማሳወቂያዎች',        roles:['owner','admin','office_manager','farmer','labor'] },
      ],
    },
      {
        groupLabel: 'ስራዎች',
        roles: ['owner'],
        items: [
          { path:'/expenses',          icon:'✅', label:'Expense Approvals' },
          { path:'/reports/financial', icon:'📊', label:'ፋይናንስ' },
          { path:'/owner/farms',       icon:'🌾', label:'እርሻ' },
          { path:'/owner/approvals',   icon:'✅', label:'ማረጋገጫዎች' },
            { path:'/owner/attendance',  icon:'🗓️', label:'መገኘት' },
          { path:'/tasks',             icon:'📋', label:'ተግባራት' },
            { path:'/farm-assignments',  icon:'🧑‍🌾', label:'የእርሻ ምደባ' },
          { path:'/maintenance',       icon:'🔧', label:'ጥገና' },
          { path:'/audit-logs',        icon:'📝', label:'ምዝገቦች' },
        ],
      },
    {
      groupLabel: 'ስርዓት',
      roles: ['admin'],
      items: [
        { path:'/admin/users',      icon:'👥', label:'ተጠቃሚዎች' },
        { path:'/devices',          icon:'🛠️', label:'መሣሪያዎች' },
        { path:'/audit-logs',       icon:'📝', label:'ምዝገቦች' },
      ],
    },
    {
      groupLabel: 'አጠቃላይ',
      roles: ['admin'],
      items: [
        { path:'/farm-control', icon:'🌾🚰', label:'እርሻ' },
        { path:'/history',      icon:'📈',   label:'ትንታኔ' },
      ],
    },
    {
      groupLabel: 'ስራዎች',
      roles: ['farmer'],
      items: [
        { path:'/farm-control', icon:'🌾🚰', label:'እርሻ' },
        { path:'/history',      icon:'📈',   label:'ትንታኔ' },
      ],
    },
    {
      groupLabel: 'ሰዎች',
      roles: ['office_manager'],
      items: [
        { path:'/tasks',        icon:'📋', label:'ተግባራት' },
          { path:'/farm-assignments',  icon:'🧑‍🌾', label:'የእርሻ ምደባ' },
        { path:'/maintenance',       icon:'🔧', label:'ጥገና' },
        { path:'/office/attendance', icon:'🗓️', label:'መገኘት' },
      ],
    },
    {
      groupLabel: 'ፋይናንስ',
      roles: ['office_manager'],
      items: [
        { path:'/payroll',            icon:'💰', label:'ደሞዝ' },
        { path:'/expenses',           icon:'💵', label:'ወጪዎች' },
        { path:'/reports/financial',  icon:'📊', label:'ፋይናንስ' },
      ],
    },
    {
      groupLabel: 'ሪፖርቶች',
      roles: ['farmer'],
      items: [
        { path:'/farmer/reports',   icon:'📑', label:'ሪፖርቶች' },
        { path:'/farmer/labour',    icon:'👷', label:'ሠራተኞች' },
        { path:'/tasks',            icon:'📋', label:'ተግባራት' },
        { path:'/maintenance', icon:'🔧', label:'ጥገና' },
        { path:'/farmer/attendance',icon:'🗓️', label:'መገኘት' },
        { path:'/expenses',         icon:'💵', label:'ወጪዎች' },
      ],
    },
    {
      groupLabel: 'ስራ',
      roles: ['labor'],
      items: [
        { path:'/labour/tasks',  icon:'📋', label:'ተግባራት' },
        { path:'/labour/attendance',  icon:'🗓️', label:'መገኘት' },
        { path:'/maintenance', icon:'🔧', label:'ጥገና' },
      ],
    },

    {
      groupLabel: 'ክፍያ',
      roles: ['labor'],
      items: [
        { path:'/labour/payslips', icon:'💵', label:'ደሞዝ' },
      ],
    },
    {
      groupLabel: 'ድጋፍ',
      roles: ['owner','admin','office_manager','farmer','labor'],
      items: [
        { path:'/about',   icon:'❓', label:'ስለእኛ' },
        { path:'/contact', icon:'📞', label:'አግኙን' },
      ],
    },
  ],
};

/* Bottom items — Profile & Settings always visible, never duplicated in nav */
const BOTTOM = {
  en: { path:'/settings', icon:'⚙️', label:'Profile & Settings' },
  am: { path:'/settings', icon:'⚙️', label:'መገለጫ እና ቅንብሮች' },
};

/* ── Filter helpers ──────────────────────────────────────────── */
const filterItems = (items, role) =>
  items.filter(i => !i.roles || i.roles.includes(role));

const buildNav = (groups, role) =>
  groups
    .filter(g => g.roles.includes(role))
    .map(g => ({ ...g, items: filterItems(g.items, role) }))
    .filter(g => g.items.length > 0);

/* ══════════════════════════════════════════════════════════════
   LAYOUT COMPONENT
══════════════════════════════════════════════════════════════ */
const Layout = () => {
  const { user, logout, loading, updateProfile } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [language, setLanguage]                 = useState(user?.language || localStorage.getItem('preferredLanguage') || 'en');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen]           = useState(false);
  const [refreshing, setRefreshing]             = useState(false);

  useEffect(() => { if (user?.language) setLanguage(user.language); }, [user?.language]);
  useEffect(() => { if (!loading && !user) navigate('/login'); }, [user, loading, navigate]);

  useEffect(() => {
    const h = () => setProfileOpen(false);
    if (profileOpen) document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [profileOpen]);

  if (loading) return (
      <div className="si-loading-screen">
        <div className="si-loading-logo">
          <img src="/logo.png" alt="Loading Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
        </div>
        <p>Loading SmartIrrigate…</p>
      </div>
    );
  if (!user) return null;

  const isAm      = language === 'am';
  const role      = user.assignedRole || user.role || 'labor';
  const meta      = ROLE_META[role] || ROLE_META.labor;
  const roleLabel = isAm ? meta.am : meta.en;

  const navGroups  = buildNav(isAm ? NAV.am : NAV.en, role);
  const bottomItem = isAm ? BOTTOM.am : BOTTOM.en;

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

      const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    const current = location.pathname;
    navigate('/');
    setTimeout(() => { navigate(current); setRefreshing(false); }, 350);
  };

  return (
    <div className={`si-layout ${sidebarCollapsed ? 'si-collapsed' : ''}`}>

      {/* ── TOP HEADER ──────────────────────────────────────────── */}
      <header className="si-topbar">
        <div className="si-topbar-left">
          <button className="si-collapse-btn" onClick={() => setSidebarCollapsed(v => !v)}
            title="Toggle sidebar" aria-label="Toggle sidebar">
            <span /><span /><span />
          </button>
          <div className="si-brand">
              <img src="/logo.png" alt="Logo" className="si-brand-icon" style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px' }} />
              <div className="si-brand-text">
              <span className="si-brand-name">SmartIrrigate</span>
            </div>
          </div>
        </div>

        <div className="si-topbar-center">
          <h1 className="si-page-title">{pageTitle}</h1>
        </div>

        <div className="si-topbar-right">
          {/* Google Translate Dropdown */}
          
          {/* Alerts */}
          <Link to="/notifications" className="si-chip si-chip-alert">
            <span>🔔</span>
            <span>{isAm ? 'ማሳወቂያ' : 'Alerts'}</span>
          </Link>

          {/* Refresh */}
          <button
            className={`si-refresh-btn ${refreshing ? 'spinning' : ''}`}
            onClick={handleRefresh}
            title={isAm ? 'ዳግም ጫን' : 'Refresh page'}
            aria-label="Refresh page"
            style={{ position: 'relative' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6"/>
              <path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>

          {/* Language toggle */}
          {/* Profile dropdown */}
          {/* Google Translate Widget */}
            <GoogleTranslate />
            {/* Profile dropdown */}
            <div className="si-profile-wrap" onClick={e => { e.stopPropagation(); setProfileOpen(v => !v); }}>
            <div className="si-profile-btn">
              <div className="si-avatar">{(user.name || 'U').charAt(0).toUpperCase()}</div>
              <div className="si-profile-info">
                <span className="si-profile-name">{user.name || 'User'}</span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px',
                  borderRadius: 20, marginTop: 2,
                  background: meta.bg, color: meta.color,
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
            <div className="si-role-banner" style={{ background: meta.bg, borderBottom: `2px solid ${meta.color}22` }}>
              <span style={{ fontSize: '1.1rem' }}>{meta.icon}</span>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: meta.color,
                  textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {roleLabel}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 1,
                  maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                    <Link key={item.path} to={item.path}
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
              <Link to={bottomItem.path}
                className={`si-nav-item ${location.pathname === bottomItem.path ? 'active' : ''}`}
                title={sidebarCollapsed ? bottomItem.label : ''}>
                <span className="si-nav-icon">{bottomItem.icon}</span>
                <span className="si-nav-label">{bottomItem.label}</span>
                {location.pathname === bottomItem.path && <span className="si-active-bar"/>}
              </Link>
              <button className="si-nav-item si-logout-item" onClick={logout}
                title={sidebarCollapsed ? (isAm ? 'ውጣ' : 'Logout') : ''}>
                <span className="si-nav-icon">🚪</span>
                <span className="si-nav-label">{isAm ? 'ውጣ' : 'Logout'}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="si-workspace">
          <div className="si-content"><Outlet /></div>

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





