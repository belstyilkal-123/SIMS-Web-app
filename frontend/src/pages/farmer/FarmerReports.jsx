import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { buildPdf } from '../../utils/pdfUtils';
import './FarmerPages.css';

export default function FarmerReports() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const [farms, setFarms]           = useState([]);
  const [selectedFarm, setSelectedFarm] = useState('');
  const [trends, setTrends]         = useState([]);
  const [summary, setSummary]       = useState(null);
  const [activities, setActivities] = useState([]);
  const [days, setDays]             = useState(7);
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
    Promise.all([
      axios.get(`${API_URL}/api/dashboard/trends?farmId=${selectedFarm}&days=${days}`, cfg),
      axios.get(`${API_URL}/api/dashboard/summary?farmId=${selectedFarm}`, cfg),
      axios.get(`${API_URL}/api/activities?farmId=${selectedFarm}`, cfg),
    ]).then(([t, s, a]) => {
      setTrends(t.data);
      setSummary(s.data);
      setActivities(a.data);
    }).finally(() => setLoading(false));
  }, [selectedFarm, days]);

  const completedActivities = activities.filter(a => a.status === 'completed').length;
  const pendingActivities   = activities.filter(a => a.status === 'pending' || a.status === 'in_progress').length;
  const farmName            = farms.find(f => f._id === selectedFarm)?.name || '—';

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const handleExportPdf = () => {
    const doc1Pages = [];

    // Section 1 — KPI Summary
    const kpiRows = summary ? [
      ['Today\'s Water Use', summary.todayWaterUsage != null ? `${summary.todayWaterUsage} L` : '—'],
      ['Temperature',        summary.temperature    != null ? `${summary.temperature}°C`    : '—'],
      ['Soil Moisture',      summary.soilMoisture   != null ? `${summary.soilMoisture}%`    : '—'],
      ['Tank Level',         summary.tankLevel      != null ? `${summary.tankLevel}%`       : '—'],
      ['Pump Status',        summary.pumpStatus     || '—'],
      ['Active Tasks',       String(pendingActivities)],
      ['Completed Tasks',    String(completedActivities)],
    ] : [];

    // Section 2 — Sensor Trends (if available)
    const trendRows = trends.map(t => [
      t.date,
      t.moisture    != null ? `${t.moisture}%`    : '—',
      t.temperature != null ? `${t.temperature}°C` : '—',
      t.humidity    != null ? `${t.humidity}%`    : '—',
    ]);

    // Section 3 — Activity list
    const actRows = activities.map(a => [
      a.title,
      a.assignedTo?.map(u => u.name || u).join(', ') || 'Unassigned',
      a.priority,
      a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—',
      a.status.replace('_', ' '),
    ]);

    // Build a multi-section PDF by concatenating into one call with spacer rows
    buildPdf({
      title:    `Farm Report — ${farmName}`,
      subtitle: `Period: last ${days} days  ·  Generated ${new Date().toLocaleDateString()}`,
      columns:  ['Metric', 'Value'],
      rows:     kpiRows.length > 0 ? kpiRows : [['No summary data available', '']],
      fileName: `farm_report_${selectedFarm}_${days}d`,
      orientation: 'p',
    });

    // Export trend data as a second PDF if available
    if (trendRows.length > 0) {
      buildPdf({
        title:    `Sensor Trends — ${farmName}`,
        subtitle: `Last ${days} days  ·  ${trendRows.length} data points`,
        columns:  ['Date', 'Moisture %', 'Temperature °C', 'Humidity %'],
        rows:     trendRows,
        fileName: `sensor_trends_${selectedFarm}_${days}d`,
        orientation: 'p',
      });
    }

    // Export activities as a third PDF if available
    if (actRows.length > 0) {
      buildPdf({
        title:    `Activity Report — ${farmName}`,
        subtitle: `Total: ${activities.length}  ·  Completed: ${completedActivities}  ·  Active: ${pendingActivities}`,
        columns:  ['Task', 'Assigned To', 'Priority', 'Due Date', 'Status'],
        rows:     actRows,
        fileName: `activities_${selectedFarm}`,
        orientation: 'l',
      });
    }
  };

  return (
    <div className="fp-page">
      <div className="fp-header">
        <h2>📑 Farm Reports</h2>
        <p className="fp-subtitle">Sensor trends, irrigation usage, and activity summaries for your farm.</p>
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
          <label>Period</label>
          <div className="fp-tab-group">
            {[7, 14, 30].map(d => (
              <button key={d} className={`fp-tab ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>{d} days</button>
            ))}
          </div>
        </div>

        {/* PDF export */}
        <div className="fp-field" style={{ justifyContent: 'flex-end', marginTop: 'auto' }}>
          <button
            className="fp-btn-pdf"
            onClick={handleExportPdf}
            disabled={loading || !selectedFarm}
            title="Export farm report, sensor trends and activities as PDF"
          >
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* KPI Row */}
      {summary && (
        <div className="fp-kpi-row">
          {[
            { icon: '💧', label: 'Today\'s Water Use', value: summary.todayWaterUsage != null ? `${summary.todayWaterUsage} L` : '--', bg: '#dbeafe', color: '#1d4ed8' },
            { icon: '🌡️', label: 'Temperature', value: summary.temperature != null ? `${summary.temperature}°C` : '--', bg: '#fef3c7', color: '#92400e' },
            { icon: '💦', label: 'Soil Moisture', value: summary.soilMoisture != null ? `${summary.soilMoisture}%` : '--', bg: '#dcfce7', color: '#15803d' },
            { icon: '🏺', label: 'Tank Level',   value: summary.tankLevel   != null ? `${summary.tankLevel}%`   : '--', bg: '#ede9fe', color: '#7c3aed' },
            { icon: '📋', label: 'Active Tasks',  value: pendingActivities, bg: '#fef3c7', color: '#92400e' },
            { icon: '✅', label: 'Completed Tasks', value: completedActivities, bg: '#dcfce7', color: '#15803d' },
          ].map(k => (
            <div key={k.label} className="fp-kpi" style={{ background: k.bg }}>
              <span className="fp-kpi-icon">{k.icon}</span>
              <div className="fp-kpi-value" style={{ color: k.color }}>{k.value}</div>
              <div className="fp-kpi-label">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? <div className="fp-loading">Loading chart data…</div> : (
        <>
          {/* Sensor Trends Chart */}
          {trends.length > 0 ? (
            <div className="fp-card">
              <h3>📈 Sensor Trends ({days} days)</h3>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="moisture"    stroke="#16a34a" strokeWidth={2} name="Moisture %" dot={false} />
                    <Line type="monotone" dataKey="temperature" stroke="#f59e0b" strokeWidth={2} name="Temp °C" dot={false} />
                    <Line type="monotone" dataKey="humidity"    stroke="#2563eb" strokeWidth={2} name="Humidity %" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="fp-card fp-empty-card">
              <p>No sensor trend data yet for this period.</p>
            </div>
          )}

          {/* Activity Summary Chart */}
          {activities.length > 0 && (
            <div className="fp-card">
              <h3>📊 Activity Status Breakdown</h3>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Pending',     count: activities.filter(a => a.status === 'pending').length,     fill: '#f59e0b' },
                    { name: 'In Progress', count: activities.filter(a => a.status === 'in_progress').length, fill: '#2563eb' },
                    { name: 'Completed',   count: activities.filter(a => a.status === 'completed').length,   fill: '#16a34a' },
                    { name: 'Cancelled',   count: activities.filter(a => a.status === 'cancelled').length,   fill: '#ef4444' },
                  ].filter(d => d.count > 0)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6,6,0,0]}>
                      {[].map(() => null) /* Cell colors set via fill in data */}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
