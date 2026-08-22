import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import './OfficePages.css';

/* ── status colours ──────────────────────────────────────────────────────── */
const STATUS_META = {
  pending:   { bg: '#fef3c7', color: '#92400e', label: 'Pending',            labelAm: 'በሂደት' },
  submitted: { bg: '#dbeafe', color: '#1d4ed8', label: 'Submitted',          labelAm: 'ቀርቧል' },
  paid:      { bg: '#dcfce7', color: '#15803d', label: 'Approved & Paid',    labelAm: 'ፈቅዶ ተከፍሏል' },
  cancelled: { bg: '#fee2e2', color: '#b91c1c', label: 'Cancelled',          labelAm: 'ተሰርዟል' },
};

const ROLE_LABEL = {
  admin:          { label: 'Admin',           color: '#b91c1c', bg: '#fee2e2' },
  farmer:         { label: 'Farmer',          color: '#15803d', bg: '#dcfce7' },
  office_manager: { label: 'Office Manager',  color: '#7c3aed', bg: '#ede9fe' },
  labor:          { label: 'Labor',           color: '#1d4ed8', bg: '#dbeafe' },
};

const currentPeriod = () => new Date().toISOString().slice(0, 7);

const EMPTY_FORM = {
  userId: '', farmId: '', period: currentPeriod(),
  baseSalary: '', bonus: '0', deductions: '0', notes: '',
};

