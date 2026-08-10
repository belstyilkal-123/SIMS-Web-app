import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { buildPdf, buildCsvTemplate, parseCsvFile } from '../../utils/pdfUtils';
import './AdminPages.css';

const STATUS_COLORS = {
  pending:     { bg: '#fef3c7', color: '#92400e' },
  in_progress: { bg: '#dbeafe', color: '#1e40af' },
  completed:   { bg: '#dcfce7', color: '#15803d' },
  cancelled:   { bg: '#fee2e2', color: '#b91c1c' },
};
const PRIORITY_COLORS = {
  low:    { bg: '#f0fdf4', color: '#15803d' },
  medium: { bg: '#fef9c3', color: '#854d0e' },
  high:   { bg: '#fee2e2', color: '#b91c1c' },
};

const IMPORT_COLUMNS = ['title', 'description', 'farmName', 'priority', 'dueDate'];

const empty = { title: '', description: '', farmId: '', assignedTo: [], dueDate: '', priority: 'medium' };

export default function ActivityAssignment() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };
  const importRef = useRef(null);

  const [activities, setActivities]   = useState([]);
  const [farms, setFarms]             = useState([]);
  const [labourUsers, setLabourUsers] = useState([]);
  const [form, setForm]               = useState(empty);
  const [editId, setEditId]           = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFarm, setFilterFarm]     = useState('');
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => {
    Promise.all([
      axios.get(`${API_URL}/api/activities`, cfg),
      axios.get(`${API_URL}/api/farms`, cfg),
      axios.get(`${API_URL}/api/admin/users?role=labor`, cfg),
    ]).then(([a, f, u]) => {
      setActivities(a.data);
      setFarms(f.data);
      setLabourUsers(u.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const reload = () =>
    axios.get(`${API_URL}/api/activities`, cfg).then(r => setActivities(r.data));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title || !form.farmId) { setError('Title and Farm are required.'); return; }
    setSaving(true); setError('');
    try {
      if (editId) {
        await axios.put(`${API_URL}/api/activities/${editId}`, form, cfg);
      } else {
        await axios.post(`${API_URL}/api/activities`, form, cfg);
      }
      setForm(empty); setEditId(null);
      await reload();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this activity?')) return;
    await axios.delete(`${API_URL}/api/activities/${id}`, cfg);
    await reload();
  };

  const handleEdit = (a) => {
    setEditId(a._id);
    setForm({
      title: a.title, description: a.description || '',
      farmId: a.farmId?._id || a.farmId || '',
      assignedTo: a.assignedTo?.map(u => u._id || u) || [],
      dueDate: a.dueDate ? a.dueDate.slice(0, 10) : '',
      priority: a.priority,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filtered = activities.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterFarm && (a.farmId?._id || a.farmId) !== filterFarm) return false;
    return true;
  });

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const handleExportPdf = () => {
    const farmName = farms.find(f => f._id === filterFarm)?.name || 'All Farms';
    buildPdf({
      title:    'Activity Assignment Report',
      subtitle: `Farm: ${farmName}  ·  Status: ${filterStatus || 'All'}  ·  ${filtered.length} records`,
      columns:  ['Title', 'Farm', 'Assigned To', 'Priority', 'Due Date', 'Status'],
      rows: filtered.map(a => [
        a.title,
        a.farmId?.name || '—',
        a.assignedTo?.map(u => u.name || u).join(', ') || 'Unassigned',
        a.priority,
        a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—',
        a.status.replace('_', ' '),
      ]),
      fileName:    `activities_${new Date().toISOString().slice(0,10)}`,
      orientation: 'l',
    });
  };

  // ── CSV Template Download ──────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    buildCsvTemplate({
      columns:    IMPORT_COLUMNS,
      sampleRows: [
        ['Irrigate Field A', 'Apply drip irrigation', 'Farm 1', 'high', '2026-08-15'],
        ['Check pump pressure', '', 'Farm 2', 'medium', '2026-08-20'],
      ],
      fileName: 'activities_import_template',
    });
  };

  // ── CSV Import ─────────────────────────────────────────────────────────────
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('Parsing…');

    try {
      const rows = await parseCsvFile(file);
      if (!rows.length) { setImportStatus('No data rows found in file.'); return; }

      let created = 0, failed = 0;
      for (const row of rows) {
        if (!row.title) { failed++; continue; }

        // Resolve farmId by name (case-insensitive)
        const farm = farms.find(f =>
          f.name.toLowerCase() === (row.farmName || '').toLowerCase()
        );
        if (!farm) { failed++; continue; }

        try {
          await axios.post(`${API_URL}/api/activities`, {
            title:       row.title,
            description: row.description || '',
            farmId:      farm._id,
            priority:    ['low','medium','high'].includes(row.priority) ? row.priority : 'medium',
            dueDate:     row.dueDate || undefined,
            assignedTo:  [],
          }, cfg);
          created++;
        } catch { failed++; }
      }

      setImportStatus(`✅ Imported ${created} activities.${failed > 0 ? ` ${failed} rows skipped.` : ''}`);
      await reload();
    } catch (err) {
      setImportStatus(`❌ ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  if (loading) return <div className="ap-loading">Loading activities...</div>;

  return (
    <div className="ap-page">
      <div className="ap-header">
        <h2>📋 Activity Assignment</h2>
        <p className="ap-subtitle">Create and assign tasks to labour workers.</p>
      </div>

      {/* ── Create / Edit Form ──────────────────────────────────── */}
      <div className="ap-card">
        <h3>{editId ? '✏️ Edit Activity' : '➕ New Activity'}</h3>
        {error && <div className="ap-error">{error}</div>}
        <form className="ap-form" onSubmit={handleSave}>
          <div className="ap-form-row">
            <div className="ap-field">
              <label>Title *</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Irrigate Field A" className="ap-input" />
            </div>
            <div className="ap-field">
              <label>Farm *</label>
              <select value={form.farmId} onChange={e => setForm(p => ({ ...p, farmId: e.target.value }))} className="ap-input">
                <option value="">Select farm…</option>
                {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
            </div>
            <div className="ap-field">
              <label>Priority</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="ap-input">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="ap-field">
              <label>Due Date</label>
              <input type="date" value={form.dueDate}
                onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} className="ap-input" />
            </div>
          </div>
          <div className="ap-form-row">
            <div className="ap-field ap-field-wide">
              <label>Description</label>
              <textarea value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="ap-input ap-textarea" placeholder="Optional task details…" />
            </div>
            <div className="ap-field">
              <label>Assign To (Labour)</label>
              <select multiple value={form.assignedTo}
                onChange={e => setForm(p => ({
                  ...p,
                  assignedTo: Array.from(e.target.selectedOptions, o => o.value)
                }))}
                className="ap-input ap-multi-select">
                {labourUsers.map(u => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
              </select>
              <span className="ap-hint">Hold Ctrl / Cmd to select multiple</span>
            </div>
          </div>
          <div className="ap-form-actions">
            <button type="submit" className="ap-btn ap-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editId ? 'Update Activity' : 'Create Activity'}
            </button>
            {editId && (
              <button type="button" className="ap-btn ap-btn-ghost"
                onClick={() => { setEditId(null); setForm(empty); setError(''); }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Filters + PDF/Import toolbar ───────────────────────── */}
      <div className="ap-filters">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="ap-input ap-filter-select">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filterFarm} onChange={e => setFilterFarm(e.target.value)} className="ap-input ap-filter-select">
          <option value="">All Farms</option>
          {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
        </select>
        <span className="ap-count">{filtered.length} activities</span>

        {/* PDF/CSV toolbar — right-aligned */}
        <div className="ap-pdf-toolbar">
          <button className="ap-btn ap-btn-pdf" onClick={handleExportPdf} title="Export current view to PDF">
            📄 Export PDF
          </button>
          <button className="ap-btn ap-btn-csv" onClick={handleDownloadTemplate} title="Download CSV import template">
            ⬇ CSV Template
          </button>
          <label className="ap-btn ap-btn-import" title="Import from CSV">
            📥 Import CSV
            <input ref={importRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
          </label>
        </div>
      </div>

      {importStatus && (
        <div className={`ap-import-status ${importStatus.startsWith('✅') ? 'ap-import-ok' : importStatus.startsWith('❌') ? 'ap-import-err' : ''}`}>
          {importStatus}
        </div>
      )}

      {/* ── Activity Table ──────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="ap-empty">No activities found. Create one above.</div>
      ) : (
        <div className="ap-card ap-no-pad">
          <table className="ap-table">
            <thead>
              <tr>
                <th>Title</th><th>Farm</th><th>Assigned To</th>
                <th>Priority</th><th>Due Date</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a._id}>
                  <td><strong>{a.title}</strong>{a.description && <div className="ap-sub">{a.description.slice(0,60)}{a.description.length > 60 ? '…' : ''}</div>}</td>
                  <td>{a.farmId?.name || '—'}</td>
                  <td>{a.assignedTo?.length > 0 ? a.assignedTo.map(u => u.name || u).join(', ') : <span className="ap-muted">Unassigned</span>}</td>
                  <td><span className="ap-badge" style={PRIORITY_COLORS[a.priority]}>{a.priority}</span></td>
                  <td>{a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—'}</td>
                  <td><span className="ap-badge" style={STATUS_COLORS[a.status]}>{a.status.replace('_', ' ')}</span></td>
                  <td>
                    <button className="ap-btn-icon" onClick={() => handleEdit(a)} title="Edit">✏️</button>
                    <button className="ap-btn-icon ap-btn-danger" onClick={() => handleDelete(a._id)} title="Delete">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
