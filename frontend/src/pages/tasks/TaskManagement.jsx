import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import PermissionDeniedToast from '../../components/common/PermissionDeniedToast';
import '../tasks/MyTasks.css';
import './TaskManagement.css';

/* ── meta maps ───────────────────────────────────────────────────────────── */
const STATUS_META = {
  pending:     { bg:'#fef3c7', color:'#92400e', dot:'#f59e0b', label:'Pending'     },
  in_progress: { bg:'#dbeafe', color:'#1d4ed8', dot:'#3b82f6', label:'In Progress' },
  completed:   { bg:'#dcfce7', color:'#15803d', dot:'#22c55e', label:'Completed'   },
  cancelled:   { bg:'#fee2e2', color:'#b91c1c', dot:'#ef4444', label:'Cancelled'   },
};
const PRIORITY_META = {
  low:    { label:'🟢 Low',    border:'#22c55e', bg:'#dcfce7', color:'#15803d' },
  medium: { label:'🟡 Medium', border:'#f59e0b', bg:'#fef3c7', color:'#92400e' },
  high:   { label:'🔴 High',   border:'#ef4444', bg:'#fee2e2', color:'#b91c1c' },
  urgent: { label:'🚨 Urgent', border:'#9d174d', bg:'#fce7f3', color:'#9d174d' },
};

const ROLE_LABELS = {
  office_manager: 'Office Manager',
  farmer:         'Farmer',
  labor:          'Labor',
};

const EMPTY_FORM = {
  title:'', description:'', assignedTo:'', farmId:'',
  priority:'medium', deadline:'', notes:'',
};

const isOverdue = (deadline, status) => {
  if (!deadline || status === 'completed' || status === 'cancelled') return false;
  const d = new Date(deadline); d.setHours(0,0,0,0);
  const t = new Date();         t.setHours(0,0,0,0);
  return d < t;
};

