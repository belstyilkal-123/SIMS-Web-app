import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import PermissionDeniedToast from '../../components/common/PermissionDeniedToast';
import './OwnerPages.css';

/* ── colour maps ─────────────────────────────────────────────────────────── */
const STATUS_META = {
  pending:     { bg:'#fef3c7', color:'#92400e', label:'Pending'     },
  in_progress: { bg:'#dbeafe', color:'#1d4ed8', label:'In Progress' },
  completed:   { bg:'#dcfce7', color:'#15803d', label:'Completed'   },
  cancelled:   { bg:'#fee2e2', color:'#b91c1c', label:'Cancelled'   },
};
const PRIORITY_META = {
  low:    { label:'🟢 Low',    bg:'#dcfce7', color:'#15803d' },
  medium: { label:'🟡 Medium', bg:'#fef3c7', color:'#92400e' },
  high:   { label:'🔴 High',   bg:'#fee2e2', color:'#b91c1c' },
  urgent: { label:'🚨 Urgent', bg:'#fce7f3', color:'#9d174d' },
};
const ROLE_META = {
  office_manager: { bg:'#ede9fe', color:'#7c3aed', label:'Office Manager' },
  farmer:         { bg:'#dcfce7', color:'#15803d', label:'Farmer'         },
};

const EMPTY_FORM = {
  title:'', description:'', assignedTo:'', farmId:'',
  priority:'medium', deadline:'', notes:'',
};

