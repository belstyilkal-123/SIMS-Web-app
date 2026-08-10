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

export default function LabourMaintenance() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const [tickets,   setTickets]   = useState([]);
  const [farms,     setFarms]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState('assigned'); // 'assigned' | 'raise'
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [form,      setForm]      = useState({ farmId:'', title:'', description:'', category:'other', priority:'medium' });
  const [resolution, setResolution] = useState({});

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

  const assigned = tickets.filter(tk =>
    tk.assignedTo?._id === user._id || tk.assignedTo === user._id
  );
  const raised = tickets.filter(tk =>
    tk.raisedBy?._id === user._id || tk.raisedBy === user._id
  );

  const handleRaise = async e => {
    e.preventDefault();
    if (!form.farmId || !form.title) { setError('Farm and title are required.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await axios.post(`${API_URL}/api/maintenance`, form, cfg);
      setSuccess('Ticket raised successfully!');
      setForm({ farmId:'', title:'', description:'', category:'other', priority:'medium' });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to raise ticket');
    } finally { setSaving(false); }
  };

  const updateStatus = async (id, status) => {
    const body = { status };
    if (resolution[id]) body.resolution = resolution[id];
    await axios.put(`${API_URL}/api/maintenance/${id}`, body, cfg);
    await load();
  };

  if (loading) return <div className="mt-loading">Loading…</div>;

  return (
    <div className="mt-page">
      <div className="mt-header">
        <div>
          <h2>🔧 Maintenance</h2>
          <p className="mt-subtitle">View assigned repairs and report new issues.</p>
        </div>
        <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
          {[
            { key:'assigned', label:`📋 My Tasks (${assigned.length})` },
            { key:'raised',   label:`📝 Raised (${raised.length})` },
            { key:'raise',    label:'➕ Report Issue' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding:'9px 16px', border:'none', fontSize:'0.84rem', fontWeight:600,
                cursor:'pointer', background: tab === t.key ? '#16a34a' : 'transparent',
                color: tab === t.key ? 'white' : 'var(--text-muted)',
                borderRight: t.key !== 'raise' ? '1px solid var(--border)' : 'none' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Assigned tickets ─────────────────────────────────────── */}
      {tab === 'assigned' && (
        <div>
          {assigned.length === 0 ? (
            <div className="mt-empty">No maintenance tasks currently assigned to you.</div>
          ) : (
            <div className="mt-ticket-list">
              {assigned.map(tk => (
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
                    {tk.scheduledFor && <span>📅 Scheduled: {new Date(tk.scheduledFor).toLocaleDateString()}</span>}
                    <span>🕐 {new Date(tk.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* Resolution notes input */}
                  {(tk.status === 'assigned' || tk.status === 'in_progress') && (
                    <textarea
                      placeholder="Add resolution notes (optional)…"
                      value={resolution[tk._id] || ''}
                      onChange={e => setResolution(p => ({...p, [tk._id]: e.target.value}))}
                      style={{ padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)',
                        background:'var(--surface)', color:'var(--text-main)',
                        fontSize:'0.82rem', minHeight:60, resize:'vertical', width:'100%',
                        boxSizing:'border-box', fontFamily:'inherit' }} />
                  )}

                  <div className="mt-ticket-actions">
                    {tk.status === 'assigned' && (
                      <button className="mt-btn-sm"
                        style={{ background:'#ede9fe', color:'#7c3aed' }}
                        onClick={() => updateStatus(tk._id, 'in_progress')}>
                        ▶ Start Work
                      </button>
                    )}
                    {tk.status === 'in_progress' && (
                      <button className="mt-btn-sm"
                        style={{ background:'#dcfce7', color:'#15803d' }}
                        onClick={() => updateStatus(tk._id, 'resolved')}>
                        ✔ Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Raised tickets ───────────────────────────────────────── */}
      {tab === 'raised' && (
        <div>
          {raised.length === 0 ? (
            <div className="mt-empty">You haven't raised any tickets yet.</div>
          ) : (
            <div className="mt-ticket-list">
              {raised.map(tk => (
                <div key={tk._id} className="mt-ticket-item">
                  <div className="mt-ticket-top">
                    <strong style={{ fontSize:'0.95rem' }}>{tk.title}</strong>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      <span className="mt-badge" style={STATUS_COLORS[tk.status]}>{tk.status.replace('_',' ')}</span>
                      <span className="mt-badge" style={PRIORITY_COLORS[tk.priority]}>{tk.priority}</span>
                    </div>
                  </div>
                  {tk.description && <p style={{ fontSize:'0.84rem', color:'var(--text-muted)', margin:0 }}>{tk.description}</p>}
                  <div className="mt-ticket-meta">
                    <span>🌾 {tk.farmId?.name || '—'}</span>
                    <span>👷 {tk.assignedTo ? `Assigned to ${tk.assignedTo.name}` : 'Unassigned'}</span>
                    <span>🕐 {new Date(tk.createdAt).toLocaleDateString()}</span>
                  </div>
                  {tk.resolution && (
                    <div style={{ background:'#f0fdf4', borderRadius:8, padding:'8px 12px',
                      fontSize:'0.82rem', color:'#15803d', marginTop:4 }}>
                      ✅ Resolution: {tk.resolution}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Raise a new ticket ───────────────────────────────────── */}
      {tab === 'raise' && (
        <div className="mt-card">
          <h3>➕ Report a Maintenance Issue</h3>
          {error   && <div className="mt-error"   style={{ marginBottom:12 }}>{error}</div>}
          {success && <div className="mt-success" style={{ marginBottom:12 }}>{success}</div>}
          <form className="mt-form" onSubmit={handleRaise}>
            <div className="mt-form-row">
              <div className="mt-field">
                <label>Farm *</label>
                <select value={form.farmId} onChange={e => setForm(p=>({...p,farmId:e.target.value}))} className="mt-input">
                  <option value="">Select farm…</option>
                  {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                </select>
              </div>
              <div className="mt-field">
                <label>Category</label>
                <select value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))} className="mt-input">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="mt-field">
                <label>Priority</label>
                <select value={form.priority} onChange={e => setForm(p=>({...p,priority:e.target.value}))} className="mt-input">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="mt-form-row">
              <div className="mt-field mt-field-wide">
                <label>Issue Title *</label>
                <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))}
                  placeholder="e.g. Pipe leak near zone 3" className="mt-input" />
              </div>
            </div>
            <div className="mt-form-row">
              <div className="mt-field mt-field-wide">
                <label>Description</label>
                <textarea value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))}
                  className="mt-input mt-textarea"
                  placeholder="Describe what you observed in detail…" />
              </div>
            </div>
            <div className="mt-form-actions">
              <button type="submit" className="mt-btn mt-btn-primary" disabled={saving}>
                {saving ? 'Submitting…' : '📤 Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