export default function TaskManagement() {
  const { user } = useContext(AuthContext);
  const cfg   = useMemo(() => ({ headers:{ Authorization:`Bearer ${user?.token}` } }), [user?.token]);
  const role  = user?.assignedRole || user?.role;
  const isOM  = role === 'office_manager';
  const isAm  = user?.language === 'am';

  /* ── state ─────────────────────────────────────────────────────────────── */
  const [tasks,      setTasks]      = useState([]);
  const [assignable, setAssignable] = useState([]);   // users I can assign to
  const [farms,      setFarms]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [errs,       setErrs]       = useState({});
  const [banner,     setBanner]     = useState({ type:'', text:'' });
  const [filter,     setFilter]     = useState('all');
  const [search,     setSearch]     = useState('');
  const [view,       setView]       = useState('created-by-me');  // 'created-by-me' | 'assigned-to-me' | 'all'
  const [showPermDenied, setShowPermDenied] = useState(false);

  /* ── fetch ──────────────────────────────────────────────────────────────── */
  const fetchAll = async () => {
    try {
      const [tRes, uRes, fRes] = await Promise.all([
        axios.get(`${API_URL}/api/tasks`, cfg),
        axios.get(`${API_URL}/api/tasks/assignable-users`, cfg),
        axios.get(`${API_URL}/api/farms`, cfg),
      ]);
      setTasks(tRes.data  || []);
      setAssignable(uRes.data || []);
      setFarms(fRes.data  || []);
    } catch (e) {
      if (e.response?.status === 403) setShowPermDenied(true);
      else flash('error', e.response?.data?.error || 'Failed to load tasks');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (user?.token) fetchAll(); }, [cfg]);

  const flash = (type, text) => {
    setBanner({ type, text });
    setTimeout(() => setBanner({ type:'', text:'' }), 5000);
  };

  const handleOpenCreate = () => {
    setEditId(null);
    const defaultFarm = user?.farmId || (farms.length === 1 ? farms[0]._id : '');
    setForm({ ...EMPTY_FORM, farmId: defaultFarm });
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

  /* ── create / edit task ──────────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrs = {};
    if (!form.title.trim()) newErrs.title = 'Title is required';
    if (!form.assignedTo)   newErrs.assignedTo = 'Please select an assignee';
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
        flash('success', 'Task updated and reassigned successfully!');
      } else {
        await axios.post(`${API_URL}/api/tasks`, payload, cfg);
        flash('success', 'Task assigned successfully! Assignee has been notified.');
      }
      setShowForm(false);
      setEditId(null);
      setForm(EMPTY_FORM);
      setErrs({});
      fetchAll();
    } catch (err) {
      if (err.response?.status === 403) {
        setShowPermDenied(true);
        setShowForm(false);
      } else {
        flash('error', err.response?.data?.error || 'Failed to save task');
      }
    } finally { setSaving(false); }
  };

  /* ── status change ──────────────────────────────────────────────────────── */
  const changeStatus = async (id, status, completionNotes = '') => {
    try {
      const res = await axios.patch(
        `${API_URL}/api/tasks/${id}/status`,
        { status, completionNotes },
        cfg
      );
      setTasks(prev => prev.map(t => t._id === id ? res.data : t));
      flash('success', status === 'completed' ? 'Task completed! Supervisor notified.' : 'Task updated!');
    } catch (err) {
      if (err.response?.status === 403) setShowPermDenied(true);
      else flash('error', err.response?.data?.error || 'Failed to update');
    }
  };

  /* ── delete ─────────────────────────────────────────────────────────────── */
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await axios.delete(`${API_URL}/api/tasks/${id}`, cfg);
      setTasks(prev => prev.filter(t => t._id !== id));
      flash('success', 'Task deleted.');
    } catch (err) {
      if (err.response?.status === 403) setShowPermDenied(true);
      else flash('error', err.response?.data?.error || 'Failed');
    }
  };

  /* ── derived ────────────────────────────────────────────────────────────── */
  const uid = user?._id || user?.id;
  const canCreate = ['owner', 'office_manager', 'farmer'].includes(user?.role);

  const viewTasks = useMemo(() => {
    if (view === 'assigned-to-me')  return tasks.filter(t => t.assignedTo?._id === uid  || t.assignedTo?._id?.toString() === uid?.toString());
    if (view === 'created-by-me')   return tasks.filter(t => t.created_by?._id === uid  || t.created_by?._id?.toString() === uid?.toString());
    return tasks;
  }, [tasks, view, uid]);

  const filtered = useMemo(() => {
    let arr = viewTasks;
    if (filter === 'overdue') {
      arr = arr.filter(t => isOverdue(t.deadline, t.status));
    } else if (filter !== 'all') {
      arr = arr.filter(t => t.status === filter);
    }
    
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(t => 
        t.title?.toLowerCase().includes(q) || 
        t.assignedTo?.name?.toLowerCase().includes(q)
      );
    }
    return arr;
  }, [viewTasks, filter, search]);

  const kpi = useMemo(() => ({
    myPending:   tasks.filter(t => t.assignedTo?._id?.toString() === uid?.toString() && t.status === 'pending').length,
    myInProg:    tasks.filter(t => t.assignedTo?._id?.toString() === uid?.toString() && t.status === 'in_progress').length,
    myDone:      tasks.filter(t => t.assignedTo?._id?.toString() === uid?.toString() && t.status === 'completed').length,
    iAssigned:   tasks.filter(t => t.created_by?._id?.toString() === uid?.toString()).length,
    overdue:     tasks.filter(t => isOverdue(t.deadline, t.status)).length,
  }), [tasks, uid]);

  // Group assignable users by role for the select dropdown
  const userGroups = useMemo(() => {
    const groups = {};
    assignable.forEach(u => {
      const r = u.assignedRole || u.role;
      if (!groups[r]) groups[r] = [];
      groups[r].push(u);
    });
    return Object.entries(groups).map(([r, members]) => ({ role: r, members }));
  }, [assignable]);

  if (loading) return <div className="mt-loading">Loading tasks…</div>;

  return (
    <div className="mt-page" style={{ maxWidth:1200 }}>

      {/* Header */}
      <div className="mt-header">
        <div>
          <h1 className="mt-title">
            📋 {isOM ? 'Task Management' : 'Farm Task Management'}
          </h1>
          <p className="mt-subtitle">
            {isOM
              ? 'Assign tasks to farmers and labor, and track your own assigned tasks.'
              : 'Assign tasks to labor on your farm, and track your own assigned tasks.'}
          </p>
        </div>
        {canCreate && (
          <button className="tm-btn tm-btn--primary" onClick={handleOpenCreate}>
            + Assign Task
          </button>
        )}
      </div>

      {/* Banner */}
      {banner.text && (
        <div className={`mt-banner mt-banner--${banner.type}`}>
          {banner.type === 'success' ? '✅' : '❌'} {banner.text}
          <button className="mt-banner__close" onClick={() => setBanner({ type:'', text:'' })}>×</button>
        </div>
      )}

      {/* KPI strip */}
      <div className="mt-kpi-row">
        {[
          { label:'My Pending',    value: kpi.myPending, bg:'#fef3c7', color:'#92400e' },
          { label:'My In Progress',value: kpi.myInProg,  bg:'#ede9fe', color:'#7c3aed' },
          { label:'My Completed',  value: kpi.myDone,    bg:'#dcfce7', color:'#15803d' },
          { label:'I Assigned',    value: kpi.iAssigned, bg:'#dbeafe', color:'#1d4ed8' },
          { label:'Overdue',       value: kpi.overdue,   bg:'#fee2e2', color:'#b91c1c' },
        ].map(k => (
          <div key={k.label} className="mt-kpi" style={{ background:k.bg }}>
            <div className="mt-kpi__value" style={{ color:k.color }}>{k.value}</div>
            <div className="mt-kpi__label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* View tabs + filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        {[
          { key:'created-by-me',  label:'📤 I Assigned' },
          { key:'assigned-to-me', label:'📥 Assigned to Me' },
          { key:'all',            label:'All' },
        ].map(v => (
          <button key={v.key}
            className={`mt-filter-btn${view === v.key ? ' mt-filter-btn--active' : ''}`}
            onClick={() => setView(v.key)}>
            {v.label}
          </button>
        ))}
        <div style={{ width:'1px', height:24, background:'var(--border)', margin:'0 4px' }} />
        {['all','pending','in_progress','completed','overdue','cancelled'].map(f => (
          <button key={f}
            className={`mt-filter-btn${filter === f ? ' mt-filter-btn--active' : ''}`}
            onClick={() => setFilter(f)}>
            {f === 'all' ? 'All Status' : f.replace('_',' ').replace(/^\w/, c => c.toUpperCase())}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          style={{ flex:1, minWidth:140, padding:'7px 12px', borderRadius:8,
            border:'1px solid var(--border)', background:'var(--surface)',
            color:'var(--text-main)', fontSize:'0.875rem' }} />
        <span style={{ fontSize:'0.82rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>
          {filtered.length} tasks
        </span>
      </div>

      {/* Task cards */}
      {filtered.length === 0 ? (
        <div className="mt-empty">
          <div className="mt-empty__icon">📋</div>
          <p className="mt-empty__msg">No tasks here yet.</p>
          <p className="mt-empty__hint">
            {view === 'assigned-to-me'
              ? 'Tasks assigned to you will appear here.'
              : assignable.length > 0
                ? 'Click "+ Assign Task" to assign work to your team.'
                : 'No tasks created yet.'}
          </p>
        </div>
      ) : (
        <div className="mt-cards">
          {filtered.map(task => {
            const sm   = STATUS_META[task.status]     || STATUS_META.pending;
            const pm   = PRIORITY_META[task.priority] || PRIORITY_META.medium;
            const late = isOverdue(task.deadline, task.status);
            const due  = task.deadline ? new Date(task.deadline) : null;
            const pct  = task.progress ?? 0;
            const isAssignedToMe = task.assignedTo?._id?.toString() === uid?.toString();
            const iCreated       = task.created_by?._id?.toString() === uid?.toString();
            const canAct         = isAssignedToMe;

            return (
              <div key={task._id} className="mt-card"
                style={{ borderLeft:`4px solid ${late ? '#ef4444' : pm.border}` }}>

                {/* overdue strip */}
                {late && (
                  <div className="mt-overdue-strip">⚠️ This task is overdue!</div>
                )}

                {/* head */}
                <div className="mt-card__head">
                  <span className="mt-card__title">{task.title}</span>
                  <span className="mt-badge" style={{ background:sm.bg, color:sm.color }}>
                    <span className="mt-badge__dot" style={{ background:sm.dot }} />
                    {sm.label}
                  </span>
                </div>

                {task.description && <p className="mt-card__desc">{task.description}</p>}

                {/* meta */}
                <div className="mt-card__meta">
                  <div className="mt-meta-item">
                    <span className="mt-meta-label">Priority</span>
                    <span className="mt-meta-value">{pm.label}</span>
                  </div>
                  {task.farmId && (
                    <div className="mt-meta-item">
                      <span className="mt-meta-label">🌾 Farm</span>
                      <span className="mt-meta-value">{task.farmId.name}</span>
                    </div>
                  )}
                  <div className="mt-meta-item">
                    <span className="mt-meta-label">📅 Due</span>
                    <span className="mt-meta-value"
                      style={{ color: late ? '#b91c1c':'inherit', fontWeight: late ? 700:400 }}>
                      {due ? due.toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <div className="mt-meta-item">
                    <span className="mt-meta-label">
                      {isAssignedToMe ? '👤 From' : '👤 Assigned To'}
                    </span>
                    <span className="mt-meta-value">
                      {isAssignedToMe
                        ? (task.created_by?.name || '—')
                        : (task.assignedTo?.name || '—')}
                    </span>
                  </div>
                </div>

                {/* notes / completion notes */}
                {task.completionNotes && (
                  <div className="mt-card__notes">
                    ✅ <strong>Completion note:</strong> {task.completionNotes}
                  </div>
                )}
                {task.notes && !task.completionNotes && (
                  <div className="mt-card__notes">📝 {task.notes}</div>
                )}

                {/* progress bar */}
                <div className="mt-progress-wrap">
                  <div className="mt-progress-bar">
                    <div className="mt-progress-fill" style={{ width:`${pct}%`, background:sm.dot }} />
                  </div>
                  <span className="mt-progress-pct">{pct}%</span>
                </div>

                {/* actions */}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {/* assignee actions */}
                  {canAct && task.status === 'pending' && (
                    <button className="mt-action-btn mt-action-btn--start"
                      onClick={() => changeStatus(task._id, 'in_progress')}>
                      ▶ Start Task
                    </button>
                  )}
                  {canAct && task.status === 'in_progress' && (
                    <CompleteWithNotes taskId={task._id} onComplete={changeStatus} />
                  )}
                  {canAct && task.status === 'completed' && (
                    <div className="mt-sent-box">
                      <div className="mt-sent-box__icon">📤</div>
                      <div className="mt-sent-box__text">
                        <strong>Submitted to supervisor</strong>
                        <span>Your supervisor has been notified.</span>
                        {task.completedAt && (
                          <span className="mt-sent-box__time">{new Date(task.completedAt).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* creator actions */}
                  {iCreated && (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:4 }}>
                      {!['completed','cancelled'].includes(task.status) && (
                        <>
                          <button className="tm-btn tm-btn--done" style={{ flex:1, minWidth:100 }}
                            onClick={() => changeStatus(task._id, 'completed')}>
                            ✅ Mark Done
                          </button>
                          <button className="tm-btn"
                            style={{ flex:1, minWidth:110, padding:'6px 12px', borderRadius:8, background:'var(--surface-hover, #f1f5f9)', border:'1.5px solid var(--border)', color:'var(--text-main)', cursor:'pointer', fontWeight:600, fontSize:'0.82rem' }}
                            onClick={() => changeStatus(task._id, 'cancelled')}>
                            🚫 Cancel Task
                          </button>
                        </>
                      )}
                      {!['completed','cancelled'].includes(task.status) && (
                        <button className="tm-btn"
                          style={{ flex:1, minWidth:110, padding:'6px 12px', borderRadius:8, background:'var(--surface-hover, #f1f5f9)', border:'1.5px solid var(--border)', color:'var(--text-main)', cursor:'pointer', fontWeight:600, fontSize:'0.82rem' }}
                          onClick={() => handleEdit(task)}>
                          ✏️ Edit / Reassign
                        </button>
                      )}
                      {['pending','cancelled'].includes(task.status) && (
                        <button className="tm-btn tm-btn--del"
                          onClick={() => handleDelete(task._id)}>
                          🗑️
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                {editId ? '✏️ Edit / Reassign Task' : '+ Assign Task'}
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
                  placeholder="e.g. Repair irrigation pipe section 3"
                  style={{ width:'100%', padding:'10px 14px', borderRadius:8, outline:'none',
                    border:`1.5px solid ${errs.title ? '#ef4444':'var(--border)'}`,
                    background:'var(--surface)', color:'var(--text-main)', fontSize:'0.95rem' }} />
                {errs.title && <p className="fv-error">⚠ {errs.title}</p>}
              </div>

              {/* Description */}
              <div className="fv-group" style={{ marginTop:12 }}>
                <label className="fv-label">Description</label>
                <textarea value={form.description} rows={3}
                  onChange={e => setForm(p => ({ ...p, description:e.target.value }))}
                  placeholder="Detailed instructions for the assignee…"
                  style={{ width:'100%', padding:'10px 14px', borderRadius:8, outline:'none', resize:'vertical',
                    border:'1.5px solid var(--border)', background:'var(--surface)',
                    color:'var(--text-main)', fontSize:'0.95rem' }} />
              </div>

              {/* Assign To */}
              <div className="fv-group" style={{ marginTop:12 }}>
                <label className="fv-label">Assign To <span className="fv-required">*</span></label>
                <select value={form.assignedTo}
                  onChange={e => setForm(p => ({ ...p, assignedTo:e.target.value }))}
                  style={{ width:'100%', padding:'10px 14px', borderRadius:8, cursor:'pointer',
                    border:`1.5px solid ${errs.assignedTo ? '#ef4444':'var(--border)'}`,
                    background:'var(--surface)', color:'var(--text-main)', fontSize:'0.95rem' }}>
                  <option value="">— Select —</option>
                  {userGroups.map(g => (
                    <optgroup key={g.role} label={ROLE_LABELS[g.role] || g.role}>
                      {g.members.map(u => (
                        <option key={u._id} value={u._id}>{u.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {errs.assignedTo && <p className="fv-error">⚠ {errs.assignedTo}</p>}
              </div>

              {/* Farm + Priority */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
                <div className="fv-group">
                  <label className="fv-label">Farm</label>
                  <select value={form.farmId}
                    onChange={e => setForm(p => ({ ...p, farmId:e.target.value }))}
                    style={{ width:'100%', padding:'10px 14px', borderRadius:8, cursor:'pointer',
                      border:'1.5px solid var(--border)', background:'var(--surface)',
                      color:'var(--text-main)', fontSize:'0.95rem' }}>
                    <option value="">— Optional —</option>
                    {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="fv-group">
                  <label className="fv-label">Priority</label>
                  <select value={form.priority}
                    onChange={e => setForm(p => ({ ...p, priority:e.target.value }))}
                    style={{ width:'100%', padding:'10px 14px', borderRadius:8, cursor:'pointer',
                      border:'1.5px solid var(--border)', background:'var(--surface)',
                      color:'var(--text-main)', fontSize:'0.95rem' }}>
                    <option value="low">🟢 Low</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🔴 High</option>
                    <option value="urgent">🚨 Urgent</option>
                  </select>
                </div>
              </div>

              {/* Deadline */}
              <div className="fv-group" style={{ marginTop:12 }}>
                <label className="fv-label">Deadline (optional)</label>
                <input type="date" value={form.deadline}
                  onChange={e => setForm(p => ({ ...p, deadline:e.target.value }))}
                  style={{ width:'100%', padding:'10px 14px', borderRadius:8, outline:'none',
                    border:'1.5px solid var(--border)', background:'var(--surface)',
                    color:'var(--text-main)', fontSize:'0.95rem' }} />
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:12, marginTop:20 }}>
                <button type="button"
                  style={{ flex:1, padding:11, borderRadius:8, border:'none', cursor:'pointer',
                    background:'#f1f5f9', color:'#475569', fontWeight:600, fontSize:'0.9rem' }}
                  onClick={() => { setShowForm(false); setErrs({}); }}>
                  Cancel
                </button>
                <button type="submit"
                  style={{ flex:2, padding:11, borderRadius:8, border:'none', cursor:'pointer',
                    background: saving ? '#9ca3af' : 'linear-gradient(135deg,#16a34a,#15803d)',
                    color:'white', fontWeight:700, fontSize:'0.9rem' }}
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

/* ── inline completion widget ─────────────────────────────────────────────── */
function CompleteWithNotes({ taskId, onComplete }) {
  const [notes, setNotes] = useState('');
  const [open,  setOpen]  = useState(false);
  const [busy,  setBusy]  = useState(false);

  if (!open) {
    return (
      <button className="mt-action-btn mt-action-btn--done" onClick={() => setOpen(true)}>
        ✅ Mark as Done
      </button>
    );
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <textarea value={notes} onChange={e => setNotes(e.target.value)}
        rows={2} placeholder="Add completion notes (optional)…"
        style={{ width:'100%', padding:'9px 12px', borderRadius:8, outline:'none', resize:'vertical',
          border:'1.5px solid var(--border)', background:'var(--surface)',
          color:'var(--text-main)', fontSize:'0.85rem' }} />
      <div style={{ display:'flex', gap:8 }}>
        <button style={{ flex:1, padding:'9px', borderRadius:8, border:'none', cursor:'pointer',
          background:'#f1f5f9', color:'#475569', fontWeight:600, fontSize:'0.82rem' }}
          onClick={() => setOpen(false)}>Cancel</button>
        <button className="mt-action-btn mt-action-btn--done"
          style={{ flex:2, padding:'9px' }}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onComplete(taskId, 'completed', notes);
            setBusy(false);
          }}>
          {busy ? '…' : '✅ Submit'}
        </button>
      </div>
    </div>
  );
}
