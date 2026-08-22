import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import './AdminPages.css';

const STATUS_COLORS = {
  pending:     { bg: '#fef3c7', color: '#92400e' },
  active:      { bg: '#dcfce7', color: '#15803d' },
  suspended:   { bg: '#fee2e2', color: '#b91c1c' },
  rejected:    { bg: '#f1f5f9', color: '#475569' },
  deactivated: { bg: '#f1f5f9', color: '#475569' },
};

const ROLE_ICONS = {
  owner: '👑', admin: '🛡️', office_manager: '💼', farmer: '🌾', labor: '👷',
};

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const [registrations, setRegistrations] = useState([]);
  const [allUsers,      setAllUsers]      = useState([]);
  const [farms,         setFarms]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [saving,        setSaving]        = useState({});
  const [assignRole,    setAssignRole]    = useState({});
  const [rejectReason,  setRejectReason]  = useState({});
  const [showReject,    setShowReject]    = useState(null);

  const load = async () => {
    try {
      const [r, u, f] = await Promise.all([
        axios.get(`${API_URL}/api/admin/users/registrations`, cfg),
        axios.get(`${API_URL}/api/admin/users`, cfg),
        axios.get(`${API_URL}/api/farms`, cfg).catch(() => ({ data: [] })),
      ]);
      setRegistrations(r.data);
      setAllUsers(u.data);
      setFarms(f.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  /* ── Approve ─────────────────────────────────────────────────── */
  const handleApprove = async (userId) => {
    const reg = registrations.find(r => r._id === userId);
    const role = assignRole[userId] || reg?.requestedRole || 'farmer';
    setSaving(p => ({ ...p, [userId]: true }));
    try {
      await axios.post(`${API_URL}/api/admin/users/${userId}/approve`, { assignedRole: role }, cfg);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || 'Approval failed');
    } finally { setSaving(p => ({ ...p, [userId]: false })); }
  };

  /* ── Reject ──────────────────────────────────────────────────── */
  const handleReject = async (userId) => {
    setSaving(p => ({ ...p, [userId]: true }));
    try {
      await axios.post(`${API_URL}/api/admin/users/${userId}/reject`,
        { reason: rejectReason[userId] || '' }, cfg);
      setShowReject(null);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || 'Rejection failed');
    } finally { setSaving(p => ({ ...p, [userId]: false })); }
  };

  /* ── Summary stats ───────────────────────────────────────────── */
  const stats = {
    total:      allUsers.length,
    active:     allUsers.filter(u => u.accountStatus === 'active').length,
    pending:    registrations.length,
    suspended:  allUsers.filter(u => u.accountStatus === 'suspended').length,
    farmers:    allUsers.filter(u => u.assignedRole === 'farmer').length,
    labour:     allUsers.filter(u => u.assignedRole === 'labor').length,
  };

  if (loading) return <div className="ap-loading">Loading Admin Dashboard…</div>;
  if (error)   return <div className="ap-error">{error}</div>;

  return (
    <div className="ap-page">
      <div className="ap-header">
        <h2>🛡️ Admin Dashboard</h2>
        <p className="ap-subtitle">System administration, user approvals, and security overview.</p>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        {[
          { label:'Total Users',  value: stats.total,    bg:'#dbeafe', color:'#1d4ed8' },
          { label:'Active',       value: stats.active,   bg:'#dcfce7', color:'#15803d' },
          { label:'Pending',      value: stats.pending,  bg:'#fef3c7', color:'#92400e' },
          { label:'Suspended',    value: stats.suspended,bg:'#fee2e2', color:'#b91c1c' },
          { label:'Farmers',      value: stats.farmers,  bg:'#d1fae5', color:'#047857' },
          { label:'Labour',       value: stats.labour,   bg:'#ede9fe', color:'#7c3aed' },
          { label:'Farms',        value: farms.length,   bg:'#fef9c3', color:'#854d0e' },
        ].map(k => (
          <div key={k.label} style={{ flex:'1 1 100px', background:k.bg, borderRadius:12,
            padding:'14px 16px', textAlign:'center', border:`1px solid ${k.color}22` }}>
            <div style={{ fontSize:'1.6rem', fontWeight:800, color:k.color }}>{k.value}</div>
            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:500 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Pending Registrations ──────────────────────────────── */}
      <div className="ap-card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h3 style={{ margin:0 }}>
            ⏳ Pending Registrations
            {registrations.length > 0 && (
              <span style={{ marginLeft:8, background:'#fef3c7', color:'#92400e',
                padding:'2px 8px', borderRadius:20, fontSize:'0.75rem', fontWeight:700 }}>
                {registrations.length}
              </span>
            )}
          </h3>
          <Link to="/admin/users" style={{ fontSize:'0.82rem', color:'var(--primary)', fontWeight:600, textDecoration:'none' }}>
            Full User Management →
          </Link>
        </div>

        {registrations.length === 0 ? (
          <div className="ap-empty">✅ No pending registrations. All caught up!</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {registrations.map(reg => (
              <div key={reg._id} style={{
                background:'var(--surface-hover)', border:'1px solid var(--border)',
                borderRadius:12, padding:'16px 18px',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start',
                  flexWrap:'wrap', gap:12 }}>
                  {/* Registration info */}
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                      <strong style={{ fontSize:'0.95rem' }}>{reg.name}</strong>
                      <span className="ap-badge" style={{ background:'#fef3c7', color:'#92400e' }}>
                        {ROLE_ICONS[reg.requestedRole] || '👤'} Requested: {reg.requestedRole?.replace('_',' ')}
                      </span>
                    </div>
                    <div style={{ fontSize:'0.82rem', color:'var(--text-muted)', display:'flex', gap:16, flexWrap:'wrap' }}>
                      <span>📧 {reg.email}</span>
                      {reg.phone && <span>📞 {reg.phone}</span>}
                      {reg.address && <span>📍 {reg.address}</span>}
                      <span>🕐 {new Date(reg.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Approve section */}
                  <div style={{ display:'flex', flexDirection:'column', gap:8, minWidth:220 }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <select value={assignRole[reg._id] || reg.requestedRole || 'farmer'}
                        onChange={e => setAssignRole(p => ({ ...p, [reg._id]: e.target.value }))}
                        style={{ flex:1, padding:'7px 10px', borderRadius:7, border:'1px solid var(--border)',
                          background:'var(--surface)', color:'var(--text-main)', fontSize:'0.82rem' }}>
                        <option value="farmer">🌾 Farmer</option>
                        <option value="office_manager">💼 Office Manager</option>
                        <option value="labor">👷 Labour Worker</option>
                        <option value="admin">🛡️ Administrator</option>
                      </select>
                      <button className="ap-btn ap-btn-primary"
                        style={{ padding:'7px 14px', fontSize:'0.82rem', whiteSpace:'nowrap' }}
                        disabled={saving[reg._id]}
                        onClick={() => handleApprove(reg._id)}>
                        {saving[reg._id] ? '…' : '✅ Approve'}
                      </button>
                    </div>
                    {showReject === reg._id ? (
                      <div style={{ display:'flex', gap:6 }}>
                        <input placeholder="Rejection reason (optional)"
                          value={rejectReason[reg._id] || ''}
                          onChange={e => setRejectReason(p => ({ ...p, [reg._id]: e.target.value }))}
                          style={{ flex:1, padding:'6px 10px', borderRadius:7,
                            border:'1px solid var(--border)', fontSize:'0.82rem',
                            background:'var(--surface)', color:'var(--text-main)' }} />
                        <button onClick={() => handleReject(reg._id)}
                          disabled={saving[reg._id]}
                          style={{ padding:'6px 12px', borderRadius:7, border:'none', cursor:'pointer',
                            background:'#fee2e2', color:'#b91c1c', fontWeight:600, fontSize:'0.82rem' }}>
                          Confirm
                        </button>
                        <button onClick={() => setShowReject(null)}
                          style={{ padding:'6px 8px', borderRadius:7, border:'1px solid var(--border)',
                            background:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'0.82rem' }}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setShowReject(reg._id)}
                        style={{ padding:'6px 14px', borderRadius:7, border:'1px solid #fca5a5',
                          background:'#fee2e2', color:'#b91c1c', fontWeight:600, fontSize:'0.82rem',
                          cursor:'pointer' }}>
                        ❌ Reject
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Active Users ─────────────────────────────────── */}
      <div className="ap-card ap-no-pad">
        <div style={{ padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center',
          borderBottom:'1px solid var(--border)' }}>
          <h3 style={{ margin:0, fontSize:'0.95rem', fontWeight:700 }}>👥 Recently Joined Users</h3>
          <Link to="/admin/users" style={{ fontSize:'0.82rem', color:'var(--primary)', fontWeight:600, textDecoration:'none' }}>
            Manage All →
          </Link>
        </div>
        <table className="ap-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th></tr>
          </thead>
          <tbody>
            {allUsers
              .filter(u => u.accountStatus === 'active')
              .slice(0, 8)
              .map(u => (
                <tr key={u._id}>
                  <td><strong>{u.name}</strong></td>
                  <td style={{ fontSize:'0.82rem' }}>{u.email}</td>
                  <td>
                    <span className="ap-badge" style={{ background:'var(--surface-hover)', color:'var(--text-muted)' }}>
                      {ROLE_ICONS[u.assignedRole] || '👤'} {u.assignedRole?.replace('_',' ') || 'Unassigned'}
                    </span>
                  </td>
                  <td>
                    <span className="ap-badge" style={STATUS_COLORS[u.accountStatus] || STATUS_COLORS.active}>
                      {u.accountStatus}
                    </span>
                  </td>
                  <td style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ── Quick Actions ───────────────────────────────────────── */}
      <div className="ap-card">
        <h3>🔗 Quick Actions</h3>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {[
            { to:'/admin/users',     icon:'👥', label:'User Management' },
            { to:'/devices',         icon:'🛠️', label:'Device Management' },
            { to:'/audit-logs',      icon:'📝', label:'Audit Logs' },
          ].map(lnk => (
            <Link key={lnk.to} to={lnk.to} style={{
              flex:'1 1 130px', display:'flex', flexDirection:'column',
              alignItems:'center', gap:6, padding:'14px 12px', borderRadius:12,
              background:'var(--surface-hover)', border:'1px solid var(--border)',
              textDecoration:'none', color:'var(--text-main)', fontSize:'0.82rem',
              fontWeight:600, transition:'all 0.15s', textAlign:'center',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.color='var(--primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text-main)'; }}>
              <span style={{ fontSize:'1.3rem' }}>{lnk.icon}</span>
              <span>{lnk.label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
