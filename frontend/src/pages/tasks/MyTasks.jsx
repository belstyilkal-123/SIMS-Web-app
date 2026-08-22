import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import PermissionDeniedToast from '../../components/common/PermissionDeniedToast';
import './MyTasks.css';

/* ── meta ────────────────────────────────────────────────────────────────── */
const STATUS_META = {
  pending:     { bg:'#fef3c7', color:'#92400e', dot:'#f59e0b', label:'Pending',     labelAm:'የሚጠባቀቅ',  progress:0   },
  in_progress: { bg:'#dbeafe', color:'#1d4ed8', dot:'#3b82f6', label:'In Progress', labelAm:'እየሄደ',     progress:50  },
  completed:   { bg:'#dcfce7', color:'#15803d', dot:'#22c55e', label:'Completed',   labelAm:'ተጠናቅቋል',  progress:100 },
  cancelled:   { bg:'#fee2e2', color:'#b91c1c', dot:'#ef4444', label:'Cancelled',   labelAm:'ተሰርዟል',   progress:0   },
};
const PRIORITY_META = {
  low:    { label:'🟢 Low',    labelAm:'🟢 ዝቅ',       border:'#22c55e' },
  medium: { label:'🟡 Medium', labelAm:'🟡 መካከለኛ',  border:'#f59e0b' },
  high:   { label:'🔴 High',   labelAm:'🔴 ከፍ',       border:'#ef4444' },
  urgent: { label:'🚨 Urgent', labelAm:'🚨 አስቸኳይ',   border:'#9d174d' },
};

const isOverdue = (deadline, status) => {
  if (!deadline || status === 'completed' || status === 'cancelled') return false;
  const d = new Date(deadline); d.setHours(0,0,0,0);
  const t = new Date();         t.setHours(0,0,0,0);
  return d < t;
};

/* ── inline completion widget ─────────────────────────────────────────────── */
function CompleteWithNotes({ taskId, onComplete, isAm }) {
  const [notes, setNotes] = useState('');
  const [open,  setOpen]  = useState(false);
  const [busy,  setBusy]  = useState(false);

  if (!open) {
    return (
      <button className="mt-action-btn mt-action-btn--done"
        onClick={() => setOpen(true)}>
        <span className="mt-action-btn__icon">✅</span>
        {isAm ? 'ተጠናቅቋል' : 'Mark as Done'}
      </button>
    );
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
        placeholder={isAm ? 'ማጠናቀቂያ ማስታወሻ (አማራጭ)…' : 'Add completion notes (optional)…'}
        style={{ width:'100%', padding:'9px 12px', borderRadius:8, outline:'none',
          border:'1.5px solid var(--border)', background:'var(--surface)',
          color:'var(--text-main)', fontSize:'0.85rem', resize:'vertical' }} />
      <div style={{ display:'flex', gap:8 }}>
        <button style={{ flex:1, padding:9, borderRadius:8, border:'none', cursor:'pointer',
          background:'#f1f5f9', color:'#475569', fontWeight:600, fontSize:'0.82rem' }}
          onClick={() => setOpen(false)}>
          {isAm ? 'ሰርዝ' : 'Cancel'}
        </button>
        <button className="mt-action-btn mt-action-btn--done"
          style={{ flex:2, padding:9 }} disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onComplete(taskId, 'completed', notes);
            setBusy(false);
          }}>
          {busy ? <span className="mt-spinner" /> : (isAm ? '✅ አስረክብ' : '✅ Submit')}
        </button>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   MyTasks — shows tasks assigned TO the current user
   Works for: admin, office_manager, farmer, labor
