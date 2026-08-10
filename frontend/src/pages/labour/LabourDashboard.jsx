import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { AuthContext } from '../../context/AuthContext';
import { API_URL, SOCKET_URL } from '../../config/api';
import './LabourPages.css';

const STATUS_COLORS = {
  pending:     { bg: '#fef3c7', color: '#92400e' },
  in_progress: { bg: '#dbeafe', color: '#1e40af' },
  completed:   { bg: '#dcfce7', color: '#15803d' },
  cancelled:   { bg: '#fee2e2', color: '#b91c1c' },
};

export default function LabourDashboard() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const [activities, setActivities]   = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [devices, setDevices]         = useState([]);
  const [pumpStatus, setPumpStatus]   = useState('OFF');
  const [pumpLoading, setPumpLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [farms, setFarms]             = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [alerts, setAlerts]           = useState([]);
  const [payroll, setPayroll]         = useState([]);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const load = async () => {
      try {
        const [actRes, farmRes, payRes] = await Promise.all([
          axios.get(`${API_URL}/api/activities`, cfg),
          axios.get(`${API_URL}/api/farms`, cfg),
          axios.get(`${API_URL}/api/payroll`, cfg),
        ]);
        setActivities(actRes.data);
        setFarms(farmRes.data);
        setPayroll(payRes.data);
        if (farmRes.data.length > 0) setSelectedFarm(farmRes.data[0]);
      } catch (err) {
        console.error('Labour load error:', err);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  // Load today's attendance on farm select
  useEffect(() => {
    if (!selectedFarm) return;
    axios.get(`${API_URL}/api/attendance?farmId=${selectedFarm._id}&date=${today}`, cfg)
      .then(r => {
        const mine = r.data.find(rec => rec.userId?._id === user._id || rec.userId === user._id);
        setTodayAttendance(mine || null);
      }).catch(() => {});

    axios.get(`${API_URL}/api/devices?farmId=${selectedFarm._id}`, cfg)
      .then(r => {
        setDevices(r.data);
        const online = r.data.find(d => d.status === 'online');
        if (online) setPumpStatus(online.lastPumpStatus || 'OFF');
      }).catch(() => {});
  }, [selectedFarm]);

  // WebSocket — listen for pump/sensor updates
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('sensor:update', payload => {
      setPumpStatus(payload.pumpStatus || 'OFF');
    });
    socket.on('system:alert', alert => {
      setAlerts(prev => [{ ...alert, ts: new Date() }, ...prev].slice(0, 5));
    });
    return () => socket.disconnect();
  }, []);

  const handleTogglePump = async () => {
    const activeDevice = devices.find(d => d.status === 'online');
    if (!activeDevice) return;
    const nextAction = pumpStatus === 'ON' ? 'PUMP_OFF' : 'PUMP_ON';
    setPumpLoading(true);
    try {
      await axios.post(`${API_URL}/api/irrigation/manual`, {
        deviceId: activeDevice._id, action: nextAction
      }, cfg);
      setPumpStatus(nextAction === 'PUMP_ON' ? 'ON' : 'OFF');
    } catch (err) {
      console.error('Pump toggle failed:', err);
    } finally { setPumpLoading(false); }
  };

  const handleCheckIn = async () => {
    if (!selectedFarm || todayAttendance?.checkIn) return;
    setCheckLoading(true);
    try {
      const r = await axios.post(`${API_URL}/api/attendance/checkin`, { farmId: selectedFarm._id }, cfg);
      setTodayAttendance(r.data);
    } catch (err) { console.error('Check-in failed:', err); }
    finally { setCheckLoading(false); }
  };

  const handleCheckOut = async () => {
    if (!todayAttendance?.checkIn || todayAttendance?.checkOut) return;
    setCheckLoading(true);
    try {
      const r = await axios.post(`${API_URL}/api/attendance/checkout`, {}, cfg);
      setTodayAttendance(r.data);
    } catch (err) { console.error('Check-out failed:', err); }
    finally { setCheckLoading(false); }
  };

  const updateActivityStatus = async (id, status) => {
    await axios.put(`${API_URL}/api/activities/${id}`, { status }, cfg);
    setActivities(prev => prev.map(a => a._id === id ? { ...a, status } : a));
  };

  const isOnline = devices.some(d => d.status === 'online');
  const pendingActivities = activities.filter(a => a.status !== 'completed' && a.status !== 'cancelled');

  if (loading) return <div className="lp-loading">Loading your dashboard…</div>;

  return (
    <div className="lp-page">
      <div className="lp-header">
        <h2>🧑‍🌾 Labour Dashboard</h2>
        <p className="lp-subtitle">Welcome back, <strong>{user.name}</strong>. Here's your workday at a glance.</p>
      </div>

      <div className="lp-grid">

        {/* ── Attendance Card ──────────────────────────────── */}
        <div className="lp-card lp-attendance-card">
          <h3>🗓️ Today's Attendance</h3>
          <div className="lp-date-badge">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>

          {farms.length > 0 && (
            <div className="lp-field">
              <label>Farm</label>
              <select value={selectedFarm?._id || ''} onChange={e => setSelectedFarm(farms.find(f => f._id === e.target.value))} className="lp-select">
                {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
            </div>
          )}

          <div className="lp-attendance-status">
            <div className="lp-stat">
              <span className="lp-stat-label">Check In</span>
              <span className="lp-stat-value">{todayAttendance?.checkIn ? new Date(todayAttendance.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat-label">Check Out</span>
              <span className="lp-stat-value">{todayAttendance?.checkOut ? new Date(todayAttendance.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat-label">Hours</span>
              <span className="lp-stat-value">{todayAttendance?.hoursWorked > 0 ? `${todayAttendance.hoursWorked}h` : '—'}</span>
            </div>
          </div>

          <div className="lp-attendance-btns">
            <button className="lp-btn lp-btn-checkin"
              onClick={handleCheckIn}
              disabled={!!todayAttendance?.checkIn || checkLoading || !selectedFarm}>
              {checkLoading ? '…' : todayAttendance?.checkIn ? '✅ Checked In' : '✅ Check In'}
            </button>
            <button className="lp-btn lp-btn-checkout"
              onClick={handleCheckOut}
              disabled={!todayAttendance?.checkIn || !!todayAttendance?.checkOut || checkLoading}>
              {todayAttendance?.checkOut ? '🏁 Done' : '🏁 Check Out'}
            </button>
          </div>
        </div>

        {/* ── Pump Control Card ────────────────────────────── */}
        <div className="lp-card lp-pump-card">
          <h3>🚰 Pump Control</h3>
          <p className="lp-muted">Manually start or stop the irrigation pump for your farm.</p>

          <div className="lp-pump-status" style={{ background: pumpStatus === 'ON' ? '#fee2e2' : '#dcfce7' }}>
            <span style={{ color: pumpStatus === 'ON' ? '#b91c1c' : '#15803d', fontWeight: 700 }}>
              {pumpStatus === 'ON' ? '💧 Pump is RUNNING' : '⏹️ Pump is STOPPED'}
            </span>
          </div>

          {!isOnline && (
            <div className="lp-offline-note">⚠️ No device online — pump control disabled.</div>
          )}

          <button
            className={`lp-pump-btn ${pumpStatus === 'ON' ? 'lp-pump-stop' : 'lp-pump-start'}`}
            onClick={handleTogglePump}
            disabled={!isOnline || pumpLoading}>
            {pumpLoading ? 'Please wait…' : pumpStatus === 'ON' ? '🛑 Stop Pump' : '💧 Start Pump'}
          </button>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="lp-alerts">
              {alerts.map((a, i) => (
                <div key={i} className={`lp-alert lp-alert-${a.type || 'warning'}`}>⚠️ {a.message}</div>
              ))}
            </div>
          )}
        </div>

        {/* ── Assigned Activities ──────────────────────────── */}
        <div className="lp-card lp-activities-card">
          <h3>📋 My Assigned Activities</h3>
          {pendingActivities.length === 0 ? (
            <div className="lp-empty">No pending activities. All caught up! ✅</div>
          ) : (
            <div className="lp-activity-list">
              {pendingActivities.map(a => (
                <div key={a._id} className="lp-activity-item">
                  <div className="lp-activity-top">
                    <strong>{a.title}</strong>
                    <span className="lp-badge" style={STATUS_COLORS[a.status]}>
                      {a.status.replace('_', ' ')}
                    </span>
                  </div>
                  {a.description && <p className="lp-activity-desc">{a.description}</p>}
                  <div className="lp-activity-meta">
                    <span>🌾 {a.farmId?.name || '—'}</span>
                    {a.dueDate && <span>📅 Due: {new Date(a.dueDate).toLocaleDateString()}</span>}
                  </div>
                  <div className="lp-activity-actions">
                    {a.status === 'pending' && (
                      <button className="lp-btn-sm lp-btn-blue" onClick={() => updateActivityStatus(a._id, 'in_progress')}>
                        ▶ Start
                      </button>
                    )}
                    {a.status === 'in_progress' && (
                      <button className="lp-btn-sm lp-btn-green" onClick={() => updateActivityStatus(a._id, 'completed')}>
                        ✔ Mark Complete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── My Payroll Summary ───────────────────────────── */}
        {payroll.length > 0 && (
          <div className="lp-card">
            <h3>💰 My Recent Pay</h3>
            <div className="lp-payroll-list">
              {payroll.slice(0, 3).map(p => (
                <div key={p._id} className="lp-payroll-row">
                  <div>
                    <strong>{p.period}</strong>
                    <div className="lp-muted">{p.daysPresent} days · {p.hoursWorked}h</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong className="lp-pay-amount">ETB {p.netPay.toLocaleString()}</strong>
                    <div>
                      <span className="lp-badge" style={{
                        background: p.paymentStatus === 'paid' ? '#dcfce7' : '#fef3c7',
                        color: p.paymentStatus === 'paid' ? '#15803d' : '#92400e',
                      }}>{p.paymentStatus}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
