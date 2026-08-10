import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { buildPdf } from '../../utils/pdfUtils';
import './OfficePages.css';

const STATUS_COLORS = {
  present:  { bg:'#dcfce7', color:'#15803d' },
  absent:   { bg:'#fee2e2', color:'#b91c1c' },
  late:     { bg:'#fef3c7', color:'#92400e' },
  half_day: { bg:'#dbeafe', color:'#1e40af' },
};

export default function OfficeAttendance() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [farms, setFarms]           = useState([]);
  const [selectedFarm, setSelectedFarm] = useState('');
  const [month, setMonth]           = useState(currentMonth);
  const [summary, setSummary]       = useState([]);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/api/farms`, cfg).then(r => {
      setFarms(r.data);
      if (r.data.length > 0) setSelectedFarm(r.data[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!selectedFarm) return;
    setLoading(true);
    axios.get(`${API_URL}/api/attendance/summary?farmId=${selectedFarm}&month=${month}`, cfg)
      .then(r => setSummary(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedFarm, month]);

  const handleExport = () => {
    const farmName = farms.find(f => f._id === selectedFarm)?.name || 'Farm';
    buildPdf({
      title:    `Attendance Summary — ${farmName}`,
      subtitle: `Period: ${month}  ·  ${summary.length} workers`,
      columns:  ['Worker', 'Email', 'Present', 'Absent', 'Late', 'Half Day', 'Total Hours'],
      rows: summary.map(s => [
        s.user?.name || '—', s.user?.email || '—',
        String(s.present), String(s.absent), String(s.late), String(s.half_day),
        `${s.totalHours}h`,
      ]),
      totalsRow: [
        'TOTALS', '',
        String(summary.reduce((n,s) => n+s.present,0)),
        String(summary.reduce((n,s) => n+s.absent,0)),
        String(summary.reduce((n,s) => n+s.late,0)),
        String(summary.reduce((n,s) => n+s.half_day,0)),
        `${summary.reduce((n,s) => n+s.totalHours,0).toFixed(1)}h`,
      ],
      fileName: `attendance_${month}_${farmName.replace(/\s+/g,'_')}`,
      orientation: 'l',
    });
  };

  return (
    <div className="op-page">
      <div className="op-header">
        <div>
          <h2>🗓️ Attendance Overview</h2>
          <p className="op-subtitle">Monthly attendance summary for payroll calculations.</p>
        </div>
        <button className="op-btn op-btn-pdf" onClick={handleExport} disabled={summary.length === 0}>
          📄 Export PDF
        </button>
      </div>

      <div className="op-controls">
        <div className="op-field">
          <label>Farm</label>
          <select value={selectedFarm} onChange={e => setSelectedFarm(e.target.value)} className="op-select">
            {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
          </select>
        </div>
        <div className="op-field">
          <label>Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="op-select" />
        </div>
      </div>

      {loading ? <div className="op-loading">Loading…</div> :
        summary.length === 0 ? <div className="op-empty">No attendance records for {month}.</div> : (
          <div className="op-card op-no-pad">
            <table className="op-table">
              <thead>
                <tr><th>Worker</th><th>Present</th><th>Absent</th><th>Late</th><th>Half Day</th><th>Total Hours</th></tr>
              </thead>
              <tbody>
                {summary.map((s,i) => (
                  <tr key={i}>
                    <td><strong>{s.user?.name}</strong><div className="op-sub">{s.user?.email}</div></td>
                    <td><span className="op-badge" style={STATUS_COLORS.present}>{s.present}</span></td>
                    <td><span className="op-badge" style={STATUS_COLORS.absent}>{s.absent}</span></td>
                    <td><span className="op-badge" style={STATUS_COLORS.late}>{s.late}</span></td>
                    <td><span className="op-badge" style={STATUS_COLORS.half_day}>{s.half_day}</span></td>
                    <td><strong>{s.totalHours}h</strong></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:'var(--surface-hover)', fontWeight:700 }}>
                  <td style={{ padding:'10px 14px' }}>TOTALS</td>
                  <td style={{ padding:'10px 14px' }}>{summary.reduce((n,s)=>n+s.present,0)}</td>
                  <td style={{ padding:'10px 14px' }}>{summary.reduce((n,s)=>n+s.absent,0)}</td>
                  <td style={{ padding:'10px 14px' }}>{summary.reduce((n,s)=>n+s.late,0)}</td>
                  <td style={{ padding:'10px 14px' }}>{summary.reduce((n,s)=>n+s.half_day,0)}</td>
                  <td style={{ padding:'10px 14px' }}>{summary.reduce((n,s)=>n+s.totalHours,0).toFixed(1)}h</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      }
    </div>
  );
}
