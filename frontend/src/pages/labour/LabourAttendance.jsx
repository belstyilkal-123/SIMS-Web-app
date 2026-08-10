import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import './LabourPages.css';

const STATUS_COLORS = {
  present:  { bg: '#dcfce7', color: '#15803d' },
  absent:   { bg: '#fee2e2', color: '#b91c1c' },
  late:     { bg: '#fef3c7', color: '#92400e' },
  half_day: { bg: '#dbeafe', color: '#1e40af' },
};

export default function LabourAttendance() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const today        = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [farms, setFarms]               = useState([]);
  const [selectedFarm, setSelectedFarm] = useState('');
  const [todayRecord, setTodayRecord]   = useState(null);
  const [records, setRecords]           = useState([]);
  const [month, setMonth]               = useState(currentMonth);
  const [loading, setLoading]           = useState(true);
  const [checkLoading, setCheckLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/api/farms`, cfg).then(r => {
      setFarms(r.data);
      if (r.data.length > 0) setSelectedFarm(r.data[0]._id);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedFarm) return;
    // Today's record
    axios.get(`${API_URL}/api/attendance?farmId=${selectedFarm}&date=${today}`, cfg)
      .then(r => {
        const mine = r.data.find(rec => rec.userId?._id === user._id || rec.userId === user._id);
        setTodayRecord(mine || null);
      }).catch(() => {});
    // Monthly history
    axios.get(`${API_URL}/api/attendance?farmId=${selectedFarm}`, cfg)
      .then(r => setRecords(r.data.filter(rec => rec.date?.startsWith(month))))
      .catch(() => {});
  }, [selectedFarm, month]);

  const handleCheckIn = async () => {
    if (!selectedFarm || todayRecord?.checkIn) return;
    setCheckLoading(true);
    try {
      const r = await axios.post(`${API_URL}/api/attendance/checkin`, { farmId: selectedFarm }, cfg);
      setTodayRecord(r.data);
    } catch (err) { console.error(err); }
    finally { setCheckLoading(false); }
  };

  const handleCheckOut = async () => {
    if (!todayRecord?.checkIn || todayRecord?.checkOut) return;
    setCheckLoading(true);
    try {
      const r = await axios.post(`${API_URL}/api/attendance/checkout`, {}, cfg);
      setTodayRecord(r.data);
    } catch (err) { console.error(err); }
    finally { setCheckLoading(false); }
  };

  // Monthly summary stats
  const summary = {
    present:    records.filter(r => r.status === 'present').length,
    absent:     records.filter(r => r.status === 'absent').length,
    late:       records.filter(r => r.status === 'late').length,
    half_day:   records.filter(r => r.status === 'half_day').length,
    totalHours: parseFloat(records.reduce((s, r) => s + (r.hoursWorked || 0), 0).toFixed(1)),
  };

  if (loading) return <div className="lp-loading">Loading attendance…</div>;

  return (
    <div className="lp-page">
      <div className="lp-header">
        <h2>🗓️ My Attendance</h2>
        <p className="lp-subtitle">Track your daily check-in, check-out, and monthly summary.</p>
      </div>

      {/* Farm selector */}
      {farms.length > 1 && (
        <div className="lp-field">
          <label>Farm</label>
          <select value={selectedFarm} onChange={e => setSelectedFarm(e.target.value)} className="lp-select" style={{ maxWidth:260 }}>
            {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
          </select>
        </div>
      )}

      {/* Today's check-in card */}
      <div className="lp-card">
        <h3>🗓️ Today — {new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</h3>

        <div className="lp-attendance-status">
          <div className="lp-stat">
            <span className="lp-stat-label">Check In</span>
            <span className="lp-stat-value">
              {todayRecord?.checkIn ? new Date(todayRecord.checkIn).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—'}
            </span>
          </div>
          <div className="lp-stat">
            <span className="lp-stat-label">Check Out</span>
            <span className="lp-stat-value">
              {todayRecord?.checkOut ? new Date(todayRecord.checkOut).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—'}
            </span>
          </div>
          <div className="lp-stat">
            <span className="lp-stat-label">Hours Today</span>
            <span className="lp-stat-value">{todayRecord?.hoursWorked > 0 ? `${todayRecord.hoursWorked}h` : '—'}</span>
          </div>
          <div className="lp-stat">
            <span className="lp-stat-label">Status</span>
            {todayRecord
              ? <span className="lp-badge" style={STATUS_COLORS[todayRecord.status]}>{todayRecord.status.replace('_',' ')}</span>
              : <span style={{ color:'var(--text-muted)', fontSize:'0.9rem' }}>Not checked in</span>}
          </div>
        </div>

        <div className="lp-attendance-btns">
          <button className="lp-btn lp-btn-checkin"
            onClick={handleCheckIn}
            disabled={!!todayRecord?.checkIn || checkLoading || !selectedFarm}>
            {checkLoading ? '…' : todayRecord?.checkIn ? '✅ Checked In' : '✅ Check In'}
          </button>
          <button className="lp-btn lp-btn-checkout"
            onClick={handleCheckOut}
            disabled={!todayRecord?.checkIn || !!todayRecord?.checkOut || checkLoading}>
            {todayRecord?.checkOut ? '🏁 Checked Out' : '🏁 Check Out'}
          </button>
        </div>
      </div>

      {/* Monthly summary */}
      <div className="lp-card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <h3>📊 Monthly Summary</h3>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding:'7px 12px', border:'1px solid var(--border)', borderRadius:8,
              fontSize:'0.875rem', background:'var(--surface)', color:'var(--text-main)' }} />
        </div>

        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {[
            { label:'Present',  count: summary.present,  ...STATUS_COLORS.present  },
            { label:'Absent',   count: summary.absent,   ...STATUS_COLORS.absent   },
            { label:'Late',     count: summary.late,     ...STATUS_COLORS.late     },
            { label:'Half Day', count: summary.half_day, ...STATUS_COLORS.half_day },
            { label:'Total Hours', count:`${summary.totalHours}h`, bg:'#ede9fe', color:'#7c3aed' },
          ].map(k => (
            <div key={k.label} style={{ flex:'1 1 80px', background:k.bg, borderRadius:10,
              padding:'12px 14px', textAlign:'center', border:`1px solid ${k.color}22` }}>
              <div style={{ fontSize:'1.5rem', fontWeight:800, color:k.color }}>{k.count}</div>
              <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:500 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Attendance history table */}
      {records.length > 0 && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14,
          overflow:'hidden', boxShadow:'var(--shadow-card)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.875rem' }}>
            <thead>
              <tr style={{ background:'var(--surface-hover)', borderBottom:'1px solid var(--border)' }}>
                {['Date','Check In','Check Out','Hours','Status'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'0.72rem',
                    fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.sort((a,b) => b.date.localeCompare(a.date)).map(r => (
                <tr key={r._id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'10px 14px', fontWeight:500 }}>{r.date}</td>
                  <td style={{ padding:'10px 14px' }}>
                    {r.checkIn ? new Date(r.checkIn).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—'}
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    {r.checkOut ? new Date(r.checkOut).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—'}
                  </td>
                  <td style={{ padding:'10px 14px' }}>{r.hoursWorked > 0 ? `${r.hoursWorked}h` : '—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span className="lp-badge" style={STATUS_COLORS[r.status]}>{r.status.replace('_',' ')}</span>
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
