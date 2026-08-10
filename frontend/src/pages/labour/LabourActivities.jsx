import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import './LabourPages.css';

const STATUS_COLORS = {
  pending:     { bg: '#fef3c7', color: '#92400e' },
  in_progress: { bg: '#dbeafe', color: '#1e40af' },
  completed:   { bg: '#dcfce7', color: '#15803d' },
  cancelled:   { bg: '#fee2e2', color: '#b91c1c' },
};
const PRIORITY_COLORS = {
  high:   { bg: '#fee2e2', color: '#b91c1c' },
  medium: { bg: '#fef3c7', color: '#92400e' },
  low:    { bg: '#dcfce7', color: '#15803d' },
};

export default function LabourActivities() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const [activities, setActivities] = useState([]);
  const [filter, setFilter]         = useState('active'); // 'active' | 'completed' | 'all'
  const [loading, setLoading]       = useState(true);
  const [photos,  setPhotos]        = useState({}); // { [activityId]: base64 }
  const fileRefs                    = useRef({});

  const load = () =>
    axios.get(`${API_URL}/api/activities`, cfg)
      .then(r => setActivities(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    // Include photo evidence in notes if attached
    const body = { status };
    if (photos[id]) {
      body.notes = `[Photo attached]\n${photos[id].slice(0, 300)}`; // store first 300 chars of base64 as marker
    }
    await axios.put(`${API_URL}/api/activities/${id}`, body, cfg);
    setActivities(prev => prev.map(a =>
      a._id === id ? { ...a, status, completedAt: status === 'completed' ? new Date() : a.completedAt } : a
    ));
    setPhotos(prev => { const next = {...prev}; delete next[id]; return next; });
  };

  const handlePhotoAttach = (id, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setPhotos(prev => ({ ...prev, [id]: e.target.result }));
    reader.readAsDataURL(file);
  };

  const filtered = activities.filter(a => {
    if (filter === 'active')    return a.status === 'pending' || a.status === 'in_progress';
    if (filter === 'completed') return a.status === 'completed';
    return true;
  });

  const counts = {
    pending:     activities.filter(a => a.status === 'pending').length,
    in_progress: activities.filter(a => a.status === 'in_progress').length,
    completed:   activities.filter(a => a.status === 'completed').length,
  };

  if (loading) return <div className="lp-loading">Loading your tasks…</div>;

  return (
    <div className="lp-page">
      <div className="lp-header">
        <h2>📋 My Tasks</h2>
        <p className="lp-subtitle">Activities assigned to you by your supervisor.</p>
      </div>

      {/* KPI strip */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        {[
          { label:'Pending',     count: counts.pending,     bg:'#fef3c7', color:'#92400e' },
          { label:'In Progress', count: counts.in_progress, bg:'#dbeafe', color:'#1e40af' },
          { label:'Completed',   count: counts.completed,   bg:'#dcfce7', color:'#15803d' },
        ].map(k => (
          <div key={k.label} style={{ flex:'1 1 100px', background:k.bg, border:`1px solid ${k.color}22`,
            borderRadius:12, padding:'14px 18px', textAlign:'center' }}>
            <div style={{ fontSize:'1.8rem', fontWeight:800, color:k.color }}>{k.count}</div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', fontWeight:500 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:0, border:'1px solid var(--border)', borderRadius:8,
        overflow:'hidden', width:'fit-content' }}>
        {['active','completed','all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:'8px 18px', border:'none', fontSize:'0.84rem', fontWeight:600,
              cursor:'pointer', background: filter === f ? '#16a34a' : 'transparent',
              color: filter === f ? 'white' : 'var(--text-muted)',
              borderRight: f !== 'all' ? '1px solid var(--border)' : 'none' }}>
            {f === 'active' ? 'Active' : f === 'completed' ? 'Completed' : 'All'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="lp-empty">
          {filter === 'completed' ? '✅ No completed tasks yet.' : '🎉 No active tasks. You\'re all caught up!'}
        </div>
      ) : (
        <div className="lp-activity-list">
          {filtered.map(a => (
            <div key={a._id} className="lp-activity-item">
              <div className="lp-activity-top">
                <div>
                  <strong style={{ fontSize:'0.95rem' }}>{a.title}</strong>
                  <div style={{ display:'flex', gap:6, marginTop:4, flexWrap:'wrap' }}>
                    <span className="lp-badge" style={STATUS_COLORS[a.status]}>{a.status.replace('_',' ')}</span>
                    <span className="lp-badge" style={PRIORITY_COLORS[a.priority]}>{a.priority}</span>
                  </div>
                </div>
              </div>
              {a.description && <p className="lp-activity-desc">{a.description}</p>}
              <div className="lp-activity-meta">
                <span>🌾 {a.farmId?.name || '—'}</span>
                {a.dueDate && (
                  <span style={{ color: new Date(a.dueDate) < new Date() && a.status !== 'completed' ? '#b91c1c' : 'inherit' }}>
                    📅 Due: {new Date(a.dueDate).toLocaleDateString()}
                    {new Date(a.dueDate) < new Date() && a.status !== 'completed' && ' ⚠️ Overdue'}
                  </span>
                )}
                {a.completedAt && <span>✅ Done: {new Date(a.completedAt).toLocaleDateString()}</span>}
              </div>
              {/* Action buttons — only for non-completed */}
              {a.status !== 'completed' && a.status !== 'cancelled' && (
                <div className="lp-activity-actions">
                  {a.status === 'pending' && (
                    <button className="lp-btn-sm lp-btn-blue" onClick={() => updateStatus(a._id, 'in_progress')}>
                      ▶ Start Task
                    </button>
                  )}
                  {a.status === 'in_progress' && (
                    <>
                      {/* Photo attachment */}
                      <label style={{ display:'inline-flex', alignItems:'center', gap:5,
                        padding:'5px 12px', borderRadius:7, fontSize:'0.8rem', fontWeight:600,
                        background: photos[a._id] ? '#dcfce7' : '#dbeafe',
                        color: photos[a._id] ? '#15803d' : '#1e40af', cursor:'pointer' }}>
                        📷 {photos[a._id] ? '✅ Photo ready' : 'Attach Photo'}
                        <input type="file" accept="image/*" style={{ display:'none' }}
                          onChange={e => handlePhotoAttach(a._id, e.target.files?.[0])} />
                      </label>
                      <button className="lp-btn-sm lp-btn-green" onClick={() => updateStatus(a._id, 'completed')}>
                        ✔ Mark Complete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
