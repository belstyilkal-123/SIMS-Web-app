import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import './AdminPages.css';

const ROLE_META = {
  owner:          { icon: '👑', color: '#92400e', bg: '#fef3c7', label: 'Owner'          },
  admin:          { icon: '🛡️', color: '#b91c1c', bg: '#fee2e2', label: 'Administrator'  },
  office_manager: { icon: '💼', color: '#7c3aed', bg: '#ede9fe', label: 'Office Manager' },
  farmer:         { icon: '🌾', color: '#15803d', bg: '#dcfce7', label: 'Farmer'          },
  labor:          { icon: '👷', color: '#1d4ed8', bg: '#dbeafe', label: 'Labour'          },
};

const emptyForm = { name: '', email: '', password: '', role: 'owner', farmId: '', language: 'en' };

export default function UserManagement() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const [users, setUsers]   = useState([]);
  const [farms, setFarms]   = useState([]);
  const [form, setForm]     = useState({ name: '', email: '', password: '', role: 'owner', farmId: '', language: 'en' });
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // '' | 'active' | 'suspended'
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [resetPw, setResetPw] = useState({ userId: null, pw: '' });

  const load = () =>
    axios.get(`${API_URL}/api/admin/users`, cfg).then(r => setUsers(r.data));

  useEffect(() => {
    Promise.all([load(), axios.get(`${API_URL}/api/farms`, cfg).then(r => setFarms(r.data))])
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      await axios.post(`${API_URL}/api/admin/users`, {
        name:         form.name,
        email:        form.email,
        password:     form.password,
        assignedRole: form.role,
        farmId:       form.farmId || undefined,
        language:     form.language,
      }, cfg);
      setSuccess(`Account created for ${form.email}.`);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    await axios.delete(`${API_URL}/api/admin/users/${id}`, cfg);
    await load();
  };

  const handleResetPw = async (userId) => {
    if (!resetPw.pw || resetPw.pw.length < 8) { setError('New password must be at least 8 characters'); return; }
    setError(''); setSaving(true);
    try {
      await axios.post(`${API_URL}/api/admin/users/${userId}/reset-password`, { password: resetPw.pw }, cfg);
      setSuccess('Password reset successfully.'); setResetPw({ userId: null, pw: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed');
    } finally { setSaving(false); }
  };

  const filtered = users.filter(u => {
    const role         = u.assignedRole || u.role || '';
    const status       = u.accountStatus || (u.isActive ? 'active' : 'suspended');
    if (filterRole   && role   !== filterRole)   return false;
    if (filterStatus === 'active'    && status !== 'active')    return false;
    if (filterStatus === 'suspended' && status !== 'suspended') return false;
    if (filterStatus === 'pending'   && status !== 'pending')   return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) &&
        !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSuspend = async (id, currentStatus) => {
    const isCurrentlyActive = currentStatus === 'active';
    const action = isCurrentlyActive ? 'suspend' : 'activate';
    const reason = isCurrentlyActive ? (prompt('Reason for suspension (optional):') ?? '') : '';
    if (isCurrentlyActive && reason === null) return;
    try {
      await axios.post(`${API_URL}/api/admin/users/${id}/${action}`, { reason }, cfg);
      setSuccess(`Account ${action === 'suspend' ? 'suspended' : 'activated'} successfully.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${action} account`);
    }
  };

  if (loading) return <div className="ap-loading">Loading users…</div>;

  return (
    <div className="ap-page">
      <div className="ap-header">
        <h2>👥 User Account Management</h2>
        <p className="ap-subtitle">Create accounts, assign roles, and manage user access.</p>
      </div>

      {/* ── Create Account Form ────────────────────────────── */}
      <div className="ap-card">
        <h3>➕ Create User Account</h3>
        {error   && <div className="ap-error">{error}</div>}
        {success && <div className="ap-success">{success}</div>}
        <form className="ap-form" onSubmit={handleSave}>
          <div className="ap-form-row">
            <div className="ap-field">
              <label>Full Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Full name" className="ap-input" />
            </div>
            <div className="ap-field">
              <label>Email *</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com" className="ap-input" />
            </div>
            <div className="ap-field">
              <label>Password *</label>
              <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Min 8 characters" className="ap-input" />
            </div>
            <div className="ap-field">
              <label>Role *</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="ap-input">
                <option value="owner">👑 Owner — Business &amp; Financial Authority</option>
                <option value="admin">🛡️ Administrator — System &amp; Security Authority</option>
              </select>
              <span className="ap-hint">
                Farmer, Office Manager and Labour register themselves via the Register page.
              </span>
            </div>
            <div className="ap-field">
              <label>Assign to Farm</label>
              <select value={form.farmId} onChange={e => setForm(p => ({ ...p, farmId: e.target.value }))} className="ap-input">
                <option value="">None</option>
                {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
            </div>
            <div className="ap-field">
              <label>Language</label>
              <select value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))} className="ap-input">
                <option value="en">English</option>
                <option value="am">Amharic (አማርኛ)</option>
              </select>
            </div>
          </div>
          <div className="ap-form-actions">
            <button type="submit" className="ap-btn ap-btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Filters ───────────────────────────────────────────── */}
      <div className="ap-filters">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…" className="ap-input ap-filter-search" />
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="ap-input ap-filter-select">
          <option value="">All Roles</option>
          <option value="owner">👑 Owner</option><option value="admin">🛡️ Administrator</option>
          <option value="office_manager">💼 Office Manager</option>
          <option value="farmer">🌾 Farmer</option>
          <option value="labor">👷 Labour Worker</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="ap-input ap-filter-select">
          <option value="">All Status</option>
          <option value="active">✅ Active</option>
          <option value="suspended">🚫 Suspended</option>
          <option value="pending">⏳ Pending</option>
        </select>
        <span className="ap-count">{filtered.length} users</span>
      </div>

      {/* ── User Table ────────────────────────────────────────── */}
      <div className="ap-card ap-no-pad">
        <table className="ap-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Farm</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(u => {
              const role         = u.assignedRole || u.role;
              const meta         = ROLE_META[role] || ROLE_META.labor;
              const status       = u.accountStatus || (u.isActive ? 'active' : 'suspended');
              const isActive     = status === 'active';
              const isSuspended  = status === 'suspended';
              return (
                <tr key={u._id} style={{ opacity: isSuspended ? 0.65 : 1 }}>
                  <td><strong>{u.name}</strong></td>
                  <td style={{ fontSize:'0.82rem' }}>{u.email}</td>
                  <td>
                    <span className="ap-badge" style={{ background: meta.bg, color: meta.color }}>
                      {meta.icon} {meta.label}
                    </span>
                  </td>
                  <td>{u.farmId?.name || <span className="ap-muted">None</span>}</td>
                  <td>
                    <span className="ap-badge" style={{
                      background: isActive     ? '#dcfce7' :
                                  isSuspended  ? '#fee2e2' :
                                  status === 'pending' ? '#fef3c7' : '#f1f5f9',
                      color:      isActive     ? '#15803d' :
                                  isSuspended  ? '#b91c1c' :
                                  status === 'pending' ? '#92400e' : '#475569',
                    }}>
                      {isActive    ? '✅ Active'    :
                       isSuspended ? '🚫 Suspended' :
                       status === 'pending' ? '⏳ Pending' : status}
                    </span>
                  </td>
                  <td style={{ fontSize:'0.82rem' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    {/* ── No edit button — use Reset Password for credential changes ── */}
                    <button className="ap-btn-icon" onClick={() => setResetPw({ userId: u._id, pw: '' })} title="Reset Password">🔑</button>
                    {u._id !== user._id && (
                      <button
                        className="ap-btn-icon"
                        onClick={() => handleSuspend(u._id, status)}
                        title={isActive ? 'Suspend Account' : isSuspended ? 'Activate Account' : 'Activate'}>
                        {isActive ? '🚫' : '✅'}
                      </button>
                    )}
                    {u._id !== user._id && (
                      <button className="ap-btn-icon ap-btn-danger" onClick={() => handleDelete(u._id, u.name)} title="Delete">🗑️</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Reset Password Modal ──────────────────────────────── */}
      {resetPw.userId && (
        <div className="ap-modal-overlay" onClick={() => setResetPw({ userId: null, pw: '' })}>
          <div className="ap-modal" onClick={e => e.stopPropagation()}>
            <h3>🔑 Reset Password</h3>
            <input type="password" value={resetPw.pw}
              onChange={e => setResetPw(p => ({ ...p, pw: e.target.value }))}
              placeholder="New password (min 8 chars)" className="ap-input" style={{ width: '100%', marginBottom: 12 }} />
            {error && <div className="ap-error">{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="ap-btn ap-btn-primary" disabled={saving}
                onClick={() => handleResetPw(resetPw.userId)}>
                {saving ? 'Resetting…' : 'Reset Password'}
              </button>
              <button className="ap-btn ap-btn-ghost" onClick={() => setResetPw({ userId: null, pw: '' })}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



