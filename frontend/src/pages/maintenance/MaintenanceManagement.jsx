import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { buildPdf } from '../../utils/pdfUtils';
import './Maintenance.css';

/* ── colour maps ──────────────────────────────────────────────────────── */
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

const STATUSES    = ['open','assigned','in_progress','resolved','closed','rejected'];
const PRIORITIES  = ['low','medium','high','critical'];
const CATEGORIES  = ['pump','pipe','sensor','valve','electrical','filter','tank','other'];

const emptyForm = {
  farmId:'', deviceId:'', title:'', description:'',
  category:'other', priority:'medium', scheduledFor:'',
};

export default function MaintenanceManagement() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const [tickets, setTickets]   = useState([]);
  const [farms, setFarms]       = useState([]);
  const [workers, setWorkers]   = useState([]);
  const [devices, setDevices]   = useState([]);
  const [stats, setStats]       = useState({});
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState(emptyForm);
  const [editId, setEditId]     = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  // Filters
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterFarm,     setFilterFarm]     = useState('');
  const [search,         setSearch]         = useState('');
  // Assign modal
  const [assignId,    setAssignId]    = useState(null);
  const [assignWorker, setAssignWorker] = useState('');

  const load = async () => {
    try {
      const [t, f, w] = await Promise.all([
        axios.get(`${API_URL}/api/maintenance`, cfg),
        axios.get(`${API_URL}/api/farms`, cfg),
        axios.get(`${API_URL}/api/admin/users?role=labor`, cfg),
      ]);
      setTickets(t.data);
      setFarms(f.data);
      setWorkers(w.data);

      // Stats
      const s = { open:0, in_progress:0, resolved:0, critical:0 };
      t.data.forEach(tk => {
        if (s[tk.status] !== undefined) s[tk.status]++;
        if (tk.priority === 'critical') s.critical++;
      });
      setStats(s);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Load devices when farm selected in form
  useEffect(() => {
    if (!form.farmId) { setDevices([]); return; }
    axios.get(`${API_URL}/api/devices?farmId=${form.farmId}`, cfg)
      .then(r => setDevices(r.data)).catch(() => {});
  }, [form.farmId]);

  const handleSave = async e => {
    e.preventDefault();
    if (!form.farmId || !form.title) { setError('Farm and title are required.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = { ...form };
      if (!payload.deviceId) delete payload.deviceId;
      if (!payload.scheduledFor) delete payload.scheduledFor;
      editId
        ? await axios.put(`${API_URL}/api/maintenance/${editId}`, payload, cfg)
        : await axios.post(`${API_URL}/api/maintenance`, payload, cfg);
      setSuccess(editId ? 'Ticket updated.' : 'Ticket created.');
      setForm(emptyForm); setEditId(null); setShowForm(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleEdit = tk => {
    setEditId(tk._id);
    setForm({
      farmId:       tk.farmId?._id   || '',
      deviceId:     tk.deviceId?._id || '',
      title:        tk.title,
      description:  tk.description || '',
      category:     tk.category,
      priority:     tk.priority,
      scheduledFor: tk.scheduledFor ? tk.scheduledFor.slice(0, 10) : '',
    });
    setShowForm(true); setError(''); setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStatusChange = async (id, status) => {
    await axios.put(`${API_URL}/api/maintenance/${id}`, { status }, cfg);
    await load();
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this ticket?')) return;
    await axios.delete(`${API_URL}/api/maintenance/${id}`, cfg);
    await load();
  };

  const handleAssign = async () => {
    if (!assignWorker) return;
    await axios.put(`${API_URL}/api/maintenance/${assignId}`,
      { assignedTo: assignWorker, status: 'assigned' }, cfg);
    setAssignId(null); setAssignWorker('');
    await load();
  };

  const handleExportPdf = () => {
    buildPdf({
      title:    'Maintenance Tickets Report',
      subtitle: `Total: ${filtered.length} tickets  ·  Open: ${stats.open}  ·  Critical: ${stats.critical}`,
      columns:  ['Title','Farm','Category','Priority','Status','Raised By','Assigned To','Created'],
      rows: filtered.map(tk => [
        tk.title,
        tk.farmId?.name || '—',
        tk.category,
        tk.priority,
        tk.status.replace('_',' '),
        tk.raisedBy?.name  || '—',
        tk.assignedTo?.name|| 'Unassigned',
        new Date(tk.createdAt).toLocaleDateString(),
      ]),
      fileName:    `maintenance_${new Date().toISOString().slice(0,10)}`,
      orientation: 'l',
    });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tickets.filter(tk => {
      if (filterStatus   && tk.status   !== filterStatus)   return false;
      if (filterPriority && tk.priority !== filterPriority) return false;
      if (filterFarm     && (tk.farmId?._id||tk.farmId) !== filterFarm) return false;
      if (q) {
        const hay = [tk.title, tk.category, tk.raisedBy?.name, tk.farmId?.name].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, filterStatus, filterPriority, filterFarm, search]);

  if (loading) return <div className="mt-loading">Loading maintenance tickets…</div>;

  return (
    <div className="mt-page">

      {/* Header */}
      <div className="mt-header">
        <div>
          <h2>🔧 Maintenance Management</h2>
          <p className="mt-subtitle">Track, assign, and resolve field maintenance tickets.</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="mt-btn mt-btn-primary"
            onClick={() => { setShowForm(v => !v); setEditId(null); setForm(emptyForm); setError(''); setSuccess(''); }}>
            {showForm ? '✕ Cancel' : '➕ New Ticket'}
          </button>
          <button className="mt-btn" style={{ background:'#dc2626', color:'white' }}
            onClick={handleExportPdf} disabled={filtered.length === 0}>
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mt-kpi-row">
        {[
          { label:'Open',       value: stats.open        || 0, bg:'#fef3c7', color:'#92400e' },
          { label:'In Progress',value: stats.in_progress || 0, bg:'#ede9fe', color:'#7c3aed' },
          { label:'Resolved',   value: stats.resolved    || 0, bg:'#dcfce7', color:'#15803d' },
          { label:'Critical',   value: stats.critical    || 0, bg:'#fee2e2', color:'#b91c1c' },
          { label:'Total',      value: tickets.length,         bg:'#dbeafe', color:'#1e40af' },
        ].map(k => (
          <div key={k.label} className="mt-kpi" style={{ background:k.bg }}>
            <div className="mt-kpi-value" style={{ color:k.color }}>{k.value}</div>
            <div className="mt-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="mt-card">
          <h3>{editId ? '✏️ Edit Ticket' : '➕ New Maintenance Ticket'}</h3>
          {error   && <div className="mt-error"   style={{ marginBottom:12 }}>{error}</div>}
          {success && <div className="mt-success" style={{ marginBottom:12 }}>{success}</div>}
          <form className="mt-form" onSubmit={handleSave}>
            <div className="mt-form-row">
              <div className="mt-field">
                <label>Farm *</label>
                <select value={form.farmId} onChange={e => setForm(p=>({...p,farmId:e.target.value}))} className="mt-input">
                  <option value="">Select farm…</option>
                  {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                </select>
              </div>
              <div className="mt-field">
                <label>Device (optional)</label>
                <select value={form.deviceId} onChange={e => setForm(p=>({...p,deviceId:e.target.value}))} className="mt-input">
                  <option value="">None</option>
                  {devices.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
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
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="mt-field">
                <label>Scheduled For</label>
                <input type="date" value={form.scheduledFor}
                  onChange={e => setForm(p=>({...p,scheduledFor:e.target.value}))} className="mt-input" />
              </div>
            </div>
            <div className="mt-form-row">
              <div className="mt-field mt-field-wide">
                <label>Title *</label>
                <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))}
                  placeholder="e.g. Pump 2 making noise" className="mt-input" />
              </div>
            </div>
            <div className="mt-form-row">
              <div className="mt-field mt-field-wide">
                <label>Description</label>
                <textarea value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))}
                  className="mt-input mt-textarea" placeholder="Describe the issue in detail…" />
              </div>
            </div>
            <div className="mt-form-actions">
              <button type="submit" className="mt-btn mt-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update Ticket' : 'Create Ticket'}
              </button>
              {editId && (
                <button type="button" className="mt-btn mt-btn-ghost"
                  onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="mt-filters">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search tickets…" className="mt-input mt-input-search" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="mt-input mt-select">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="mt-input mt-select">
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterFarm} onChange={e => setFilterFarm(e.target.value)} className="mt-input mt-select">
          <option value="">All Farms</option>
          {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
        </select>
        <span className="mt-count">{filtered.length} tickets</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="mt-empty">No tickets match your filters. Create one above.</div>
      ) : (
        <div className="mt-card mt-no-pad">
          <table className="mt-table">
            <thead>
              <tr>
                <th>Title</th><th>Farm</th><th>Category</th><th>Priority</th>
                <th>Status</th><th>Raised By</th><th>Assigned To</th><th>Scheduled</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tk => (
                <tr key={tk._id}>
                  <td>
                    <strong>{tk.title}</strong>
                    {tk.description && <div className="mt-sub">{tk.description.slice(0,55)}{tk.description.length>55?'…':''}</div>}
                  </td>
                  <td>{tk.farmId?.name || '—'}</td>
                  <td>{tk.category}</td>
                  <td><span className="mt-badge" style={PRIORITY_COLORS[tk.priority]}>{tk.priority}</span></td>
                  <td>
                    <select value={tk.status}
                      onChange={e => handleStatusChange(tk._id, e.target.value)}
                      className="mt-status-select"
                      style={STATUS_COLORS[tk.status]}>
                      {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                    </select>
                  </td>
                  <td><span>{tk.raisedBy?.name || '—'}</span><div className="mt-sub">{tk.raisedBy?.role}</div></td>
                  <td>
                    {tk.assignedTo
                      ? <span>{tk.assignedTo.name}</span>
                      : <span className="mt-muted">Unassigned</span>}
                  </td>
                  <td>{tk.scheduledFor ? new Date(tk.scheduledFor).toLocaleDateString() : '—'}</td>
                  <td>
                    <button className="mt-btn-icon" onClick={() => handleEdit(tk)} title="Edit">✏️</button>
                    <button className="mt-btn-icon" title="Assign worker"
                      onClick={() => { setAssignId(tk._id); setAssignWorker(tk.assignedTo?._id||''); }}>👷</button>
                    {user.role === 'super_administrator' && (
                      <button className="mt-btn-icon mt-btn-danger" onClick={() => handleDelete(tk._id)} title="Delete">🗑️</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign worker modal */}
      {assignId && (
        <div className="mt-modal-overlay" onClick={() => setAssignId(null)}>
          <div className="mt-modal" onClick={e => e.stopPropagation()}>
            <h3>👷 Assign Labour Worker</h3>
            <div className="mt-field" style={{ marginBottom:16 }}>
              <label>Select Worker</label>
              <select value={assignWorker} onChange={e => setAssignWorker(e.target.value)} className="mt-input">
                <option value="">Select…</option>
                {workers.map(w => <option key={w._id} value={w._id}>{w.name} ({w.email})</option>)}
              </select>
            </div>
            <div className="mt-form-actions">
              <button className="mt-btn mt-btn-primary" onClick={handleAssign} disabled={!assignWorker}>
                Assign
              </button>
              <button className="mt-btn mt-btn-ghost" onClick={() => setAssignId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
