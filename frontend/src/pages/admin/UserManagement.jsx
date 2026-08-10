import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import './AdminPages.css';

const ROLE_META = {
  super_administrator: { icon: '🛡️', color: '#b91c1c', bg: '#fee2e2', label: 'Super Admin'    },
  office_manager:      { icon: '💼', color: '#7c3aed', bg: '#ede9fe', label: 'Office Manager' },
  farmer:              { icon: '🌾', color: '#15803d', bg: '#dcfce7', label: 'Farmer'          },
  labor:               { icon: '👷', color: '#1d4ed8', bg: '#dbeafe', label: 'Labour'          },
};

const emptyForm = { name: '', email: '', password: '', role: 'labor', farmId: '', language: 'en' };

export default function UserManagement() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const [users, setUsers]   = useState([]);
  const [farms, setFarms]   = useState([]);
  const [form, setForm]     = useState({ name: '', email: '', password: '', role: 'labor', farmId: '', language: 'en' });
  const [editId, setEditId] = useState(null);
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
      if (editId) {
        const { password, ...updateData } = form;
        await axios.put(`${API_URL}/api/admin/users/${editId}`, updateData, cfg);
        setSuccess('User updated.');
      } else {
        await axios.post(`${API_URL}/api/admin/users`, form, cfg);
        setSuccess(`Account created for ${form.email}.`);
      }
      setForm(emptyForm); setEditId(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleEdit = (u) => {
    setEditId(u._id);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, farmId: u.farmId?._id || u.farmId || '', language: u.language || 'en' });
    setError(''); setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (filterRole && u.role !== filterRole) return false;
    if (filterStatus === 'active'    && !u.isActive)  return false;
    if (filterStatus === 'suspended' && u.isActive)   return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSuspend = async (id, isActive) => {
    const action = isActive ? 'suspend' : 'activate';
    const reason = isActive ? prompt('Reason for suspension (optional):') || '' : '';
    if (isActive && reason === null) return; // cancelled
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

      {/* ── Create / Edit Form ──────────────────────────────── */}
      <div className="ap-card">
        <h3>{editId ? '✏️ Edit User' : '➕ Create User Account'}</h3>
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
            {!editId && (
              <div className="ap-field">
                <label>Password *</label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Min 8 characters" className="ap-input" />
              </div>
            )}
            <div className="ap-field">
              <label>Role *</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="ap-input">
                <option value="super_administrator">🛡️ Super Administrator</option>
                <option value="office_manager">💼 Office Manager</option>
                <option value="farmer">🌾 Farmer</option>
                <option value="labor">👷 Labour Worker</option>
              </select>
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
              {saving ? 'Saving…' : editId ? 'Update User' : 'Create Account'}
            </button>
            {editId && (
              <button type="button" className="ap-btn ap-btn-ghost"
                onClick={() => { setEditId(null); setForm({ name: '', email: '', password: '', role: 'labor', farmId: '', language: 'en' }); setError(''); setSuccess(''); }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Filters ───────────────────────────────────────────── */}
      <div className="ap-filters">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…" className="ap-input ap-filter-search" />
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="ap-input ap-filter-select">
          <option value="">All Roles</option>
          <option value="super_administrator">🛡️ Super Administrator</option>
          <option value="office_manager">💼 Office Manager</option>
          <option value="farmer">🌾 Farmer</option>
          <option value="labor">👷 Labour Worker</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="ap-input ap-filter-select">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <span className="ap-count">{filtered.length} users</span>
      </div>

      {/* ── User Table ────────────────────────────────────────── */}
      <div className="ap-card ap-no-pad">
        <table className="ap-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Farm</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(u => {
              const meta = ROLE_META[u.role] || ROLE_META.labor;
              const isActive = u.isActive !== false;
              return (
                <tr key={u._id} style={{ opacity: isActive ? 1 : 0.65 }}>
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
                      background: isActive ? '#dcfce7' : '#fee2e2',
                      color:      isActive ? '#15803d' : '#b91c1c',
                    }}>
                      {isActive ? '✅ Active' : '🚫 Suspended'}
                    </span>
                  </td>
                  <td style={{ fontSize:'0.82rem' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="ap-btn-icon" onClick={() => handleEdit(u)} title="Edit">✏️</button>
                    <button className="ap-btn-icon" onClick={() => setResetPw({ userId: u._id, pw: '' })} title="Reset Password">🔑</button>
                    {u._id !== user._id && (
                      <button
                        className="ap-btn-icon"
                        onClick={() => handleSuspend(u._id, isActive)}
                        title={isActive ? 'Suspend Account' : 'Activate Account'}>
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

