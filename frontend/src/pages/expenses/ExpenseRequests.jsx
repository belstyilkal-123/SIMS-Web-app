/**
 * Expense Requests Page
 * 
 * Role-based features:
 * - Owner: View all, approve, process, cancel any
 * - Office Manager: View all, create, process, cancel own
 * - Farmer: View own, create, upload receipt, cancel own pending
 */

import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { buildPdf } from '../../utils/pdfUtils';
import './Expenses.css';

// ── Status color mappings ─────────────────────────────────────────────────
const STATUS_META = {
  pending:   { bg: '#fef3c7', color: '#92400e', icon: '⏳', label: 'Pending Approval' },
  approved:  { bg: '#dbeafe', color: '#1d4ed8', icon: '✅', label: 'Approved' },
  processed: { bg: '#dcfce7', color: '#15803d', icon: '💰', label: 'Paid' },
  rejected:  { bg: '#fee2e2', color: '#b91c1c', icon: '❌', label: 'Rejected' },
  cancelled: { bg: '#f1f5f9', color: '#475569', icon: '🚫', label: 'Cancelled' },
};

const CATEGORY_META = {
  seeds:      { icon: '🌱', label: 'Seeds & Seedlings' },
  fertilizer: { icon: '🧪', label: 'Fertilizer' },
  pesticides: { icon: '🐛', label: 'Pesticides' },
  equipment:  { icon: '🔧', label: 'Equipment' },
  maintenance:{ icon: '🛠️', label: 'Maintenance' },
  labor:      { icon: '👷', label: 'Labor' },
  transport:  { icon: '🚚', label: 'Transport' },
  utilities:  { icon: '💡', label: 'Utilities' },
  other:      { icon: '📦', label: 'Other' },
};

const PRIORITY_META = {
  low:    { bg: '#f1f5f9', color: '#64748b', icon: '🔹' },
  normal: { bg: '#e0f2fe', color: '#0369a1', icon: '◾' },
  high:   { bg: '#fef3c7', color: '#92400e', icon: '🔶' },
  urgent: { bg: '#fee2e2', color: '#b91c1c', icon: '🔴' },
};

