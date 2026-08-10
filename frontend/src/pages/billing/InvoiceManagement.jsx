import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { buildPdf } from '../../utils/pdfUtils';
import './Billing.css';

const STATUS_COLORS = {
  pending:        { bg:'#fef3c7', color:'#92400e' },
  partially_paid: { bg:'#dbeafe', color:'#1e40af' },
  paid:           { bg:'#dcfce7', color:'#15803d' },
  overdue:        { bg:'#fee2e2', color:'#b91c1c' },
  cancelled:      { bg:'#f1f5f9', color:'#475569' },
};

const emptyForm = {
  farmId:'', farmOwnerId:'',
  periodStart:'', periodEnd:'',
  waterUsedLitres:'', ratePerLitre:'',
  maintenanceFee:'0', serviceCharge:'0', tax:'0', discount:'0',
  dueDate:'', notes:'',
};

export default function InvoiceManagement() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const [invoices, setInvoices]     = useState([]);
  const [farms, setFarms]           = useState([]);
  const [farmers, setFarmers]       = useState([]);
  const [stats, setStats]           = useState({});
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editId, setEditId]         = useState(null);
  const [form, setForm]             = useState(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFarm,   setFilterFarm]   = useState('');
  const [search,       setSearch]       = useState('');
  // Payment modal
  const [payModal, setPayModal]     = useState(null); // invoice object
  const [payAmount, setPayAmount]   = useState('');

  const load = async () => {
    try {
      const [inv, f, u, s] = await Promise.all([
        axios.get(`${API_URL}/api/billing`, cfg),
        axios.get(`${API_URL}/api/farms`, cfg),
        axios.get(`${API_URL}/api/admin/users?role=farmer`, cfg),
        axios.get(`${API_URL}/api/billing/stats/summary`, cfg),
      ]);
      setInvoices(inv.data);
      setFarms(f.data);
      setFarmers(u.data);
      setStats(s.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  /* computed net preview */
  const previewTotal = useMemo(() => {
    const w  = (Number(form.waterUsedLitres) || 0) * (Number(form.ratePerLitre) || 0);
    const mf = Number(form.maintenanceFee) || 0;
    const sc = Number(form.serviceCharge)  || 0;
    const tx = Number(form.tax)            || 0;
    const dc = Number(form.discount)       || 0;
    return Math.max(0, w + mf + sc + tx - dc);
  }, [form]);

  const handleSave = async e => {
    e.preventDefault();
    if (!form.farmId || !form.farmOwnerId || !form.periodStart || !form.periodEnd) {
      setError('Farm, farm owner, period start and end are required.'); return;
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = { ...form };
      if (!payload.dueDate) delete payload.dueDate;
      editId
        ? await axios.put(`${API_URL}/api/billing/${editId}`, payload, cfg)
        : await axios.post(`${API_URL}/api/billing`, payload, cfg);
      setSuccess(editId ? 'Invoice updated.' : 'Invoice generated.');
      setForm(emptyForm); setEditId(null); setShowForm(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleEdit = inv => {
    setEditId(inv._id);
    setForm({
      farmId:          inv.farmId?._id      || '',
      farmOwnerId:     inv.farmOwnerId?._id || '',
      periodStart:     inv.periodStart?.slice(0,10) || '',
      periodEnd:       inv.periodEnd?.slice(0,10)   || '',
      waterUsedLitres: String(inv.waterUsedLitres),
      ratePerLitre:    String(inv.ratePerLitre),
      maintenanceFee:  String(inv.maintenanceFee),
      serviceCharge:   String(inv.serviceCharge),
      tax:             String(inv.tax),
      discount:        String(inv.discount),
      dueDate:         inv.dueDate?.slice(0,10) || '',
      notes:           inv.notes || '',
    });
    setShowForm(true); setError(''); setSuccess('');
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  const handleMarkPaid = async () => {
    if (!payAmount || Number(payAmount) <= 0) { setError('Enter a valid amount.'); return; }
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/billing/${payModal._id}`,
        { paidAmount: Number(payAmount), paymentStatus: 'paid' }, cfg);
      setPayModal(null); setPayAmount('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Payment update failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this invoice?')) return;
    await axios.delete(`${API_URL}/api/billing/${id}`, cfg);
    await load();
  };

  const handleExportPdf = () => {
    buildPdf({
      title:    'Invoice Report',
      subtitle: `${filtered.length} invoices  ·  Total Revenue: ETB ${(stats.totalRevenue||0).toLocaleString()}  ·  Outstanding: ETB ${(stats.outstandingAmount||0).toLocaleString()}`,
      columns:  ['Invoice #','Farm','Owner','Period','Water (L)','Total (ETB)','Paid (ETB)','Status','Due Date'],
      rows: filtered.map(inv => [
        inv.invoiceNumber,
        inv.farmId?.name      || '—',
        inv.farmOwnerId?.name || '—',
        `${inv.periodStart?.slice(0,10)} → ${inv.periodEnd?.slice(0,10)}`,
        inv.waterUsedLitres?.toLocaleString(),
        inv.totalAmount?.toLocaleString(),
        inv.paidAmount?.toLocaleString(),
        inv.paymentStatus.replace('_',' '),
        inv.dueDate ? inv.dueDate.slice(0,10) : '—',
      ]),
      totalsRow: [
        'TOTALS', '', '', '', '',
        filtered.reduce((s,i)=>s+(i.totalAmount||0),0).toLocaleString(),
        filtered.reduce((s,i)=>s+(i.paidAmount||0),0).toLocaleString(),
        '', '',
      ],
      fileName:    `invoices_${new Date().toISOString().slice(0,10)}`,
      orientation: 'l',
    });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter(inv => {
      if (filterStatus && inv.paymentStatus !== filterStatus) return false;
      if (filterFarm   && (inv.farmId?._id||inv.farmId) !== filterFarm) return false;
      if (q) {
        const hay = [inv.invoiceNumber, inv.farmId?.name, inv.farmOwnerId?.name].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, filterStatus, filterFarm, search]);

  if (loading) return <div className="bl-loading">Loading invoices…</div>;

  return (
    <div className="bl-page">

      {/* Header */}
      <div className="bl-header">
        <div>
          <h2>🧾 Invoice Management</h2>
          <p className="bl-subtitle">Generate water bills and track payment status.</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="bl-btn bl-btn-primary"
            onClick={() => { setShowForm(v=>!v); setEditId(null); setForm(emptyForm); setError(''); setSuccess(''); }}>
            {showForm ? '✕ Cancel' : '➕ New Invoice'}
          </button>
          <button className="bl-btn" style={{ background:'#dc2626', color:'white' }}
            onClick={handleExportPdf} disabled={filtered.length===0}>
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="bl-kpi-row">
        {[
          { label:'Pending',     value: `ETB ${(stats.outstandingAmount||0).toLocaleString()}`, bg:'#fef3c7', color:'#92400e' },
          { label:'Total Revenue',value:`ETB ${(stats.totalRevenue||0).toLocaleString()}`,      bg:'#dcfce7', color:'#15803d' },
          { label:'Overdue',     value: stats.overdue  || 0,                                   bg:'#fee2e2', color:'#b91c1c' },
          { label:'Paid',        value: stats.paid     || 0,                                   bg:'#dcfce7', color:'#15803d' },
          { label:'Total',       value: invoices.length,                                        bg:'#dbeafe', color:'#1d4ed8' },
        ].map(k => (
          <div key={k.label} className="bl-kpi" style={{ background:k.bg }}>
            <div className="bl-kpi-value" style={{ color:k.color }}>{k.value}</div>
            <div className="bl-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="bl-card">
          <h3>{editId ? '✏️ Edit Invoice' : '➕ Generate Invoice'}</h3>
          {error   && <div className="bl-error"   style={{ marginBottom:12 }}>{error}</div>}
          {success && <div className="bl-success" style={{ marginBottom:12 }}>{success}</div>}
          <form className="bl-form" onSubmit={handleSave}>
            <div className="bl-form-row">
              <div className="bl-field">
                <label>Farm *</label>
                <select value={form.farmId} onChange={e=>setForm(p=>({...p,farmId:e.target.value}))} className="bl-input">
                  <option value="">Select farm…</option>
                  {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                </select>
              </div>
              <div className="bl-field">
                <label>Farm Owner *</label>
                <select value={form.farmOwnerId} onChange={e=>setForm(p=>({...p,farmOwnerId:e.target.value}))} className="bl-input">
                  <option value="">Select owner…</option>
                  {farmers.map(u => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <div className="bl-field">
                <label>Period Start *</label>
                <input type="date" value={form.periodStart} onChange={e=>setForm(p=>({...p,periodStart:e.target.value}))} className="bl-input" />
              </div>
              <div className="bl-field">
                <label>Period End *</label>
                <input type="date" value={form.periodEnd} onChange={e=>setForm(p=>({...p,periodEnd:e.target.value}))} className="bl-input" />
              </div>
              <div className="bl-field">
                <label>Due Date</label>
                <input type="date" value={form.dueDate} onChange={e=>setForm(p=>({...p,dueDate:e.target.value}))} className="bl-input" />
              </div>
            </div>
            <div className="bl-form-row">
              <div className="bl-field">
                <label>Water Used (Litres)</label>
                <input type="number" min="0" value={form.waterUsedLitres}
                  onChange={e=>setForm(p=>({...p,waterUsedLitres:e.target.value}))} className="bl-input" placeholder="0" />
              </div>
              <div className="bl-field">
                <label>Rate / Litre (ETB)</label>
                <input type="number" min="0" step="0.01" value={form.ratePerLitre}
                  onChange={e=>setForm(p=>({...p,ratePerLitre:e.target.value}))} className="bl-input" placeholder="0.00" />
              </div>
              <div className="bl-field">
                <label>Maintenance Fee</label>
                <input type="number" min="0" value={form.maintenanceFee}
                  onChange={e=>setForm(p=>({...p,maintenanceFee:e.target.value}))} className="bl-input" />
              </div>
              <div className="bl-field">
                <label>Service Charge</label>
                <input type="number" min="0" value={form.serviceCharge}
                  onChange={e=>setForm(p=>({...p,serviceCharge:e.target.value}))} className="bl-input" />
              </div>
              <div className="bl-field">
                <label>Tax (ETB)</label>
                <input type="number" min="0" value={form.tax}
                  onChange={e=>setForm(p=>({...p,tax:e.target.value}))} className="bl-input" />
              </div>
              <div className="bl-field">
                <label>Discount (ETB)</label>
                <input type="number" min="0" value={form.discount}
                  onChange={e=>setForm(p=>({...p,discount:e.target.value}))} className="bl-input" />
              </div>
            </div>

            {/* Net preview */}
            {(form.waterUsedLitres || form.maintenanceFee !== '0') && (
              <div className="bl-net-preview">
                Estimated Total: <strong>ETB {previewTotal.toLocaleString()}</strong>
                {form.waterUsedLitres && form.ratePerLitre && (
                  <span style={{ marginLeft:12, fontSize:'0.82rem', opacity:0.8 }}>
                    (Water: {(Number(form.waterUsedLitres)*Number(form.ratePerLitre)).toLocaleString()} + fees − discount)
                  </span>
                )}
              </div>
            )}

            <div className="bl-field bl-field-wide">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}
                className="bl-input bl-textarea" placeholder="Optional billing notes…" />
            </div>

            <div className="bl-form-actions">
              <button type="submit" className="bl-btn bl-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update Invoice' : 'Generate Invoice'}
              </button>
              {editId && (
                <button type="button" className="bl-btn bl-btn-ghost"
                  onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bl-filters">
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search invoice #, farm, owner…" className="bl-input bl-input-search" />
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="bl-input bl-select">
          <option value="">All Statuses</option>
          {['pending','partially_paid','paid','overdue','cancelled'].map(s =>
            <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
        <select value={filterFarm} onChange={e=>setFilterFarm(e.target.value)} className="bl-input bl-select">
          <option value="">All Farms</option>
          {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
        </select>
        <span className="bl-count">{filtered.length} invoices</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bl-empty">No invoices found. Generate one above.</div>
      ) : (
        <div className="bl-card bl-no-pad">
          <table className="bl-table">
            <thead>
              <tr>
                <th>Invoice #</th><th>Farm</th><th>Owner</th><th>Period</th>
                <th>Water (L)</th><th>Total (ETB)</th><th>Paid (ETB)</th>
                <th>Status</th><th>Due</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv._id}>
                  <td><strong>{inv.invoiceNumber}</strong></td>
                  <td>{inv.farmId?.name || '—'}</td>
                  <td><span>{inv.farmOwnerId?.name||'—'}</span><div className="bl-sub">{inv.farmOwnerId?.email}</div></td>
                  <td style={{ fontSize:'0.8rem' }}>
                    {inv.periodStart?.slice(0,10)}<br/>→ {inv.periodEnd?.slice(0,10)}
                  </td>
                  <td>{inv.waterUsedLitres?.toLocaleString()}</td>
                  <td className="bl-amount">ETB {inv.totalAmount?.toLocaleString()}</td>
                  <td className="bl-amount" style={{ color:'#15803d' }}>ETB {inv.paidAmount?.toLocaleString()}</td>
                  <td>
                    <span className="bl-badge" style={STATUS_COLORS[inv.paymentStatus]}>
                      {inv.paymentStatus.replace('_',' ')}
                    </span>
                  </td>
                  <td style={{ fontSize:'0.82rem', color: inv.paymentStatus==='overdue'?'#b91c1c':'inherit' }}>
                    {inv.dueDate ? inv.dueDate.slice(0,10) : '—'}
                  </td>
                  <td>
                    <button className="bl-btn-icon" onClick={() => handleEdit(inv)} title="Edit">✏️</button>
                    {inv.paymentStatus !== 'paid' && (
                      <button className="bl-btn-icon" onClick={() => { setPayModal(inv); setPayAmount(String(inv.totalAmount - inv.paidAmount)); }} title="Record Payment">💸</button>
                    )}
                    {user.role === 'super_administrator' && (
                      <button className="bl-btn-icon bl-btn-danger" onClick={() => handleDelete(inv._id)} title="Delete">🗑️</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bl-tfoot">
                <td colSpan={5}><strong>Totals</strong></td>
                <td className="bl-amount"><strong>ETB {filtered.reduce((s,i)=>s+(i.totalAmount||0),0).toLocaleString()}</strong></td>
                <td className="bl-amount" style={{ color:'#15803d' }}><strong>ETB {filtered.reduce((s,i)=>s+(i.paidAmount||0),0).toLocaleString()}</strong></td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Record Payment Modal */}
      {payModal && (
        <div className="bl-modal-overlay" onClick={() => setPayModal(null)}>
          <div className="bl-modal" onClick={e => e.stopPropagation()}>
            <h3>💸 Record Payment</h3>
            <p style={{ fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:14 }}>
              Invoice: <strong>{payModal.invoiceNumber}</strong> · Total: <strong>ETB {payModal.totalAmount?.toLocaleString()}</strong>
            </p>
            {error && <div className="bl-error" style={{ marginBottom:10 }}>{error}</div>}
            <div className="bl-field" style={{ marginBottom:14 }}>
              <label>Payment Amount (ETB)</label>
              <input type="number" min="0" value={payAmount}
                onChange={e => setPayAmount(e.target.value)} className="bl-input" />
            </div>
            <div className="bl-form-actions">
              <button className="bl-btn bl-btn-primary" disabled={saving} onClick={handleMarkPaid}>
                {saving ? 'Saving…' : 'Confirm Payment'}
              </button>
              <button className="bl-btn bl-btn-ghost" onClick={() => setPayModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
