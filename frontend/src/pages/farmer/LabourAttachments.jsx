import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import './FarmerPages.css';

const STATUS_COLORS = {
  present:  { bg: '#dcfce7', color: '#15803d' },
  absent:   { bg: '#fee2e2', color: '#b91c1c' },
  late:     { bg: '#fef3c7', color: '#92400e' },
  half_day: { bg: '#dbeafe', color: '#1e40af' },
};

export default function LabourAttachments() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const currentMonth = new Date().toISOString().slice(0, 7);

  const [farms, setFarms]             = useState([]);
  const [selectedFarm, setSelectedFarm] = useState('');
  const [month, setMonth]             = useState(currentMonth);
  const [activities, setActivities]   = useState([]);
  const [attendance, setAttendance]   = useState([]);
  const [labourUsers, setLabourUsers] = useState([]);
  const [tab, setTab]                 = useState('activities'); // 'activities' | 'attendance'
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/api/farms`, cfg).then(r => {
      setFarms(r.data);
      if (r.data.length > 0) setSelectedFarm(r.data[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!selectedFarm) return;
    setLoading(true);
    Promise.all([
      axios.get(`${API_URL}/api/activities?farmId=${selectedFarm}`, cfg),
      axios.get(`${API_URL}/api/attendance/summary?farmId=${selectedFarm}&month=${month}`, cfg),
      axios.get(`${API_URL}/api/admin/users?role=labor&farmId=${selectedFarm}`, cfg),
    ]).then(([a, att, u]) => {
      setActivities(a.data);
      setAttendance(att.data);
      setLabourUsers(u.data);
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, [selectedFarm, month]);

  return (
    <div className="fp-page">
      <div className="fp-header">
        <h2>👷 Labour Attachments</h2>
        <p className="fp-subtitle">View labour assignments and attendance records for your farm.</p>
      </div>

      {/* Controls */}
      <div className="fp-controls">
        <div className="fp-field">
          <label>Farm</label>
          <select value={selectedFarm} onChange={e => setSelectedFarm(e.target.value)} className="fp-select">
            {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
          </select>
        </div>
        <div className="fp-field">
          <label>View</label>
          <div className="fp-tab-group">
            <button className={`fp-tab ${tab === 'activities' ? 'active' : ''}`} onClick={() => setTab('activities')}>Activities</button>
            <button className={`fp-tab ${tab === 'attendance' ? 'active' : ''}`} onClick={() => setTab('attendance')}>Attendance</button>
          </div>
        </div>
        {tab === 'attendance' && (
          <div className="fp-field">
            <label>Month</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="fp-select" />
          </div>
        )}
      </div>

      {/* Labour Summary KPI */}
      <div className="fp-kpi-row">
        <div className="fp-kpi" style={{ background: '#dbeafe' }}>
          <span className="fp-kpi-icon">👷</span>
          <div className="fp-kpi-value" style={{ color: '#1d4ed8' }}>{labourUsers.length}</div>
          <div className="fp-kpi-label">Attached Labour</div>
        </div>
        <div className="fp-kpi" style={{ background: '#fef3c7' }}>
          <span className="fp-kpi-icon">📋</span>
          <div className="fp-kpi-value" style={{ color: '#92400e' }}>
            {activities.filter(a => a.status === 'pending' || a.status === 'in_progress').length}
          </div>
          <div className="fp-kpi-label">Active Tasks</div>
        </div>
        <div className="fp-kpi" style={{ background: '#dcfce7' }}>
          <span className="fp-kpi-icon">✅</span>
          <div className="fp-kpi-value" style={{ color: '#15803d' }}>
            {activities.filter(a => a.status === 'completed').length}
          </div>
          <div className="fp-kpi-label">Completed Tasks</div>
        </div>
      </div>

      {loading ? <div className="fp-loading">Loading…</div> : (
        <>
          {/* Activities Tab */}
          {tab === 'activities' && (
            activities.length === 0 ? (
              <div className="fp-card fp-empty-card"><p>No activities assigned yet for this farm.</p></div>
            ) : (
              <div className="fp-card fp-no-pad">
                <table className="fp-table">
                  <thead><tr><th>Task</th><th>Assigned To</th><th>Priority</th><th>Due Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {activities.map(a => (
                      <tr key={a._id}>
                        <td><strong>{a.title}</strong>{a.description && <div className="fp-sub">{a.description.slice(0,60)}</div>}</td>
                        <td>{a.assignedTo?.length > 0 ? a.assignedTo.map(u => u.name).join(', ') : <span className="fp-muted">Unassigned</span>}</td>
                        <td><span className="fp-badge" style={{ background: a.priority === 'high' ? '#fee2e2' : a.priority === 'medium' ? '#fef3c7' : '#dcfce7', color: a.priority === 'high' ? '#b91c1c' : a.priority === 'medium' ? '#92400e' : '#15803d' }}>{a.priority}</span></td>
                        <td>{a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—'}</td>
                        <td><span className="fp-badge" style={{ background: a.status === 'completed' ? '#dcfce7' : a.status === 'in_progress' ? '#dbeafe' : '#fef3c7', color: a.status === 'completed' ? '#15803d' : a.status === 'in_progress' ? '#1d4ed8' : '#92400e' }}>{a.status.replace('_',' ')}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Attendance Tab */}
          {tab === 'attendance' && (
            attendance.length === 0 ? (
              <div className="fp-card fp-empty-card"><p>No attendance records for {month}.</p></div>
            ) : (
              <div className="fp-card fp-no-pad">
                <table className="fp-table">
                  <thead><tr><th>Worker</th><th>Present</th><th>Absent</th><th>Late</th><th>Half Day</th><th>Total Hours</th></tr></thead>
                  <tbody>
                    {attendance.map((s, i) => (
                      <tr key={i}>
                        <td><strong>{s.user?.name}</strong><div className="fp-sub">{s.user?.email}</div></td>
                        <td><span className="fp-badge" style={STATUS_COLORS.present}>{s.present}</span></td>
                        <td><span className="fp-badge" style={STATUS_COLORS.absent}>{s.absent}</span></td>
                        <td><span className="fp-badge" style={STATUS_COLORS.late}>{s.late}</span></td>
                        <td><span className="fp-badge" style={STATUS_COLORS.half_day}>{s.half_day}</span></td>
                        <td><strong>{s.totalHours}h</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