═════════════════════════════════════════════════════════════════════════ */
export default function MyTasks() {
  const { user } = useContext(AuthContext);
  const isAm = user?.language === 'am';
  const cfg  = useMemo(() => ({ headers:{ Authorization:`Bearer ${user?.token}` } }), [user?.token]);

  const [tasks,    setTasks]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [banner,   setBanner]   = useState({ type:'', text:'' });
  const [updating, setUpdating] = useState(null);
  const [showPermDenied, setShowPermDenied] = useState(false);

  /* ── load ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!user?.token) return;
    axios.get(`${API_URL}/api/tasks`, cfg)
      .then(r => {
        // MyTasks only shows tasks assigned TO this user
        const uid = user?._id || user?.id;
        const mine = (r.data || []).filter(t =>
          t.assignedTo?._id?.toString() === uid?.toString() ||
          t.assignedTo?._id === uid
        );
        setTasks(mine);
      })
      .catch(err => console.error('[MyTasks] fetch failed:', err.response?.data))
      .finally(() => setLoading(false));
  }, [cfg]);

  /* auto-dismiss banner */
  useEffect(() => {
    if (!banner.text) return;
    const id = setTimeout(() => setBanner({ type:'', text:'' }), 5000);
    return () => clearTimeout(id);
  }, [banner]);

  /* ── status change ───────────────────────────────────────────────────── */
  const changeStatus = async (id, status, completionNotes = '') => {
    setUpdating(id);
    try {
      const res = await axios.patch(
        `${API_URL}/api/tasks/${id}/status`,
        { status, completionNotes },
        cfg
      );
      setTasks(prev => prev.map(t => t._id === id ? res.data : t));
      setBanner({
        type:'success',
        text: status === 'completed'
          ? (isAm ? 'ተጠናቅቆ ለኃላፊው ተልኳል!' : 'Task completed! Supervisor notified.')
          : (isAm ? 'ተግባሩ ተጀምሯል!' : 'Task started!'),
      });
    } catch (err) {
      if (err.response?.status === 403) setShowPermDenied(true);
      else setBanner({ type:'error', text: err.response?.data?.error || 'Failed to update task' });
    } finally { setUpdating(null); }
  };

  /* ── derived ─────────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    if (filter === 'overdue') return tasks.filter(t => isOverdue(t.deadline, t.status));
    if (filter !== 'all') return tasks.filter(t => t.status === filter);
    return tasks;
  }, [tasks, filter]);

  const kpi = useMemo(() => ({
    total:    tasks.length,
    pending:  tasks.filter(t => t.status === 'pending').length,
    inProg:   tasks.filter(t => t.status === 'in_progress').length,
    done:     tasks.filter(t => t.status === 'completed').length,
    overdue:  tasks.filter(t => isOverdue(t.deadline, t.status)).length,
  }), [tasks]);

  if (loading) return (
    <div className="mt-loading">
      {isAm ? 'ተግባሮችዎን በመጫን ላይ…' : 'Loading your tasks…'}
    </div>
  );

  return (
    <div className="mt-page">

      {/* Header */}
      <div className="mt-header">
        <div>
          <h1 className="mt-title">📋 {isAm ? 'የእኔ ተግባሮች' : 'My Tasks'}</h1>
          <p className="mt-subtitle">
            {isAm ? 'ለእርስዎ የተሰጡ ተግባሮች።' : 'Tasks assigned to you.'}
          </p>
        </div>
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
          { label: isAm?'ጠቅላላ':'Total',       value:kpi.total,   bg:'#dbeafe', color:'#1d4ed8' },
          { label: isAm?'የሚጠባቀቅ':'Pending',    value:kpi.pending, bg:'#fef3c7', color:'#92400e' },
          { label: isAm?'እየሄደ':'In Progress',   value:kpi.inProg,  bg:'#ede9fe', color:'#7c3aed' },
          { label: isAm?'ተጠናቅቋል':'Completed',  value:kpi.done,    bg:'#dcfce7', color:'#15803d' },
          { label: isAm?'ጊዜው አልፏል':'Overdue',  value:kpi.overdue, bg:'#fee2e2', color:'#b91c1c' },
        ].map(k => (
          <div key={k.label} className="mt-kpi" style={{ background:k.bg }}>
            <div className="mt-kpi__value" style={{ color:k.color }}>{k.value}</div>
            <div className="mt-kpi__label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mt-filters">
        {[
          { key:'all',         label: isAm?'ሁሉም':'All'          },
          { key:'pending',     label: isAm?'የሚጠባቀቅ':'Pending'    },
          { key:'in_progress', label: isAm?'እየሄደ':'In Progress'   },
          { key:'completed',   label: isAm?'ተጠናቅቋል':'Completed'  },
          { key:'overdue',     label: isAm?'ጊዜው አልፏል':'Overdue'  },
        ].map(f => (
          <button key={f.key}
            className={`mt-filter-btn${filter === f.key ? ' mt-filter-btn--active' : ''}`}
            onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Empty */}
      {filtered.length === 0 ? (
        <div className="mt-empty">
          <div className="mt-empty__icon">📋</div>
          <p className="mt-empty__msg">
            {isAm ? 'እስካሁን ምንም ተግባር አልተሰጠዎትም።' : 'No tasks assigned to you yet.'}
          </p>
          <p className="mt-empty__hint">
            {isAm ? 'ኃላፊዎ ተግባር ሲሰጡ እዚህ ይታያሉ።' : 'Your supervisor will assign tasks here.'}
          </p>
        </div>
      ) : (
        <div className="mt-cards">
          {filtered.map(task => {
            const sm   = STATUS_META[task.status]     || STATUS_META.pending;
            const pm   = PRIORITY_META[task.priority] || PRIORITY_META.medium;
            const late = isOverdue(task.deadline, task.status);
            const due  = task.deadline ? new Date(task.deadline) : null;
            const pct  = task.progress ?? sm.progress;
            const busy = updating === task._id;
            const steps = ['pending','in_progress','completed'];
            const stepIdx = steps.indexOf(task.status);

            return (
              <div key={task._id} className="mt-card"
                style={{ borderLeft:`4px solid ${late ? '#ef4444' : pm.border}` }}>

                {/* overdue strip */}
                {late && (
                  <div className="mt-overdue-strip">
                    ⚠️ {isAm ? 'ቀነ-ገደቡ አልፏል!' : 'This task is overdue!'}
                  </div>
                )}

                {/* head */}
                <div className="mt-card__head">
                  <span className="mt-card__title">{task.title}</span>
                  <span className="mt-badge" style={{ background:sm.bg, color:sm.color }}>
                    <span className="mt-badge__dot" style={{ background:sm.dot }} />
                    {isAm ? sm.labelAm : sm.label}
                  </span>
                </div>

                {task.description && <p className="mt-card__desc">{task.description}</p>}

                {/* meta */}
                <div className="mt-card__meta">
                  <div className="mt-meta-item">
                    <span className="mt-meta-label">{isAm?'ቅድሚያ':'Priority'}</span>
                    <span className="mt-meta-value">{isAm ? pm.labelAm : pm.label}</span>
                  </div>
                  {task.farmId && (
                    <div className="mt-meta-item">
                      <span className="mt-meta-label">🌾 {isAm?'እርሻ':'Farm'}</span>
                      <span className="mt-meta-value">{task.farmId.name}</span>
                    </div>
                  )}
                  <div className="mt-meta-item">
                    <span className="mt-meta-label">📅 {isAm?'ቀነ-ገደብ':'Due Date'}</span>
                    <span className="mt-meta-value"
                      style={{ color: late ? '#b91c1c':'inherit', fontWeight: late ? 700:400 }}>
                      {due ? due.toLocaleDateString() : '—'}
                      {late && <span className="mt-overdue-tag">⚠ {isAm?'ጊዜው አልፏል':'Overdue'}</span>}
                    </span>
                  </div>
                  {task.created_by && (
                    <div className="mt-meta-item">
                      <span className="mt-meta-label">👤 {isAm?'የሰጠ':'Assigned by'}</span>
                      <span className="mt-meta-value">{task.created_by.name}</span>
                    </div>
                  )}
                </div>

                {/* completion notes */}
                {task.completionNotes && (
                  <div className="mt-card__notes">
                    ✅ <strong>{isAm?'ማጠናቀቂያ ማስታወሻ:':'Completion note:'}</strong> {task.completionNotes}
                  </div>
                )}
                {task.notes && !task.completionNotes && (
                  <div className="mt-card__notes">📝 {task.notes}</div>
                )}

                {/* progress */}
                <div className="mt-progress-wrap">
                  <div className="mt-progress-bar">
                    <div className="mt-progress-fill" style={{ width:`${pct}%`, background:sm.dot }} />
                  </div>
                  <span className="mt-progress-pct">{pct}%</span>
                </div>

                {/* step indicator */}
                <div className="mt-steps">
                  {steps.map((s, i) => {
                    const done   = i < stepIdx;
                    const active = s === task.status;
                    const lineOk = done || (i === 0 && stepIdx >= 1);
                    return (
                      <React.Fragment key={s}>
                        <div className={`mt-step ${done?'mt-step--done':''} ${active?'mt-step--active':''}`}>
                          <div className="mt-step__dot">{done ? '✓' : i + 1}</div>
                          <span className="mt-step__label">
                            {s === 'pending'     && (isAm ? 'ተሰጥቷል' : 'Assigned'   )}
                            {s === 'in_progress' && (isAm ? 'እየሄደ'  : 'In Progress' )}
                            {s === 'completed'   && (isAm ? 'ተጠናቅቋል': 'Done'        )}
                          </span>
                        </div>
                        {i < 2 && <div className={`mt-step__line ${lineOk ? 'mt-step__line--done' : ''}`} />}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* ── action buttons ── */}
                <div className="mt-card__actions">
                  {task.status === 'pending' && (
                    <button className="mt-action-btn mt-action-btn--start"
                      disabled={busy}
                      onClick={() => changeStatus(task._id, 'in_progress')}>
                      {busy ? <span className="mt-spinner" /> : <><span className="mt-action-btn__icon">▶</span>{isAm ? 'ጀምር' : 'Start Task'}</>}
                    </button>
                  )}

                  {task.status === 'in_progress' && (
                    busy
                      ? <button className="mt-action-btn mt-action-btn--done" disabled><span className="mt-spinner" /></button>
                      : <CompleteWithNotes taskId={task._id} onComplete={changeStatus} isAm={isAm} />
                  )}

                  {task.status === 'completed' && (
                    <div className="mt-sent-box">
                      <div className="mt-sent-box__icon">📤</div>
                      <div className="mt-sent-box__text">
                        <strong>{isAm ? '📤 ለኃላፊው ተልኳል' : '📤 Submitted to Supervisor'}</strong>
                        <span>{isAm ? 'ኃላፊዎ ተነግሯቸዋል።' : 'Your supervisor has been notified.'}</span>
                        {task.completedAt && (
                          <span className="mt-sent-box__time">
                            {new Date(task.completedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PermissionDeniedToast show={showPermDenied} onClose={() => setShowPermDenied(false)} isAmharic={isAm} />
    </div>
  );
}
