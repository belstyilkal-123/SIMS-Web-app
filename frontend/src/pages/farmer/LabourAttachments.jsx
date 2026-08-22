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
  const [tab, setTab]                 = useState('activities');
  const [loading, setLoading]         = useState(false);

  // Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableLabor, setAvailableLabor]   = useState([]);
  const [assignUserId, setAssignUserId]       = useState('');
  const [assigning, setAssigning]             = useState(false);

  // Attendance Modal
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attForm, setAttForm] = useState({ userId: '', date: new Date().toISOString().slice(0,10), status: 'present', checkIn: '', checkOut: '' });
  const [attSaving, setAttSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/api/farms`, cfg).then(r => {
      setFarms(r.data);
      if (r.data.length > 0) setSelectedFarm(r.data[0]._id);
    });
  }, []);

  const loadData = () => {
    if (!selectedFarm) return;
    setLoading(true);
    Promise.all([
      axios.get(`${API_URL}/api/tasks?farmId=${selectedFarm}`, cfg),
      axios.get(`${API_URL}/api/attendance/summary?farmId=${selectedFarm}&month=${month}`, cfg),
      axios.get(`${API_URL}/api/admin/users?role=labor&farmId=${selectedFarm}`, cfg),
    ]).then(([a, att, u]) => {
      setActivities(a.data);
      setAttendance(att.data);
      setLabourUsers(u.data);
    }).catch(console.error)
    .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [selectedFarm, month]);

  const handleOpenAssign = async () => {
    setShowAssignModal(true);
    try {
      const res = await axios.get(`${API_URL}/api/farms/available-labor/all`, cfg);
      setAvailableLabor(res.data);
      if (res.data.length > 0) setAssignUserId(res.data[0]._id);
    } catch (err) {
      console.error(err);
    }
  };

  const submitAttendance = async (e) => {
    e.preventDefault();
    if (!selectedFarm || !attForm.userId) return;
    setAttSaving(true);
    try {
      const payload = { ...attForm, farmId: selectedFarm };
      if (payload.checkIn) payload.checkIn = payload.date + 'T' + payload.checkIn;
      if (payload.checkOut) payload.checkOut = payload.date + 'T' + payload.checkOut;
      await axios.post(API_URL + '/api/attendance', payload, cfg);
      setShowAttendanceModal(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to mark attendance');
    } finally {
      setAttSaving(false);
    }
  };

  const submitAssign = async (e) => {
    e.preventDefault();
    if (!assignUserId || !selectedFarm) return;
    setAssigning(true);
    try {
      const res = await axios.post(`${API_URL}/api/farms/${selectedFarm}/labor`, { userId: assignUserId }, cfg);
      alert(res.data.message);
      setShowAssignModal(false);
      setAssignUserId('');
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to assign labor');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fp-page">
      <div className="fp-header">
        <div>
          <h2>👷 Labour Attachments</h2>
          <p className="fp-subtitle">View labour assignments and attendance records for your farm.</p>
        </div>
        {selectedFarm && (
          <div>
            <button className="fp-btn fp-btn-primary" style={{ marginRight: 10 }} onClick={() => setShowAttendanceModal(true)}>
              + Mark Attendance
            </button>
            <button className="fp-btn fp-btn-primary" onClick={handleOpenAssign}>
              + Assign Labour
            </button>
          </div>
        )}
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
            <button className={`fp-tab ${tab === 'activities' ? 'active' : ''}`} onClick={() => setTab('activities')}>Tasks</button>
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

      {/* Content */}
      <div className="fp-content">
        {loading ? (
          <div className="fp-loading">Loading...</div>
        ) : (
          <>
            {tab === 'activities' && (
              <div className="fp-section">
                <h3>Active Tasks by Labour</h3>
                {labourUsers.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No labour assigned to this farm.</p>
                ) : (
                  <div className="fp-grid">
                    {labourUsers.map(u => {
                      const userActs = activities.filter(a => {
                        if (a.status !== 'pending' && a.status !== 'in_progress') return false;
                        if (Array.isArray(a.assignedTo)) {
                          return a.assignedTo.some(x => (x._id || x) === u._id);
                        }
                        return (a.assignedTo?._id || a.assignedTo) === u._id;
                      });
                      return (
                        <div key={u._id} className="fp-card">
                          <h4 style={{ margin: '0 0 12px 0', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                            {u.name} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({userActs.length})</span>
                          </h4>
                          {userActs.length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No active tasks.</p>
                          ) : (
                            <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                              {userActs.map(a => (
                                <li key={a._id} style={{ marginBottom: 6 }}>
                                  <strong>{a.title}</strong> — {a.status.replace('_', ' ')}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                    {/* Show other active tasks (unassigned or assigned to farmer) */}
                    {(() => {
                      const labourUserIds = labourUsers.map(u => u._id);
                      const otherTasks = activities.filter(a => {
                        if (a.status !== 'pending' && a.status !== 'in_progress') return false;
                        if (Array.isArray(a.assignedTo) && a.assignedTo.length > 0) {
                          return !a.assignedTo.some(x => labourUserIds.includes(x._id || x));
                        }
                        const assignedId = a.assignedTo?._id || a.assignedTo;
                        return !assignedId || !labourUserIds.includes(assignedId);
                      });
                      if (otherTasks.length === 0) return null;
                      return (
                        <div className="fp-card" style={{ background: '#f8fafc', borderStyle: 'dashed' }}>
                          <h4 style={{ margin: '0 0 12px 0', borderBottom: '1px dashed var(--border)', paddingBottom: 8, color: '#475569' }}>
                            Other / Unassigned <span style={{ fontSize: '0.8rem' }}>({otherTasks.length})</span>
                          </h4>
                          <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                            {otherTasks.map(a => (
                              <li key={a._id} style={{ marginBottom: 6 }}>
                                <strong>{a.title}</strong> — {a.status.replace('_', ' ')}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {tab === 'attendance' && (
              <div className="fp-section">
                <h3>Attendance Summary ({month})</h3>
                <div style={{ overflowX: 'auto', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <table className="fp-table">
                    <thead>
                      <tr>
                        <th>Labour Name</th>
                        <th>Present</th>
                        <th>Absent</th>
                        <th>Late</th>
                        <th>Half Day</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map(row => (
                        <tr key={row.user?._id || Math.random()}>
                          <td>{row.user?.name || 'Unknown'}</td>
                          <td><span className="fp-badge" style={STATUS_COLORS.present}>{row.present || 0}</span></td>
                          <td><span className="fp-badge" style={STATUS_COLORS.absent}>{row.absent || 0}</span></td>
                          <td><span className="fp-badge" style={STATUS_COLORS.late}>{row.late || 0}</span></td>
                          <td><span className="fp-badge" style={STATUS_COLORS.half_day}>{row.half_day || 0}</span></td>
                        </tr>
                      ))}
                      {attendance.length === 0 && (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                            No attendance records found for this month.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mark Attendance Modal */}
      {showAttendanceModal && (
        <div className="fp-modal-backdrop" onClick={() => setShowAttendanceModal(false)} style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }}>
          <div className="fp-modal-content" onClick={e => e.stopPropagation()} style={{ background:'var(--bg)', padding:24, borderRadius:12, width:'100%', maxWidth:400 }}>
            <h3 style={{ margin:'0 0 16px 0' }}>Mark Attendance</h3>
            <form onSubmit={submitAttendance}>
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', marginBottom:4, fontSize:'0.9rem' }}>Worker</label>
                <select required value={attForm.userId} onChange={e => setAttForm({...attForm, userId: e.target.value})} style={{ width:'100%', padding:'8px' }}>
                  <option value="">Select worker...</option>
                  {labourUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', marginBottom:4, fontSize:'0.9rem' }}>Date</label>
                <input required type="date" value={attForm.date} onChange={e => setAttForm({...attForm, date: e.target.value})} style={{ width:'100%', padding:'8px' }} />
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', marginBottom:4, fontSize:'0.9rem' }}>Status</label>
                <select value={attForm.status} onChange={e => setAttForm({...attForm, status: e.target.value})} style={{ width:'100%', padding:'8px' }}>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="half_day">Half Day</option>
                </select>
              </div>
              <div style={{ display:'flex', gap:10, marginBottom:16 }}>
                <div style={{ flex:1 }}>
                  <label style={{ display:'block', marginBottom:4, fontSize:'0.9rem' }}>Check In</label>
                  <input type="time" value={attForm.checkIn} onChange={e => setAttForm({...attForm, checkIn: e.target.value})} style={{ width:'100%', padding:'8px' }} />
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ display:'block', marginBottom:4, fontSize:'0.9rem' }}>Check Out</label>
                  <input type="time" value={attForm.checkOut} onChange={e => setAttForm({...attForm, checkOut: e.target.value})} style={{ width:'100%', padding:'8px' }} />
                </div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="submit" disabled={attSaving || !attForm.userId} style={{ flex:1, padding:10, borderRadius:8, border:'none', background:'linear-gradient(135deg,#16a34a,#15803d)', color:'white', fontWeight:600, cursor:'pointer' }}>
                  {attSaving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={() => setShowAttendanceModal(false)} style={{ flex:1, padding:10, borderRadius:8, border:'none', background:'#f1f5f9', color:'#475569', fontWeight:600, cursor:'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fp-modal-backdrop" onClick={() => setShowAssignModal(false)} style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }}>
          <div className="fp-modal-content" onClick={e => e.stopPropagation()} style={{ background:'var(--bg)', padding:24, borderRadius:12, width:'100%', maxWidth:400 }}>
            <h3 style={{ margin:'0 0 16px 0' }}>Assign Labour to Farm</h3>
            <form onSubmit={submitAssign}>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', marginBottom:8, fontSize:'0.9rem', fontWeight:600 }}>Select Labourer</label>
                <select 
                  value={assignUserId} 
                  onChange={e => setAssignUserId(e.target.value)} 
                  disabled={availableLabor.length === 0}
                  style={{ 
                    width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid var(--border)', 
                    background:'var(--surface)', color:'var(--text-main)',
                    opacity: availableLabor.length === 0 ? 0.6 : 1,
                    cursor: availableLabor.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  {availableLabor.length === 0 && <option value="">— No available labourers to assign —</option>}
                  {availableLabor.map(u => (
                    <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
              {availableLabor.length === 0 && (
                <div style={{ marginBottom: 16, fontSize: '0.85rem', color: 'var(--danger)', background: '#fee2e2', padding: '8px 12px', borderRadius: 6 }}>
                  ⚠️ All registered laborers are currently assigned to other farms. Please ask an Administrator or Office Manager to register new laborers.
                </div>
              )}
              <div style={{ display:'flex', gap:10 }}>
                <button type="submit" disabled={assigning || !assignUserId} style={{ flex:1, padding:10, borderRadius:8, border:'none', background:'linear-gradient(135deg,#16a34a,#15803d)', color:'white', fontWeight:600, cursor:'pointer' }}>
                  {assigning ? 'Assigning...' : 'Assign'}
                </button>
                <button type="button" onClick={() => setShowAssignModal(false)} style={{ flex:1, padding:10, borderRadius:8, border:'none', background:'#f1f5f9', color:'#475569', fontWeight:600, cursor:'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