export default function OwnerTasks() {
  const { user } = useContext(AuthContext);
  const cfg = useMemo(() => ({ headers:{ Authorization:`Bearer ${user?.token}` } }), [user?.token]);
  const isAm = user?.language === 'am';

  /* ── data ─────────────────────────────────────────────────────────────── */
  const [tasks,    setTasks]    = useState([]);
  const [users,    setUsers]    = useState([]);   // office_managers + farmers
  const [farms,    setFarms]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [errs,     setErrs]     = useState({});
  const [banner,   setBanner]   = useState({ type:'', text:'' });
  const [filter,   setFilter]   = useState('all');
  const [search,   setSearch]   = useState('');
  const [showPermDenied, setShowPermDenied] = useState(false);

  /* ── fetch ────────────────────────────────────────────────────────────── */
  const fetchAll = async () => {
    try {
      const [tRes, uRes, fRes] = await Promise.all([
        axios.get(`${API_URL}/api/tasks`, cfg),
        axios.get(`${API_URL}/api/tasks/assignable-users`, cfg),
        axios.get(`${API_URL}/api/farms`, cfg),
      ]);
      setTasks(tRes.data  || []);
      setUsers(uRes.data  || []);
      setFarms(fRes.data  || []);
    } catch (e) {
      if (e.response?.status === 403) setShowPermDenied(true);
      else setBanner({ type:'error', text: e.response?.data?.error || 'Failed to load' });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [cfg]);

  /* ── flash helper ─────────────────────────────────────────────────────── */
  const flash = (type, text) => {
    setBanner({ type, text });
    setTimeout(() => setBanner({ type:'', text:'' }), 5000);
  };

  const handleOpenCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setErrs({});
    setShowForm(true);
  };

  const handleEdit = (task) => {
    setEditId(task._id);
    setForm({
      title:       task.title || '',
      description: task.description || '',
      assignedTo:  task.assignedTo?._id || task.assignedTo || '',
      farmId:      task.farmId?._id || task.farmId || '',
      priority:    task.priority || 'medium',
      deadline:    task.deadline ? task.deadline.slice(0, 10) : '',
      notes:       task.notes || '',
    });
    setErrs({});
    setShowForm(true);
  };

  /* ── submit form ──────────────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrs = {};
    if (!form.title.trim()) newErrs.title = 'Title is required';
    if (!form.assignedTo)   newErrs.assignedTo = 'Please select a user';
    if (Object.keys(newErrs).length) { setErrs(newErrs); return; }

    setSaving(true);
    try {
      const payload = {
        title:       form.title.trim(),
        description: form.description.trim(),
        assignedTo:  form.assignedTo,
        farmId:      form.farmId || undefined,
        priority:    form.priority,
        deadline:    form.deadline || undefined,
        notes:       form.notes.trim(),
      };

      if (editId) {
        await axios.put(`${API_URL}/api/tasks/${editId}`, payload, cfg);
        flash('success', isAm ? 'ተግባር ተስተካክሏል!' : 'Task updated and reassigned successfully!');
      } else {
        await axios.post(`${API_URL}/api/tasks`, payload, cfg);
        flash('success', isAm ? 'ተግባር ተሰጥቷል!' : 'Task assigned successfully! Assignee has been notified.');
      }
      setShowForm(false);
      setEditId(null);
      setForm(EMPTY_FORM);
      setErrs({});
      fetchAll();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save task';
      if (err.response?.status === 403) { setShowPermDenied(true); setShowForm(false); }
      else flash('error', msg);
    } finally { setSaving(false); }
  };

  /* ── status change ─────────────────────────────────────────────────────── */
  const handleStatusChange = async (id, status) => {
    try {
      const res = await axios.patch(`${API_URL}/api/tasks/${id}/status`, { status }, cfg);
      setTasks(prev => prev.map(t => t._id === id ? res.data : t));
      flash('success', status === 'completed' ? 'Task marked as completed!' : 'Task status updated!');
    } catch (err) {
      if (err.response?.status === 403) setShowPermDenied(true);
      else flash('error', err.response?.data?.error || 'Failed');
    }
  };

  /* ── delete ───────────────────────────────────────────────────────────── */
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    try {
      await axios.delete(`${API_URL}/api/tasks/${id}`, cfg);
      setTasks(prev => prev.filter(t => t._id !== id));
      flash('success', 'Task deleted.');
    } catch (err) {
      if (err.response?.status === 403) setShowPermDenied(true);
      else flash('error', err.response?.data?.error || 'Failed');
    }
  };

  /* ── derived ──────────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tasks.filter(t => {
      if (filter === 'overdue') {
        const due = t.deadline ? new Date(t.deadline) : null;
        if (!due || ['completed', 'cancelled'].includes(t.status) || due >= new Date()) return false;
      } else if (filter !== 'all' && t.status !== filter) {
        return false;
      }
      if (q && ![ t.title, t.description, t.assignedTo?.name, t.farmId?.name ].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, filter, search]);

  const kpi = useMemo(() => ({
    total:    tasks.length,
    pending:  tasks.filter(t => t.status === 'pending').length,
    inProg:   tasks.filter(t => t.status === 'in_progress').length,
    done:     tasks.filter(t => t.status === 'completed').length,
    overdue:  tasks.filter(t => ['pending','in_progress'].includes(t.status) && t.deadline && new Date(t.deadline) < new Date()).length,
  }), [tasks]);

  if (loading) return <div className="ow-loading">Loading tasks…</div>;

  /* ── grouped users for select ─────────────────────────────────────────── */
  const userGroups = ['office_manager','farmer'].map(role => ({
    role,
    members: users.filter(u => (u.assignedRole || u.role) === role),
  })).filter(g => g.members.length);

  return (
    <div className="ow-page">

      {/* Header */}
      <div className="ow-header">
        <div>
          <h2>📋 Task Management</h2>
          <p className="ow-subtitle">Assign and monitor tasks for your office managers and farmers.</p>
        </div>
        <button className="ow-btn ow-btn-approve" onClick={handleOpenCreate}>
          + Assign New Task
        </button>
      </div>

      {/* Banner */}
      {banner.text && (
        <div style={{
          padding:'11px 16px', borderRadius:8, fontWeight:500, fontSize:'0.875rem',
          display:'flex', alignItems:'center', gap:8,
          background: banner.type === 'success' ? '#ecfdf5' : '#fee2e2',
          border:`1px solid ${banner.type === 'success' ? '#a7f3d0' : '#fca5a5'}`,
          color: banner.type === 'success' ? '#047857' : '#b91c1c',
        }}>
          {banner.type === 'success' ? '✅' : '❌'} {banner.text}
          <button onClick={() => setBanner({ type:'', text:'' })}
            style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', fontSize:'1rem', color:'inherit' }}>×</button>
        </div>
      )}

      {/* KPI strip */}
      <div className="ow-kpi-row">
        {[
          { label:'Total',       value:kpi.total,   bg:'#dbeafe', color:'#1d4ed8' },
          { label:'Pending',     value:kpi.pending, bg:'#fef3c7', color:'#92400e' },
          { label:'In Progress', value:kpi.inProg,  bg:'#ede9fe', color:'#7c3aed' },
          { label:'Completed',   value:kpi.done,    bg:'#dcfce7', color:'#15803d' },
          { label:'Overdue',     value:kpi.overdue, bg:'#fee2e2', color:'#b91c1c' },
        ].map(k => (
          <div key={k.label} className="ow-kpi" style={{ background:k.bg }}>
            <div className="ow-kpi-value" style={{ color:k.color }}>{k.value}</div>
            <div className="ow-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        {['all','pending','in_progress','completed','overdue','cancelled'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="ow-btn"
            style={{
              padding:'6px 14px', borderRadius:20,
              border: filter === f ? 'none' : '1.5px solid var(--border)',
              background: filter === f ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'var(--surface)',
              color: filter === f ? 'white' : 'var(--text-muted)',
              fontSize:'0.82rem', fontWeight:600,
            }}>
            {f === 'all' ? 'All' : f.replace('_',' ').replace(/^\w/, c => c.toUpperCase())}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks…"
          style={{ flex:1, minWidth:160, padding:'7px 12px', borderRadius:8,
            border:'1px solid var(--border)', background:'var(--surface)',
            color:'var(--text-main)', fontSize:'0.875rem' }} />
        <span style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>{filtered.length} tasks</span>
      </div>

      {/* Task table */}
      <div className="ow-card" style={{ padding:0, overflow:'hidden' }}>
        {filtered.length === 0 ? (
          <div className="ow-empty" style={{ padding:'40px' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:8 }}>📋</div>
            <p>No tasks yet. Click "Assign New Task" to get started.</p>
          </div>
        ) : (
          <div className="ow-table-wrap">
            <table className="ow-table">
              <thead>
                <tr>
                  <th>Task</th><th>Assigned To</th><th>Role</th>
                  <th>Farm</th><th>Priority</th><th>Status</th>
                  <th>Due Date</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(task => {
                  const sm  = STATUS_META[task.status]     || STATUS_META.pending;
                  const pm  = PRIORITY_META[task.priority] || PRIORITY_META.medium;
                  const role = task.assignedTo?.assignedRole || task.assignedTo?.role;
                  const rm  = ROLE_META[role] || { bg:'#f1f5f9', color:'#475569', label: role || '—' };
                  const now = new Date();
                  const due = task.deadline ? new Date(task.deadline) : null;
                  const overdue = due && due < now && task.status !== 'completed';
                  return (
                    <tr key={task._id} style={{ background: overdue ? 'rgba(254,226,226,0.3)' : undefined }}>
                      <td>
                        <strong>{task.title}</strong>
                        {task.description && (
                          <div className="ow-sub">
                            {task.description.length > 60 ? task.description.slice(0,60)+'…' : task.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <strong>{task.assignedTo?.name || '—'}</strong>
                        <div className="ow-sub">{task.assignedTo?.email}</div>
                      </td>
                      <td>
                        <span style={{ padding:'3px 9px', borderRadius:20, fontSize:'0.68rem',
                          fontWeight:700, background:rm.bg, color:rm.color }}>
                          {rm.label}
                        </span>
                      </td>
                      <td>{task.farmId?.name || '—'}</td>
                      <td>
                        <span style={{ padding:'3px 9px', borderRadius:20, fontSize:'0.68rem',
                          fontWeight:700, background:pm.bg, color:pm.color }}>
                          {pm.label}
                        </span>
                      </td>
                      <td>
                        <span style={{ padding:'3px 9px', borderRadius:20, fontSize:'0.68rem',
                          fontWeight:700, background:sm.bg, color:sm.color }}>
                          {sm.label}
                        </span>
                      </td>
                      <td style={{ whiteSpace:'nowrap', color: overdue ? '#b91c1c' : undefined, fontWeight: overdue ? 700 : 400 }}>
                        {due ? due.toLocaleDateString() : '—'}
                        {overdue && <span style={{ marginLeft:4, fontSize:'0.68rem' }}>⚠ Overdue</span>}
                      </td>
                      <td style={{ whiteSpace:'nowrap' }}>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          {!['completed','cancelled'].includes(task.status) && (
                            <button className="ow-btn ow-btn-approve"
                              style={{ padding:'4px 10px', fontSize:'0.78rem' }}
                              onClick={() => handleStatusChange(task._id, 'completed')}>
                              ✅ Done
                            </button>
                          )}
                          {!['completed','cancelled'].includes(task.status) && (
                            <button className="ow-btn"
                              style={{ padding:'4px 10px', fontSize:'0.78rem', background:'var(--surface-hover, #f1f5f9)', border:'1px solid var(--border)', color:'var(--text-main)', cursor:'pointer' }}
                              onClick={() => handleEdit(task)}>
                              ✏️ Edit
                            </button>
                          )}
                          <button className="ow-btn ow-btn-reject"
                            style={{ padding:'4px 10px', fontSize:'0.78rem' }}
                            onClick={() => handleDelete(task._id)}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create / Edit Task Modal ─────────────────────────────────────── */}
      {showForm && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
          display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:1000, padding:16,
        }} onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={{
            background:'var(--surface)', borderRadius:16, width:'100%', maxWidth:500,
            boxShadow:'0 20px 60px rgba(0,0,0,0.35)', overflow:'hidden', maxHeight:'92vh', overflowY:'auto',
          }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--border)',
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:700 }}>
                {editId ? '✏️ Edit / Reassign Task' : '+ Assign New Task'}
              </h2>
              <button onClick={() => setShowForm(false)}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.4rem', color:'var(--text-muted)' }}>×</button>
            </div>

            <form onSubmit={handleSubmit} noValidate style={{ padding:22 }}>
              {/* Title */}
              <div className="fv-group">
                <label className="fv-label">Title <span className="fv-required">*</span></label>
                <input type="text" value={form.title} autoFocus
                  onChange={e => setForm(p => ({ ...p, title:e.target.value }))}
                  placeholder="e.g. Inspect nursery greenhouse"
                  style={{ width:'100%', padding:'10px 14px', borderRadius:8,
                    border:`1.5px solid ${errs.title ? '#ef4444' : 'var(--border)'}`,
                    background:'var(--surface)', color:'var(--text-main)', fontSize:'0.95rem', outline:'none' }} />
                {errs.title && <p className="fv-error">⚠ {errs.title}</p>}
              </div>

              {/* Description */}
              <div className="fv-group" style={{ marginTop:12 }}>
                <label className="fv-label">Description</label>
                <textarea value={form.description}
                  onChange={e => setForm(p => ({ ...p, description:e.target.value }))}
                  rows={3} placeholder="Detailed instructions…"
                  style={{ width:'100%', padding:'10px 14px', borderRadius:8,
                    border:'1.5px solid var(--border)', background:'var(--surface)',
                    color:'var(--text-main)', fontSize:'0.95rem', outline:'none', resize:'vertical' }} />
              </div>

              {/* Assign To */}
              <div className="fv-group" style={{ marginTop:12 }}>
                <label className="fv-label">Assign To <span className="fv-required">*</span></label>
                <select value={form.assignedTo}
                  onChange={e => setForm(p => ({ ...p, assignedTo:e.target.value }))}
                  style={{ width:'100%', padding:'10px 14px', borderRadius:8,
                    border:`1.5px solid ${errs.assignedTo ? '#ef4444' : 'var(--border)'}`,
                    background:'var(--surface)', color:'var(--text-main)', fontSize:'0.95rem', cursor:'pointer' }}>
                  <option value="">— Select User —</option>
                  {userGroups.map(g => (
                    <optgroup key={g.role} label={ROLE_META[g.role]?.label || g.role}>
                      {g.members.map(u => (
                        <option key={u._id} value={u._id}>{u.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {errs.assignedTo && <p className="fv-error">⚠ {errs.assignedTo}</p>}
              </div>

              {/* Farm + Priority row */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
                <div className="fv-group">
                  <label className="fv-label">Farm (optional)</label>
                  <select value={form.farmId}
                    onChange={e => setForm(p => ({ ...p, farmId:e.target.value }))}
                    style={{ width:'100%', padding:'10px 14px', borderRadius:8,
                      border:'1.5px solid var(--border)', background:'var(--surface)',
                      color:'var(--text-main)', fontSize:'0.95rem', cursor:'pointer' }}>
                    <option value="">— No specific farm —</option>
                    {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="fv-group">
                  <label className="fv-label">Priority</label>
                  <select value={form.priority}
                    onChange={e => setForm(p => ({ ...p, priority:e.target.value }))}
                    style={{ width:'100%', padding:'10px 14px', borderRadius:8,
                      border:'1.5px solid var(--border)', background:'var(--surface)',
                      color:'var(--text-main)', fontSize:'0.95rem', cursor:'pointer' }}>
                    <option value="low">🟢 Low</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🔴 High</option>
                    <option value="urgent">🚨 Urgent</option>
                  </select>
                </div>
              </div>

              {/* Deadline + Notes row */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
                <div className="fv-group">
                  <label className="fv-label">Deadline (optional)</label>
                  <input type="date" value={form.deadline}
                    onChange={e => setForm(p => ({ ...p, deadline:e.target.value }))}
                    style={{ width:'100%', padding:'10px 14px', borderRadius:8,
                      border:'1.5px solid var(--border)', background:'var(--surface)',
                      color:'var(--text-main)', fontSize:'0.95rem', outline:'none' }} />
                </div>
                <div className="fv-group">
                  <label className="fv-label">Notes (optional)</label>
                  <input type="text" value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes:e.target.value }))}
                    placeholder="Any additional context"
                    style={{ width:'100%', padding:'10px 14px', borderRadius:8,
                      border:'1.5px solid var(--border)', background:'var(--surface)',
                      color:'var(--text-main)', fontSize:'0.95rem', outline:'none' }} />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:12, marginTop:20 }}>
                <button type="button" className="ow-btn"
                  style={{ flex:1, padding:11, background:'#f1f5f9', color:'#475569' }}
                  onClick={() => { setShowForm(false); setErrs({}); }}>
                  Cancel
                </button>
                <button type="submit" className="ow-btn ow-btn-approve"
                  style={{ flex:2, padding:11, opacity: saving ? 0.7 : 1 }}
                  disabled={saving}>
                  {saving ? 'Saving…' : (editId ? '💾 Save Changes' : '📋 Assign Task')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PermissionDeniedToast show={showPermDenied} onClose={() => setShowPermDenied(false)} isAmharic={isAm} />
    </div>
  );
}
