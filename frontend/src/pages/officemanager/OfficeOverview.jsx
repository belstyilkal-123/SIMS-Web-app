import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import './OfficePages.css';

export default function OfficeOverview() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const today        = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [farms, setFarms]         = useState([]);
  const [selectedFarm, setSelectedFarm] = useState('');
  const [todayAtt, setTodayAtt]   = useState([]);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [payrollStats, setPayrollStats]     = useState({ total:0, pending:0, paid:0, workers:0 });
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/farms`, cfg)
      .then(r => {
        setFarms(r.data || []);
        if (r.data && r.data.length > 0) {
          setSelectedFarm(r.data[0]._id);
        } else {
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Failed to fetch farms:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedFarm) return;
    setLoading(true);
    Promise.all([
      axios.get(`${API_URL}/api/attendance?farmId=${selectedFarm}&date=${today}`, cfg).catch(() => ({ data: [] })),
      axios.get(`${API_URL}/api/attendance/summary?farmId=${selectedFarm}&month=${currentMonth}`, cfg).catch(() => ({ data: [] })),
      axios.get(`${API_URL}/api/payroll?farmId=${selectedFarm}&period=${currentMonth}`, cfg).catch(() => ({ data: [] })),
    ]).then(([att, sum, pay]) => {
      setTodayAtt(att.data || []);
      setMonthlySummary(sum.data || []);
      const records = pay.data || [];
      setPayrollStats({
        total:   records.reduce((s,r) => s + (r.netPay||0), 0),
        pending: records.filter(r => r.paymentStatus==='pending').reduce((s,r) => s+(r.netPay||0), 0),
        paid:    records.filter(r => r.paymentStatus==='paid').reduce((s,r) => s+(r.netPay||0), 0),
        workers: records.length,
      });
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, [selectedFarm]);

  const presentToday = todayAtt.filter(r => r.status !== 'absent').length;
  const absentToday  = todayAtt.filter(r => r.status === 'absent').length;

  return (
    <div className="op-page">
      <div className="op-header">
        <h2>📊 Office Manager Dashboard</h2>
        <p className="op-subtitle">Attendance and payroll overview for {currentMonth}.</p>
      </div>

      {/* Farm selector */}
      {farms.length > 1 && (
        <div className="op-field" style={{ maxWidth:260 }}>
          <label>Farm</label>
          <select value={selectedFarm} onChange={e => setSelectedFarm(e.target.value)} className="op-select">
            {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
          </select>
        </div>
      )}

      {loading ? <div className="op-loading">Loading…</div> : (
        <>
          {/* KPI cards */}
          <div className="op-kpi-row">
            {[
              { icon:'👷', label:"Present Today",   value: presentToday,                          bg:'#dcfce7', color:'#15803d' },
              { icon:'❌', label:"Absent Today",    value: absentToday,                           bg:'#fee2e2', color:'#b91c1c' },
              { icon:'💰', label:"Total Payroll",   value:`ETB ${payrollStats.total.toLocaleString()}`,   bg:'#ede9fe', color:'#7c3aed' },
              { icon:'⏳', label:"Pending Payment", value:`ETB ${payrollStats.pending.toLocaleString()}`, bg:'#fef3c7', color:'#92400e' },
              { icon:'✅', label:"Paid Out",        value:`ETB ${payrollStats.paid.toLocaleString()}`,    bg:'#dcfce7', color:'#15803d' },
              { icon:'👥', label:"Workers on Payroll", value: payrollStats.workers,               bg:'#dbeafe', color:'#1d4ed8' },
            ].map(k => (
              <div key={k.label} className="op-kpi" style={{ background:k.bg }}>
                <div style={{ fontSize:'1.3rem' }}>{k.icon}</div>
                <div className="op-kpi-value" style={{ color:k.color, fontSize:'1.3rem' }}>{k.value}</div>
                <div className="op-kpi-label">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Today's attendance table */}
          {todayAtt.length > 0 && (
            <div className="op-card">
              <h3>🗓️ Today's Attendance — {today}</h3>
              <div className="op-card op-no-pad" style={{ marginTop:12 }}>
                <table className="op-table">
                  <thead><tr><th>Worker</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th></tr></thead>
                  <tbody>
                    {todayAtt.map(r => (
                      <tr key={r._id}>
                        <td><strong>{r.userId?.name||'—'}</strong><div className="op-sub">{r.userId?.email}</div></td>
                        <td>{r.checkIn ? new Date(r.checkIn).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                        <td>{r.checkOut ? new Date(r.checkOut).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                        <td>{r.hoursWorked > 0 ? `${r.hoursWorked}h` : '—'}</td>
                        <td>
                          <span className="op-badge" style={{
                            background: r.status==='present'?'#dcfce7':r.status==='absent'?'#fee2e2':r.status==='late'?'#fef3c7':'#dbeafe',
                            color:      r.status==='present'?'#15803d':r.status==='absent'?'#b91c1c':r.status==='late'?'#92400e':'#1d4ed8',
                          }}>{r.status.replace('_',' ')}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Monthly summary */}
          {monthlySummary.length > 0 && (
            <div className="op-card">
              <h3>📈 Monthly Summary — {currentMonth}</h3>
              <div className="op-card op-no-pad" style={{ marginTop:12 }}>
                <table className="op-table">
                  <thead><tr><th>Worker</th><th>Present</th><th>Absent</th><th>Late</th><th>Half Day</th><th>Total Hours</th></tr></thead>
                  <tbody>
                    {monthlySummary.map((s,i) => (
                      <tr key={i}>
                        <td><strong>{s.user?.name}</strong><div className="op-sub">{s.user?.email}</div></td>
                        <td><span className="op-badge" style={{background:'#dcfce7',color:'#15803d'}}>{s.present}</span></td>
                        <td><span className="op-badge" style={{background:'#fee2e2',color:'#b91c1c'}}>{s.absent}</span></td>
                        <td><span className="op-badge" style={{background:'#fef3c7',color:'#92400e'}}>{s.late}</span></td>
                        <td><span className="op-badge" style={{background:'#dbeafe',color:'#1d4ed8'}}>{s.half_day}</span></td>
                        <td><strong>{s.totalHours}h</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