export default function PayrollManagement() {
  const { user } = useContext(AuthContext);
  const cfg        = useMemo(() => ({ headers: { Authorization: `Bearer ${user?.token}` } }), [user?.token]);
  const isAm       = user?.language === 'am';
  const userRole   = user?.assignedRole || user?.role;
  const isOwner    = userRole === 'owner';
  const isOM       = userRole === 'office_manager';

  /* ── data state ──────────────────────────────────────────────────────── */
  const [records,    setRecords]    = useState([]);
  const [allUsers,   setAllUsers]   = useState([]);   // all active non-owner users
  const [farms,      setFarms]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);

  /* ── filter state ────────────────────────────────────────────────────── */
  const [filterPeriod, setFilterPeriod] = useState(currentPeriod());
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFarm,   setFilterFarm]   = useState('');
  const [search,       setSearch]       = useState('');

  /* ── form state ──────────────────────────────────────────────────────── */
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState(EMPTY_FORM);

  /* ── banner ──────────────────────────────────────────────────────────── */
  const [banner, setBanner] = useState({ type: '', text: '' });
  const flash = (type, text) => {
    setBanner({ type, text });
    setTimeout(() => setBanner({ type: '', text: '' }), 5000);
  };

  /* ── load reference data ─────────────────────────────────────────────── */
  useEffect(() => {
    Promise.all([
      axios.get(`${API_URL}/api/farms`, cfg),
      // Fetch ALL active users — office manager creates payroll for everyone
      axios.get(`${API_URL}/api/admin/users?accountStatus=active`, cfg),
    ]).then(([fRes, uRes]) => {
      setFarms(fRes.data || []);
      // Exclude owner from payroll targets
      const eligible = (uRes.data || []).filter(u => {
        const r = u.assignedRole || u.role;
        return r !== 'owner';
      });
      setAllUsers(eligible);
    }).catch(err => console.error('PayrollManagement init:', err));
  }, [cfg]);

  /* ── load records ────────────────────────────────────────────────────── */
  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPeriod) params.set('period', filterPeriod);
      if (filterFarm)   params.set('farmId', filterFarm);
      const res = await axios.get(`${API_URL}/api/payroll?${params}`, cfg);
      setRecords(res.data || []);
    } catch (err) {
      flash('error', err.response?.data?.error || 'Failed to load payroll records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterPeriod, filterFarm, cfg]);

  /* ── derived ─────────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter(r => {
      if (filterStatus && r.paymentStatus !== filterStatus) return false;
      if (q) {
        const hay = [
          r.userId?.name, r.userId?.email,
          r.farmId?.name, r.period,
          r.userId?.assignedRole,
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, filterStatus, search]);

  const kpi = useMemo(() => ({
    total:     records.length,
    pending:   records.filter(r => r.paymentStatus === 'pending').length,
    submitted: records.filter(r => r.paymentStatus === 'submitted').length,
    paid:      records.filter(r => r.paymentStatus === 'paid').length,
    totalNet:  records.reduce((s, r) => s + (r.netPay || 0), 0),
    pendingAmt:records.filter(r => r.paymentStatus !== 'paid').reduce((s, r) => s + (r.netPay || 0), 0),
  }), [records]);

  const netPreview = form.baseSalary
    ? Math.max(0, Number(form.baseSalary) + Number(form.bonus || 0) - Number(form.deductions || 0))
    : null;

  /* ── CRUD ────────────────────────────────────────────────────────────── */
  const openNew = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM, farmId: farms[0]?._id || '' });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEdit = (r) => {
    setEditId(r._id);
    setForm({
      userId:     r.userId?._id || r.userId || '',
      farmId:     r.farmId?._id || r.farmId || '',
      period:     r.period,
      baseSalary: String(r.baseSalary),
      bonus:      String(r.bonus ?? 0),
      deductions: String(r.deductions ?? 0),
      notes:      r.notes || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.userId)     { flash('error', 'Please select a user'); return; }
    if (!form.farmId)     { flash('error', 'Please select a farm'); return; }
    if (!form.baseSalary) { flash('error', 'Base salary is required'); return; }

    setSaving(true);
    try {
      const payload = {
        userId:     form.userId,
        farmId:     form.farmId,
        period:     form.period,
        baseSalary: Number(form.baseSalary),
        bonus:      Number(form.bonus || 0),
        deductions: Number(form.deductions || 0),
        notes:      form.notes,
      };
      if (editId) {
        await axios.put(`${API_URL}/api/payroll/${editId}`, payload, cfg);
        flash('success', 'Payroll record updated.');
      } else {
        await axios.post(`${API_URL}/api/payroll`, payload, cfg);
        flash('success', `Payroll created for ${form.period}.`);
      }
      setForm({ ...EMPTY_FORM, farmId: farms[0]?._id || '' });
      setEditId(null);
      setShowForm(false);
      await load();
    } catch (err) {
      flash('error', err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this payroll record? This cannot be undone.')) return;
    try {
      await axios.delete(`${API_URL}/api/payroll/${id}`, cfg);
      flash('success', 'Record deleted.');
      await load();
    } catch (err) {
      flash('error', err.response?.data?.error || 'Delete failed');
    }
  };

  /* ── Submit for owner approval ───────────────────────────────────────── */
  const handleSubmit = async (id) => {
    try {
      await axios.post(`${API_URL}/api/payroll/${id}/submit`, {}, cfg);
      flash('success', 'Payroll submitted to owner for approval.');
      await load();
    } catch (err) {
      flash('error', err.response?.data?.error || 'Submit failed');
    }
  };

  /* ── Owner: Approve ──────────────────────────────────────────────────── */
  const handleApprove = async (id) => {
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/payroll/${id}/approve`, {}, cfg);
      flash('success', 'Payroll approved and payment processed.');
      await load();
    } catch (err) {
      flash('error', err.response?.data?.error || 'Approval failed');
    } finally { setSaving(false); }
  };

  /* ── Owner: Reject ───────────────────────────────────────────────────── */
  const handleReject = async (id) => {
    const reason = window.prompt('Reason for rejection (optional):');
    if (reason === null) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/payroll/${id}/reject`, { reason }, cfg);
      flash('success', 'Payroll rejected. Office Manager will be notified.');
      await load();
    } catch (err) {
      flash('error', err.response?.data?.error || 'Rejection failed');
    } finally { setSaving(false); }
  };

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <div className="op-page">

      {/* Header */}
      <div className="op-header">
        <div>
          <h2>💰 {isOwner ? 'Payroll Approvals' : 'Payroll Management'}</h2>
          <p className="op-subtitle">
            {isOwner
              ? 'Review, approve, or reject payroll records submitted by the office manager.'
              : 'Record payroll for all staff, then submit to the owner for approval.'}
          </p>
        </div>
        {isOM && (
          <button className="op-btn op-btn-primary" onClick={openNew}>
            ➕ New Payroll Entry
          </button>
        )}
      </div>

      {/* Banner */}
      {banner.text && (
        <div style={{
          padding: '11px 16px', borderRadius: 8, fontWeight: 500, fontSize: '0.875rem',
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
          background: banner.type === 'success' ? '#ecfdf5' : '#fee2e2',
          border: `1px solid ${banner.type === 'success' ? '#a7f3d0' : '#fca5a5'}`,
          color: banner.type === 'success' ? '#047857' : '#b91c1c',
        }}>
          {banner.type === 'success' ? '✅' : '❌'} {banner.text}
          <button onClick={() => setBanner({ type: '', text: '' })}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'inherit' }}>×</button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="op-kpi-row">
        {[
          { label: 'Total Records',      value: kpi.total,                                   bg: '#f1f5f9', color: '#475569' },
          { label: 'Pending',            value: kpi.pending,                                  bg: '#fef3c7', color: '#92400e' },
          { label: 'Awaiting Approval',  value: kpi.submitted,                                bg: '#dbeafe', color: '#1d4ed8' },
          { label: 'Approved & Paid',    value: kpi.paid,                                     bg: '#dcfce7', color: '#15803d' },
          { label: 'Total Payroll (ETB)',value: `${kpi.totalNet.toLocaleString()}`,            bg: '#ede9fe', color: '#7c3aed' },
        ].map(k => (
          <div key={k.label} className="op-kpi" style={{ background: k.bg }}>
            <div className="op-kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="op-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Create / Edit Form (Office Manager only) ──────────────────── */}
      {showForm && isOM && (
        <div className="op-card">
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700 }}>
            {editId ? '✏️ Edit Payroll Record' : '➕ New Payroll Record'}
          </h3>
          <form className="op-form" onSubmit={handleSave} noValidate>

            <div className="op-form-row">
              {/* User — ALL active non-owner users */}
              <div className="op-field">
                <label className="op-label">Employee <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={form.userId}
                  onChange={e => setForm(p => ({ ...p, userId: e.target.value }))}
                  className="op-select" required>
                  <option value="">— Select Employee —</option>
                  {['admin', 'farmer', 'office_manager', 'labor'].map(role => {
                    const group = allUsers.filter(u => (u.assignedRole || u.role) === role);
                    if (!group.length) return null;
                    return (
                      <optgroup key={role} label={ROLE_LABEL[role]?.label || role}>
                        {group.map(u => (
                          <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>

              {/* Farm */}
              <div className="op-field">
                <label className="op-label">Farm <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={form.farmId}
                  onChange={e => setForm(p => ({ ...p, farmId: e.target.value }))}
                  className="op-select" required>
                  <option value="">— Select Farm —</option>
                  {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                </select>
              </div>

              {/* Period */}
              <div className="op-field">
                <label className="op-label">Period <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="month" value={form.period}
                  onChange={e => setForm(p => ({ ...p, period: e.target.value }))}
                  className="op-select" required />
              </div>
            </div>

            <div className="op-form-row">
              <div className="op-field">
                <label className="op-label">Base Salary (ETB) <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="number" min="0" value={form.baseSalary}
                  onChange={e => setForm(p => ({ ...p, baseSalary: e.target.value }))}
                  placeholder="e.g. 5000" className="op-select" required />
              </div>
              <div className="op-field">
                <label className="op-label">Bonus (ETB)</label>
                <input type="number" min="0" value={form.bonus}
                  onChange={e => setForm(p => ({ ...p, bonus: e.target.value }))}
                  className="op-select" />
              </div>
              <div className="op-field">
                <label className="op-label">Deductions (ETB)</label>
                <input type="number" min="0" value={form.deductions}
                  onChange={e => setForm(p => ({ ...p, deductions: e.target.value }))}
                  className="op-select" />
              </div>
            </div>

            {/* Net pay preview */}
            {netPreview !== null && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 12,
                background: '#ecfdf5', border: '1px solid #a7f3d0',
                fontWeight: 700, color: '#047857', fontSize: '0.9rem',
              }}>
                💵 Net Pay Preview: ETB {netPreview.toLocaleString()}
              </div>
            )}

            <div className="op-field">
              <label className="op-label">Notes</label>
              <textarea value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="op-select op-textarea" rows={2}
                placeholder="Optional notes or remarks…" />
            </div>

            <div className="op-form-actions">
              <button type="button" className="op-btn"
                style={{ background: '#f1f5f9', color: '#475569' }}
                onClick={() => { setShowForm(false); setEditId(null); }}>
                Cancel
              </button>
              <button type="submit" className="op-btn op-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editId ? '✅ Update Record' : '✅ Create Record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="op-controls" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="op-field" style={{ flex: '1 1 160px' }}>
          <label>Period</label>
          <input type="month" value={filterPeriod}
            onChange={e => setFilterPeriod(e.target.value)} className="op-select" />
        </div>
        <div className="op-field" style={{ flex: '1 1 160px' }}>
          <label>Farm</label>
          <select value={filterFarm} onChange={e => setFilterFarm(e.target.value)} className="op-select">
            <option value="">All Farms</option>
            {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
          </select>
        </div>
        <div className="op-field" style={{ flex: '1 1 160px' }}>
          <label>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="op-select">
            <option value="">All Statuses</option>
            {Object.entries(STATUS_META).map(([v, m]) => (
              <option key={v} value={v}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="op-field" style={{ flex: '2 1 220px' }}>
          <label>Search</label>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Name, email, farm, period…" className="op-select" />
        </div>
      </div>

      {/* ── Payroll Table ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="op-loading">Loading payroll records…</div>
      ) : filtered.length === 0 ? (
        <div className="op-empty">
          {records.length === 0
            ? `No payroll records for ${filterPeriod}.${isOM ? ' Click "New Payroll Entry" to add one.' : ''}`
            : 'No records match your filters.'}
        </div>
      ) : (
        <div className="op-card op-no-pad">
          <table className="op-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Farm</th>
                <th>Period</th>
                <th>Base (ETB)</th>
                <th>Bonus</th>
                <th>Deductions</th>
                <th>Net Pay (ETB)</th>
                <th>Days</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const sm   = STATUS_META[r.paymentStatus] || STATUS_META.pending;
                const role = r.userId?.assignedRole || r.userId?.role;
                const rm   = ROLE_LABEL[role] || { label: role || '—', color: '#475569', bg: '#f1f5f9' };
                return (
                  <tr key={r._id}>
                    <td>
                      <strong>{r.userId?.name || '—'}</strong>
                      <div className="op-sub">{r.userId?.email}</div>
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 12,
                        fontSize: '0.68rem', fontWeight: 700,
                        background: rm.bg, color: rm.color,
                      }}>
                        {rm.label}
                      </span>
                    </td>
                    <td>{r.farmId?.name || '—'}</td>
                    <td><code style={{ fontSize: '0.8rem' }}>{r.period}</code></td>
                    <td>{r.baseSalary?.toLocaleString()}</td>
                    <td style={{ color: '#15803d' }}>{r.bonus > 0 ? `+${r.bonus.toLocaleString()}` : '—'}</td>
                    <td style={{ color: '#b91c1c' }}>{r.deductions > 0 ? `-${r.deductions.toLocaleString()}` : '—'}</td>
                    <td>
                      <strong style={{ color: '#15803d', fontSize: '0.95rem' }}>
                        {r.netPay?.toLocaleString()}
                      </strong>
                    </td>
                    <td>{r.daysPresent ?? '—'}</td>
                    <td>
                      <span style={{
                        padding: '3px 9px', borderRadius: 12,
                        fontSize: '0.7rem', fontWeight: 700,
                        background: sm.bg, color: sm.color,
                      }}>
                        {sm.label}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>

                        {/* ── OFFICE MANAGER ACTIONS ── */}
                        {isOM && r.paymentStatus === 'pending' && (
                          <>
                            <button className="op-btn-sm op-btn-submit"
                              onClick={() => handleSubmit(r._id)}
                              title="Submit for owner approval">
                              📤 Submit
                            </button>
                            <button className="op-btn-sm op-btn-edit"
                              onClick={() => openEdit(r)}
                              title="Edit">✏️</button>
                            <button className="op-btn-sm op-btn-del"
                              onClick={() => handleDelete(r._id)}
                              title="Delete">🗑️</button>
                          </>
                        )}
                        {isOM && r.paymentStatus === 'submitted' && (
                          <span style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 600 }}>
                            ⏳ Awaiting owner
                          </span>
                        )}
                        {isOM && r.paymentStatus === 'paid' && (
                          <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
                            ✅ Approved
                          </span>
                        )}

                        {/* ── OWNER ACTIONS ── */}
                        {isOwner && r.paymentStatus === 'submitted' && (
                          <>
                            <button className="op-btn-sm op-btn-approve"
                              onClick={() => handleApprove(r._id)}
                              disabled={saving}
                              title="Approve and process payment">
                              ✅ Approve
                            </button>
                            <button className="op-btn-sm op-btn-reject"
                              onClick={() => handleReject(r._id)}
                              disabled={saving}
                              title="Reject — returns to office manager">
                              ❌ Reject
                            </button>
                          </>
                        )}
                        {isOwner && r.paymentStatus === 'pending' && (
                          <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>
                            ⚠ Not submitted
                          </span>
                        )}
                        {isOwner && r.paymentStatus === 'paid' && (
                          <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
                            ✅ Approved by you
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Totals footer */}
            <tfoot>
              <tr style={{ background: 'var(--surface-hover)', fontWeight: 700 }}>
                <td colSpan={7} style={{ padding: '10px 14px', textAlign: 'right', fontSize: '0.85rem' }}>
                  Totals ({filtered.length} records):
                </td>
                <td style={{ padding: '10px 14px', color: '#15803d', fontSize: '0.95rem' }}>
                  ETB {filtered.reduce((s, r) => s + (r.netPay || 0), 0).toLocaleString()}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  {filtered.reduce((s, r) => s + (r.daysPresent || 0), 0)} days
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Processed by / approved by footer note */}
      {filtered.some(r => r.approvedBy) && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
          Approved records show the approving owner in the approval audit trail.
        </div>
      )}
    </div>
  );
}