export default function ExpenseRequests() {
  const { user, logout } = useContext(AuthContext);
  const token = user?.token || (typeof window !== 'undefined' && JSON.parse(localStorage.getItem('userInfo') || '{}')?.token);
  const cfg = useMemo(() => ({
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);
  const fileRef = useRef(null);

  const userRole = user?.assignedRole || user?.role;
  const isOwner = userRole === 'owner';
  const isOM = userRole === 'office_manager';
  const isFarmer = userRole === 'farmer';
  const canApprove = isOwner; // Only owner can approve
  const canProcess = isOwner || isOM;
  const canViewAll = isOwner || isOM;
  const canCreate = isOM || isFarmer;

  // ── State ───────────────────────────────────────────────────────────────
  const [expenses, setExpenses] = useState([]);
  const [farms, setFarms] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFarm, setFilterFarm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    title: '', description: '', category: 'other', amount: '',
    farmId: '', expenseDate: new Date().toISOString().slice(0, 10), dueDate: '', priority: 'normal',
    notes: '', receiptImage: '', receiptNote: '',
  });

  // Action modals
  const [approveModal, setApproveModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [processModal, setProcessModal] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);

  // ── Load data ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const activeToken = user?.token || (typeof window !== 'undefined' && JSON.parse(localStorage.getItem('userInfo') || '{}')?.token);
    if (!activeToken) {
      setLoading(false);
      return;
    }
    const requestConfig = { headers: { Authorization: `Bearer ${activeToken}` } };
    setLoading(true);
    let hasAuthError = false;

    // Fetch farms and expenses independently — a stats error must never block the farm dropdown
    try {
      let farmData = [];
      try {
        if (isFarmer) {
          // Try the dedicated /my-farm endpoint first
          const r = await axios.get(`${API_URL}/api/farms/my-farm`, requestConfig);
          farmData = r.data ? (Array.isArray(r.data) ? r.data : [r.data]) : [];
        }
        if (farmData.length === 0) {
          // Fallback for all roles (or if /my-farm returned nothing)
          const r = await axios.get(`${API_URL}/api/farms`, requestConfig);
          farmData = Array.isArray(r.data) ? r.data : [];
        }
      } catch (farmErr) {
        console.error('Farm fetch failed:', farmErr.message);
        if (farmErr.response?.status === 401) hasAuthError = true;
      }
      setFarms(farmData);
      if (farmData.length > 0) {
        setForm(p => ({ ...p, farmId: p.farmId || farmData[0]._id }));
      }
    } catch { /* ignore */ }

    // Fetch expenses
    try {
      const r = await axios.get(`${API_URL}/api/expenses`, requestConfig);
      setExpenses(r.data || []);
      setError('');
    } catch (e) {
      if (e.response?.status === 401) hasAuthError = true;
      setError(e.response?.data?.error || 'Failed to load expenses');
    }

    if (hasAuthError) {
      setError('Session expired or unauthorized. Please log out and log in again.');
    }

    // Fetch stats — optional, failure is silent
    try {
      const r = await axios.get(`${API_URL}/api/expenses/stats`, requestConfig);
      setStats(r.data || {});
    } catch { /* stats failure is non-fatal */ }

    setLoading(false);
  }, [user?.token, isFarmer]);

  useEffect(() => {
    load();
  }, [load]);

  // Always keep farmId in sync if empty and farms are available
  useEffect(() => {
    if (farms.length > 0 && !form.farmId) {
      setForm(p => ({ ...p, farmId: farms[0]._id }));
    }
  }, [farms, form.farmId]);

  // ── Filtered expenses ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return expenses.filter(e => {
      if (filterStatus && e.status !== filterStatus) return false;
      if (filterFarm && e.farmId?._id !== filterFarm) return false;
      if (filterCategory && e.category !== filterCategory) return false;
      if (q) {
        const hay = [e.title, e.description, e.farmId?.name, e.requestedBy?.name].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, filterStatus, filterFarm, filterCategory, search]);

  // ── KPI totals ────────────────────────────────────────────────────────────
  const kpi = {
    total: expenses.length,
    pending: expenses.filter(e => e.status === 'pending').length,
    pendingAmount: expenses.filter(e => e.status === 'pending').reduce((s, e) => s + (e.amount || 0), 0),
    approved: expenses.filter(e => e.status === 'approved').length,
    approvedAmount: expenses.filter(e => e.status === 'approved').reduce((s, e) => s + (e.amount || 0), 0),
    processed: expenses.filter(e => e.status === 'processed').length,
    processedAmount: expenses.filter(e => e.status === 'processed').reduce((s, e) => s + (e.amount || 0), 0),
  };

  // ── Form handlers ─────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm(p => ({ ...p, receiptImage: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    const defaultFarm = farms.length > 0 ? farms[0]._id : '';
    setForm({
      title: '', description: '', category: 'other', amount: '',
      farmId: defaultFarm,
      expenseDate: new Date().toISOString().slice(0, 10),
      dueDate: '', priority: 'normal', notes: '', receiptImage: '', receiptNote: '',
    });
    setEditId(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const effectiveFarmId = form.farmId || (farms.length === 1 ? farms[0]._id : '');

    if (!form.title || !form.amount || !effectiveFarmId) {
      setError('Title, amount, and farm are required.');
      return;
    }
    // Sync form.farmId in case it was empty
    if (effectiveFarmId !== form.farmId) {
      setForm(p => ({ ...p, farmId: effectiveFarmId }));
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = {
        ...form,
        farmId: effectiveFarmId,   // always use the resolved farm id
        amount: Number(form.amount),
        expenseDate: form.expenseDate || new Date().toISOString().slice(0, 10),
      };
      if (!payload.dueDate) delete payload.dueDate;

      if (editId) {
        await axios.put(`${API_URL}/api/expenses/${editId}`, payload, cfg);
        setSuccess('Expense updated successfully.');
      } else {
        await axios.post(`${API_URL}/api/expenses`, payload, cfg);
        setSuccess('Expense request submitted.');
      }
      setShowForm(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (exp) => {
    setEditId(exp._id);
    setForm({
      title: exp.title,
      description: exp.description || '',
      category: exp.category || 'other',
      amount: String(exp.amount),
      farmId: exp.farmId?._id || exp.farmId,
      expenseDate: exp.expenseDate?.slice(0, 10) || '',
      dueDate: exp.dueDate?.slice(0, 10) || '',
      priority: exp.priority || 'normal',
      notes: exp.notes || '',
      receiptImage: exp.receiptImage || '',
      receiptNote: exp.receiptNote || '',
    });
    setShowForm(true);
  };

  // ── Action handlers ───────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!approveModal) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/expenses/${approveModal._id}/approve`, {
        notes: approveModal.approvalNotes || '',
      }, cfg);
      setSuccess('Expense approved.');
      setApproveModal(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Approval failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/expenses/${rejectModal._id}/reject`, {
        reason: rejectModal.reason || 'No reason provided',
      }, cfg);
      setSuccess('Expense rejected.');
      setRejectModal(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Rejection failed');
    } finally {
      setSaving(false);
    }
  };

  const handleProcess = async () => {
    if (!processModal) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/expenses/${processModal._id}/process`, {
        transactionRef: processModal.transactionRef || '',
      }, cfg);
      setSuccess('Payment processed.');
      setProcessModal(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Processing failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/expenses/${cancelModal._id}/cancel`, {
        reason: cancelModal.reason || '',
      }, cfg);
      setSuccess('Expense cancelled.');
      setCancelModal(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Cancellation failed');
    } finally {
      setSaving(false);
    }
  };

  // ── PDF Export ────────────────────────────────────────────────────────────
  const exportPdf = () => {
    buildPdf({
      title: 'Expense Report',
      subtitle: `${filtered.length} expenses · Total: ETB ${filtered.reduce((s, e) => s + (e.amount || 0), 0).toLocaleString()}`,
      columns: ['Title', 'Category', 'Farm', 'Amount (ETB)', 'Status', 'Requested By', 'Date'],
      rows: filtered.map(e => [
        e.title,
        e.category,
        e.farmId?.name || '—',
        e.amount?.toLocaleString(),
        e.status,
        e.requestedBy?.name || '—',
        e.expenseDate?.slice(0, 10) || '—',
      ]),
      fileName: `expenses_${new Date().toISOString().slice(0, 10)}`,
      orientation: 'l',
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <div className="ex-loading">Loading expenses…</div>;

  return (
    <div className="ex-page">
      {/* Header */}
        <div className="ex-header">
          <div>
            <h2>{isOwner ? '✅ Expense Request Approval' : '💵 Expense Requests'}</h2>
            <p className="ex-subtitle">
              {canViewAll ? 'Manage and track all expense requests across farms.'
                : 'View and manage your expense requests.'}
            </p>
          </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canCreate && (
            <button className="ex-btn ex-btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
              ➕ New Request
            </button>
          )}
          <button className="ex-btn ex-btn-danger" onClick={exportPdf} disabled={filtered.length === 0}>
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="ex-error">{error}<button onClick={() => setError('')}>×</button></div>}
      {success && <div className="ex-success">{success}<button onClick={() => setSuccess('')}>×</button></div>}

      {/* KPI Strip */}
      <div className="ex-kpi-row">
        {[
          { icon: '⏳', label: 'Pending Approval', value: kpi.pending, amount: kpi.pendingAmount, bg: '#fef3c7', color: '#92400e' },
          { icon: '✅', label: 'Approved', value: kpi.approved, amount: kpi.approvedAmount, bg: '#dbeafe', color: '#1d4ed8' },
          { icon: '💰', label: 'Paid', value: kpi.processed, amount: kpi.processedAmount, bg: '#dcfce7', color: '#15803d' },
          { icon: '📊', label: 'Total Requests', value: kpi.total, bg: '#ede9fe', color: '#7c3aed' },
        ].map(k => (
          <div key={k.label} className="ex-kpi" style={{ background: k.bg }}>
            <span className="ex-kpi-icon">{k.icon}</span>
            <div className="ex-kpi-value" style={{ color: k.color }}>{k.value}</div>
            {k.amount !== undefined && (
              <div className="ex-kpi-amount">ETB {k.amount.toLocaleString()}</div>
            )}
            <div className="ex-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="ex-filters">
        <input
          className="ex-input ex-search"
          placeholder="Search expenses…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="ex-input ex-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {canViewAll && farms.length > 0 && (
          <select className="ex-input ex-select" value={filterFarm} onChange={e => setFilterFarm(e.target.value)}>
            <option value="">All Farms</option>
            {farms.map(f => (
              <option key={f._id} value={f._id}>{f.name}</option>
            ))}
          </select>
        )}
        <select className="ex-input ex-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_META).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <span className="ex-count">{filtered.length} records</span>
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="ex-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="ex-modal" onClick={e => e.stopPropagation()}>
            <h3>{editId ? '✏️ Edit Expense' : '➕ New Expense Request'}</h3>
            <form onSubmit={handleSubmit} className="ex-form">
              <div className="ex-form-row">
                <div className="ex-field">
                  <label>Title *</label>
                  <input
                    className="ex-input"
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Fertilizer purchase"
                  />
                </div>
                <div className="ex-field">
                  <label>Category *</label>
                  <select
                    className="ex-input"
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  >
                    {Object.entries(CATEGORY_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ex-form-row">
                <div className="ex-field">
                  <label>Amount (ETB) *</label>
                  <input
                    type="number"
                    className="ex-input"
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div className="ex-field">
                  <label>Farm *</label>
                  {farms.length === 1 ? (
                    /* Single farm available — show locked badge */
                    <>
                      <div className="ex-input" style={{
                        background: 'var(--surface-hover)',
                        color: 'var(--text-main)',
                        cursor: 'default',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        userSelect: 'none',
                      }}>
                        🌾 {farms[0].name}
                      </div>
                      <input type="hidden" value={farms[0]._id} />
                    </>
                  ) : farms.length === 0 ? (
                    /* No farm assigned or found */
                    <div className="ex-input" style={{ color: '#b91c1c', background: '#fee2e2', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>⚠ No farm found. If you are a farmer, ask the owner to assign you to a farm.</span>
                      <button
                        type="button"
                        onClick={() => load()}
                        style={{ marginLeft: 8, background: 'none', border: '1px solid #b91c1c', borderRadius: 6,
                          padding: '2px 10px', cursor: 'pointer', color: '#b91c1c', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        🔄 Reload
                      </button>
                    </div>
                  ) : (
                    <select
                      className="ex-input"
                      value={form.farmId || ''}
                      onChange={e => setForm(p => ({ ...p, farmId: e.target.value }))}
                      required
                    >
                      <option value="">Select farm…</option>
                      {farms.map(f => (
                        <option key={f._id} value={f._id}>{f.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="ex-form-row">
                <div className="ex-field">
                  <label>Expense Date</label>
                  <input
                    type="date"
                    className="ex-input"
                    value={form.expenseDate}
                    onChange={e => setForm(p => ({ ...p, expenseDate: e.target.value }))}
                  />
                </div>
                <div className="ex-field">
                  <label>Due Date (optional)</label>
                  <input
                    type="date"
                    className="ex-input"
                    value={form.dueDate}
                    onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                  />
                </div>
                <div className="ex-field">
                  <label>Priority</label>
                  <select
                    className="ex-input"
                    value={form.priority}
                    onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                  >
                    {Object.entries(PRIORITY_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {k.charAt(0).toUpperCase() + k.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ex-field">
                <label>Description</label>
                <textarea
                  className="ex-input ex-textarea"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe the expense…"
                  rows={2}
                />
              </div>

              <div className="ex-field">
                <label>Upload Receipt (optional)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  ref={fileRef}
                  onChange={handleFileChange}
                  style={{ fontSize: '0.84rem' }}
                />
                {form.receiptImage && (
                  <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#15803d' }}>
                    ✅ Receipt attached
                  </div>
                )}
              </div>

              <div className="ex-field">
                <label>Receipt Note</label>
                <input
                  className="ex-input"
                  value={form.receiptNote}
                  onChange={e => setForm(p => ({ ...p, receiptNote: e.target.value }))}
                  placeholder="Reference or notes about the receipt"
                />
              </div>

              <div className="ex-field">
                <label>Additional Notes</label>
                <textarea
                  className="ex-input ex-textarea"
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any additional information…"
                  rows={2}
                />
              </div>

              <div className="ex-form-actions">
                <button type="submit" className="ex-btn ex-btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editId ? 'Update Request' : 'Submit Request'}
                </button>
                <button type="button" className="ex-btn ex-btn-ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense List */}
      {filtered.length === 0 ? (
        <div className="ex-empty">No expense requests found.</div>
      ) : (
        <div className="ex-list">
          {filtered.map(exp => {
            const statusMeta = STATUS_META[exp.status] || STATUS_META.pending;
            const categoryMeta = CATEGORY_META[exp.category] || CATEGORY_META.other;
            const priorityMeta = PRIORITY_META[exp.priority] || PRIORITY_META.normal;
            const canEdit = ['pending'].includes(exp.status) && (
              isOwner || (isOM && exp.requestedBy?._id === user._id) || (isFarmer && exp.requestedBy?._id === user._id)
            );
            const canCancelExp = ['pending', 'approved'].includes(exp.status) && (
              isOwner || (isOM && exp.requestedBy?._id === user._id) || (isFarmer && exp.requestedBy?._id === user._id)
            );

            return (
              <div key={exp._id} className="ex-card" style={{ borderLeftColor: priorityMeta.color }}>
                <div className="ex-card-header">
                  <div className="ex-card-title">
                    <span className="ex-category-icon">{categoryMeta.icon}</span>
                    <strong>{exp.title}</strong>
                    <span className="ex-badge" style={{ background: statusMeta.bg, color: statusMeta.color }}>
                      {statusMeta.icon} {statusMeta.label}
                    </span>
                    <span className="ex-priority" style={{ background: priorityMeta.bg, color: priorityMeta.color }}>
                      {priorityMeta.icon}
                    </span>
                  </div>
                  <div className="ex-card-amount">ETB {exp.amount?.toLocaleString()}</div>
                </div>

                <div className="ex-card-body">
                  <div className="ex-card-meta">
                    <span>🌾 {exp.farmId?.name || '—'}</span>
                    <span>📅 {exp.expenseDate?.slice(0, 10)}</span>
                    {exp.dueDate && <span>⏰ Due: {exp.dueDate.slice(0, 10)}</span>}
                    {canViewAll && exp.requestedBy && (
                      <span>👤 {exp.requestedBy.name}</span>
                    )}
                  </div>
                  {exp.description && (
                    <p className="ex-card-desc">{exp.description}</p>
                  )}
                  {exp.receiptImage && (
                    <div className="ex-receipt-tag">📎 Receipt attached</div>
                  )}
                  {exp.approvedBy && (
                    <div className="ex-approval-info">
                      ✅ Approved by {exp.approvedBy.name} on {exp.approvedAt ? new Date(exp.approvedAt).toLocaleDateString() : '—'}
                    </div>
                  )}
                  {exp.rejectionReason && (
                    <div className="ex-rejection-info">
                      ❌ Rejected: {exp.rejectionReason}
                    </div>
                  )}
                </div>

                <div className="ex-card-actions">
                  {canEdit && (
                    <button className="ex-btn ex-btn-small" onClick={() => handleEdit(exp)}>✏️ Edit</button>
                  )}
                  {canApprove && exp.status === 'pending' && (
                    <>
                      <button className="ex-btn ex-btn-small ex-btn-approve" onClick={() => setApproveModal(exp)}>✅ Approve</button>
                      <button className="ex-btn ex-btn-small ex-btn-reject" onClick={() => setRejectModal(exp)}>❌ Reject</button>
                    </>
                  )}
                  {canProcess && exp.status === 'approved' && (
                    <button className="ex-btn ex-btn-small ex-btn-process" onClick={() => setProcessModal(exp)}>💸 Process Payment</button>
                  )}
                  {canCancelExp && (
                    <button className="ex-btn ex-btn-small ex-btn-cancel" onClick={() => setCancelModal(exp)}>🚫 Cancel</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approve Modal */}
      {approveModal && (
        <div className="ex-modal-overlay" onClick={() => setApproveModal(null)}>
          <div className="ex-modal ex-modal-small" onClick={e => e.stopPropagation()}>
            <h3>✅ Approve Expense</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Approve <strong>{approveModal.title}</strong> for <strong>ETB {approveModal.amount?.toLocaleString()}</strong>?
            </p>
            <div className="ex-field">
              <label>Approval Notes (optional)</label>
              <input
                className="ex-input"
                value={approveModal.approvalNotes || ''}
                onChange={e => setApproveModal(p => ({ ...p, approvalNotes: e.target.value }))}
                placeholder="Any notes for the requester"
              />
            </div>
            <div className="ex-form-actions">
              <button className="ex-btn ex-btn-primary" disabled={saving} onClick={handleApprove}>
                {saving ? 'Approving…' : 'Confirm Approval'}
              </button>
              <button className="ex-btn ex-btn-ghost" onClick={() => setApproveModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="ex-modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="ex-modal ex-modal-small" onClick={e => e.stopPropagation()}>
            <h3>❌ Reject Expense</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Reject <strong>{rejectModal.title}</strong>?
            </p>
            <div className="ex-field">
              <label>Rejection Reason</label>
              <input
                className="ex-input"
                value={rejectModal.reason || ''}
                onChange={e => setRejectModal(p => ({ ...p, reason: e.target.value }))}
                placeholder="Explain why this is being rejected"
              />
            </div>
            <div className="ex-form-actions">
              <button className="ex-btn ex-btn-danger" disabled={saving} onClick={handleReject}>
                {saving ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
              <button className="ex-btn ex-btn-ghost" onClick={() => setRejectModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Process Payment Modal */}
      {processModal && (
        <div className="ex-modal-overlay" onClick={() => setProcessModal(null)}>
          <div className="ex-modal ex-modal-small" onClick={e => e.stopPropagation()}>
            <h3>💸 Process Payment</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Mark <strong>{processModal.title}</strong> (ETB {processModal.amount?.toLocaleString()}) as paid?
            </p>
            <div className="ex-field">
              <label>Transaction Reference (optional)</label>
              <input
                className="ex-input"
                value={processModal.transactionRef || ''}
                onChange={e => setProcessModal(p => ({ ...p, transactionRef: e.target.value }))}
                placeholder="Bank transfer ref, receipt #, etc."
              />
            </div>
            <div className="ex-form-actions">
              <button className="ex-btn ex-btn-primary" disabled={saving} onClick={handleProcess}>
                {saving ? 'Processing…' : 'Confirm Payment'}
              </button>
              <button className="ex-btn ex-btn-ghost" onClick={() => setProcessModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="ex-modal-overlay" onClick={() => setCancelModal(null)}>
          <div className="ex-modal ex-modal-small" onClick={e => e.stopPropagation()}>
            <h3>🚫 Cancel Expense</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Cancel <strong>{cancelModal.title}</strong>?
            </p>
            <div className="ex-field">
              <label>Reason (optional)</label>
              <input
                className="ex-input"
                value={cancelModal.reason || ''}
                onChange={e => setCancelModal(p => ({ ...p, reason: e.target.value }))}
                placeholder="Reason for cancellation"
              />
            </div>
            <div className="ex-form-actions">
              <button className="ex-btn ex-btn-danger" disabled={saving} onClick={handleCancel}>
                {saving ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
              <button className="ex-btn ex-btn-ghost" onClick={() => setCancelModal(null)}>Back</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
