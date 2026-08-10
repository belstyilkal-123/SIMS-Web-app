import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import './Maintenance.css';

const STATUS_COLORS = {
  open:        { bg:'#fef3c7', color:'#92400e' },
  assigned:    { bg:'#dbeafe', color:'#1e40af' },
  in_progress: { bg:'#ede9fe', color:'#7c3aed' },
  resolved:    { bg:'#dcfce7', color:'#15803d' },
  closed:      { bg:'#f1f5f9', color:'#475569' },
  rejected:    { bg:'#fee2e2', color:'#b91c1c' },
};
const PRIORITY_COLORS = {
  critical: { bg:'#fee2e2', color:'#b91c1c' },
  high:     { bg:'#fef3c7', color:'#92400e' },
  medium:   { bg:'#dbeafe', color:'#1e40af' },
  low:      { bg:'#f1f5f9', color:'#475569' },
};
const CATEGORIES = ['pump','pipe','sensor','valve','electrical','filter','tank','other'];

export default function FarmerMaintenance() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const [tickets, setTickets] = useState([]);
  const [farms,   setFarms]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('open');   // 'open' | 'resolved' | 'raise'
  const [form,    setForm]    = useState({ farmId:'', title:'', description:'', category:'other', priority:'medium' });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const [t, f] = await Promise.all([
        axios.get(`${API_URL}/api/maintenance`, cfg),
        axios.get(`${API_URL}/api/farms`, cfg),
      ]);
      setTickets(t.data);
      setFarms(f.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const open     = tickets.filter(tk => !['resolved','closed'].includes(tk.status));
  const resolved = tickets.filter(tk => ['resolved','closed'].includes(tk.status));

  const handleRaise = async e => {
    e.preventDefault();
    if (!form.farmId || !form.title) { setError('Farm and title are required.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await axios.post(`${API_URL}/api/maintenance`, form, cfg);
      setSuccess('Support ticket submitted successfully. The office manager will review it.');
      setForm({ farmId:'', title:'', description:'', category:'other', priority:'medium' });
      await load(); setTab('open');
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed');
    } finally { setSaving(false); }
  };

  const summary = { open: open.length, resolved: resolved.length, critical: tickets.filter(t => t.priority === 'critical').length };

  if (loading) return <div className="mt-loading">Loading maintenance tickets…</div>;

  return (
    <div className="mt-page">
      <div className="mt-header">
        <div>
          <h2>🔧 Maintenance & Support</h2>
          <p className="mt-subtitle">Track field equipment issues and submit support requests.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-kpi-row">
        {[
          { label:'Open Issues',  value: summary.open,     bg:'#fef3c7', color:'#92400e' },
          { label:'Resolved',     value: summary.resolved, bg:'#dcfce7', color:'#15803d' },
          { label:'Critical',     value: summary.critical, bg:'#fee2e2', color:'#b91c1c' },
          { label:'Total',        value: tickets.length,   bg:'#dbeafe', color:'#1e40af' },
        ].map(k => (
          <div key={k.label} className="mt-kpi" style={{ background:k.bg }}>
            <div className="mt-kpi-value" style={{ color:k.color }}>{k.value}</div>
            <div className="mt-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', width:'fit-content' }}>
        {[
          { key:'open',     label:`🔓 Open (${open.length})` },
          { key:'resolved', label:`✅ Resolved (${resolved.length})` },
          { key:'raise',    label:'➕ Submit Request' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'9px 18px', border:'none', fontSize:'0.84rem', fontWeight:600,
              cursor:'pointer', background: tab === t.key ? '#16a34a' : 'transparent',
              color: tab === t.key ? 'white' : 'var(--text-muted)',
              borderRight: t.key !== 'raise' ? '1px solid var(--border)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Open tickets */}
      {tab === 'open' && (
        open.length === 0 ? <div className="mt-empty">No open issues. All systems running!</div> :
        <div className="mt-ticket-list">
          {open.map(tk => (
            <div key={tk._id} className="mt-ticket-item">
              <div className="mt-ticket-top">
                <div>
                  <strong style={{ fontSize:'0.95rem' }}>{tk.title}</strong>
                  <div style={{ display:'flex', gap:6, marginTop:5, flexWrap:'wrap' }}>
                    <span className="mt-badge" style={STATUS_COLORS[tk.status]}>{tk.status.replace('_',' ')}</span>
                    <span className="mt-badge" style={PRIORITY_COLORS[tk.priority]}>{tk.priority}</span>
                    <span className="mt-badge" style={{ background:'#f1f5f9', color:'#475569' }}>{tk.category}</span>
                  </div>
                </div>
              </div>
              {tk.description && <p style={{ fontSize:'0.84rem', color:'var(--text-muted)', margin:0 }}>{tk.description}</p>}
              <div className="mt-ticket-meta">
                <span>🌾 {tk.farmId?.name || '—'}</span>
                {tk.assignedTo && <span>👷 Assigned to {tk.assignedTo.name}</span>}
                {tk.scheduledFor && <span>📅 {new Date(tk.scheduledFor).toLocaleDateString()}</span>}
                <span>🕐 Raised {new Date(tk.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolved tickets */}
      {tab === 'resolved' && (
        resolved.length === 0 ? <div className="mt-empty">No resolved tickets yet.</div> :
        <div className="mt-ticket-list">
          {resolved.map(tk => (
            <div key={tk._id} className="mt-ticket-item">
              <div className="mt-ticket-top">
                <strong style={{ fontSize:'0.95rem' }}>{tk.title}</strong>
                <span className="mt-badge" style={STATUS_COLORS[tk.status]}>{tk.status}</span>
              </div>
              <div className="mt-ticket-meta">
                <span>🌾 {tk.farmId?.name || '—'}</span>
                <span>🕐 {new Date(tk.createdAt).toLocaleDateString()}</span>
                {tk.resolvedAt && <span>✅ Resolved {new Date(tk.resolvedAt).toLocaleDateString()}</span>}
              </div>
              {tk.resolution && (
                <div style={{ background:'#f0fdf4', borderRadius:8, padding:'8px 12px',
                  fontSize:'0.82rem', color:'#15803d' }}>
                  Resolution: {tk.resolution}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Raise ticket */}
      {tab === 'raise' && (
        <div className="mt-card">
          <h3>➕ Submit a Maintenance / Support Request</h3>
          {error   && <div className="mt-error"   style={{ marginBottom:12 }}>{error}</div>}
          {success && <div className="mt-success" style={{ marginBottom:12 }}>{success}</div>}
          <form className="mt-form" onSubmit={handleRaise}>
            <div className="mt-form-row">
              <div className="mt-field">
                <label>Farm *</label>
                <select value={form.farmId} onChange={e => setForm(p=>({...p,farmId:e.target.value}))} className="mt-input">
                  <option value="">Select your farm…</option>
                  {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                </select>
              </div>
              <div className="mt-field">
                <label>Issue Type</label>
                <select value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))} className="mt-input">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="mt-field">
                <label>Urgency</label>
                <select value={form.priority} onChange={e => setForm(p=>({...p,priority:e.target.value}))} className="mt-input">
                  <option value="low">Low — Not urgent</option>
                  <option value="medium">Medium — Needs attention</option>
                  <option value="high">High — Affecting production</option>
                  <option value="critical">Critical — System down</option>
                </select>
              </div>
            </div>
            <div className="mt-form-row">
              <div className="mt-field mt-field-wide">
                <label>Title / Summary *</label>
                <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))}
                  placeholder="e.g. Water pump not starting" className="mt-input" />
              </div>
            </div>
            <div className="mt-form-row">
              <div className="mt-field mt-field-wide">
                <label>Detailed Description</label>
                <textarea value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))}
                  className="mt-input mt-textarea"
                  placeholder="Describe the problem, when it started, what you have tried…" />
              </div>
            </div>
            <div className="mt-form-actions">
              <button type="submit" className="mt-btn mt-btn-primary" disabled={saving}>
                {saving ? 'Submitting…' : '📤 Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
