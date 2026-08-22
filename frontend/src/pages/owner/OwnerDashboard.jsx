import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { Link } from 'react-router-dom';
import './OwnerPages.css';

export default function OwnerDashboard() {
  const { user } = useContext(AuthContext);
    const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const [kpi,      setKpi]      = useState(null);
  const [staff,    setStaff]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    Promise.allSettled([
      axios.get(`${API_URL}/api/owner/dashboard`, cfg),
      axios.get(`${API_URL}/api/owner/staff`, cfg),
    ]).then(([k, s]) => {
      if (k.status === 'fulfilled') setKpi(k.value.data);
      if (s.status === 'fulfilled' && Array.isArray(s.value?.data)) {
        setStaff(s.value.data.slice(0, 8));
      }
      setLoading(false);
    }).catch(() => {
      setError('Failed to load dashboard data');
      setLoading(false);
    });
  }, []);

  const ROLE_COLORS = {
    farmer: { bg: '#dcfce7', color: '#15803d', icon: '🌾' },
    office_manager: { bg: '#ede9fe', color: '#7c3aed', icon: '💼' },
    labor:  { bg: '#dbeafe', color: '#1d4ed8', icon: '👷' },
    admin:  { bg: '#fee2e2', color: '#b91c1c', icon: '🛡️' },
  };

  if (loading) return <div className="ow-loading">Loading Owner Dashboard…</div>;
  if (error)   return <div className="ow-error">{error}</div>;

  const byRole    = kpi?.byRole || {};
  const users     = kpi?.users  || {};
  const devices   = kpi?.devices || {};

  return (
    <div className="ow-page">
      <div className="ow-header">
        <h2>👑 Business Overview</h2>
        <p className="ow-subtitle">Organization-wide performance and workforce summary.</p>
      </div>

      {/* ── KPI Strip ────────────────────────────────────────────── */}
      <div className="ow-kpi-row">
        {[
          { icon:'👥', label:'Total Users',    value: users.total  || 0,    bg:'#dbeafe', color:'#1d4ed8' },
          { icon:'✅', label:'Active',         value: users.active || 0,    bg:'#dcfce7', color:'#15803d' },
          { icon:'⏳', label:'Pending',        value: users.pending|| 0,    bg:'#fef3c7', color:'#92400e' },
          { icon:'🌾', label:'Total Farms',    value: kpi?.farms?.total||0, bg:'#d1fae5', color:'#047857' },
          { icon:'🛠️', label:'Devices Online', value: `${devices.online||0}/${devices.total||0}`, bg:'#ede9fe', color:'#7c3aed' },
        ].map(k => (
          <div key={k.label} className="ow-kpi" style={{ background: k.bg }}>
            <span style={{ fontSize:'1.3rem' }}>{k.icon}</span>
            <div className="ow-kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="ow-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Workforce by Role ─────────────────────────────────────── */}
      <div className="ow-card">
        <div className="ow-card-header">
          <h3>👥 Workforce Summary</h3>
        </div>
        <div className="ow-role-grid">
          {Object.entries(byRole).map(([r, count]) => {
            const meta = ROLE_COLORS[r] || { bg:'#f1f5f9', color:'#475569', icon:'👤' };
            return (
              <div key={r} className="ow-role-card" style={{ background: meta.bg }}>
                <span style={{ fontSize:'1.4rem' }}>{meta.icon}</span>
                <div style={{ fontSize:'1.6rem', fontWeight:800, color: meta.color }}>{count}</div>
                <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:600,
                  textTransform:'capitalize' }}>{r.replace('_',' ')}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recent Staff ──────────────────────────────────────────── */}
      {staff.length > 0 && (
        <div className="ow-card">
          <div className="ow-card-header">
            <h3>👤 Active Staff</h3>
            <Link to="/admin/users" className="ow-link">View All →</Link>
          </div>
          <div className="ow-staff-grid">
            {staff.map(s => {
              const meta = ROLE_COLORS[s.assignedRole] || { bg:'#f1f5f9', color:'#475569', icon:'👤' };
              return (
                <div key={s._id} className="ow-staff-card">
                  <div className="ow-staff-avatar" style={{ background: meta.bg, color: meta.color }}>
                    {(s.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:'0.88rem' }}>{s.name}</div>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                      {meta.icon} {s.assignedRole?.replace('_',' ')}
                    </div>
                    {s.farmId && <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>🌾 {s.farmId.name}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Quick Links ───────────────────────────────────────────── */}
      <div className="ow-card">
        <h3>🔗 Quick Actions</h3>
        <div className="ow-quick-links">
          {[
            { to:'/reports/financial', icon:'📈', label:'Financial Reports' },
            { to:'/farm-control',      icon:'🌾', label:'Farm Overview' },
            { to:'/farm-assignments',  icon:'👥', label:'Farm Assignments' },
            { to:'/tasks',             icon:'📋', label:'Task Management' },
            { to:'/audit-logs',        icon:'📝', label:'Audit Logs' },
            { to:'/notifications',     icon:'🔔', label:'Notifications' },
          ].map(lnk => (
            <Link key={lnk.to} to={lnk.to} className="ow-quick-link">
              <span style={{ fontSize:'1.3rem' }}>{lnk.icon}</span>
              <span>{lnk.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
