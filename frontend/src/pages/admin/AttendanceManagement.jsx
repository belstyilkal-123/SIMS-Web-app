import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { buildPdf, buildCsvTemplate, parseCsvFile } from '../../utils/pdfUtils';
import './AdminPages.css';

const STATUS_OPTS = ['present', 'absent', 'late', 'half_day'];
const STATUS_COLORS = {
  present:  { bg: '#dcfce7', color: '#15803d' },
  absent:   { bg: '#fee2e2', color: '#b91c1c' },
  late:     { bg: '#fef3c7', color: '#92400e' },
  half_day: { bg: '#dbeafe', color: '#1e40af' },
};

export default function AttendanceManagement() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [farms, setFarms]           = useState([]);
  const [labourUsers, setLabourUsers] = useState([]);
  const [records, setRecords]       = useState([]);
  const [summary, setSummary]       = useState([]);
  const [tab, setTab]               = useState('daily'); // 'daily' | 'monthly'
  const [selectedFarm, setSelectedFarm] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [loading, setLoading]       = useState(false);

  // Manual entry form
  const [manualForm, setManualForm] = useState({ userId: '', checkIn: '', checkOut: '', status: 'present', notes: '' });
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    Promise.all([
      axios.get(`${API_URL}/api/farms`, cfg),
      axios.get(`${API_URL}/api/admin/users?role=labor`, cfg),
    ]).then(([f, u]) => { setFarms(f.data); setLabourUsers(u.data); });
  }, []);

  const loadDaily = async () => {
    if (!selectedFarm || !selectedDate) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API_URL}/api/attendance?farmId=${selectedFarm}&date=${selectedDate}`, cfg);
      setRecords(r.data);
    } finally { setLoading(false); }
  };

  const loadMonthly = async () => {
    if (!selectedFarm || !selectedMonth) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API_URL}/api/attendance/summary?farmId=${selectedFarm}&month=${selectedMonth}`, cfg);
      setSummary(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (tab === 'daily') loadDaily(); else loadMonthly(); }, [selectedFarm, selectedDate, selectedMonth, tab]);

  const handleManualSave = async (e) => {
    e.preventDefault();
    if (!manualForm.userId || !selectedFarm || !selectedDate) { setError('User, Farm and Date are required'); return; }
    setSaving(true); setError('');
    try {
      await axios.post(`${API_URL}/api/attendance`, {
        ...manualForm, farmId: selectedFarm, date: selectedDate,
      }, cfg);
      setManualForm({ userId: '', checkIn: '', checkOut: '', status: 'present', notes: '' });
      await loadDaily();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const updateStatus = async (id, status) => {
    await axios.put(`${API_URL}/api/attendance/${id}`, { status }, cfg);
    await loadDaily();
  };

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const handleExportPdf = () => {
    const farmName = farms.find(f => f._id === selectedFarm)?.name || 'All Farms';

    if (tab === 'daily') {
      buildPdf({
        title:    'Daily Attendance Report',
        subtitle: `Farm: ${farmName}  ·  Date: ${selectedDate}  ·  ${records.length} records`,
        columns:  ['Worker', 'Email', 'Check In', 'Check Out', 'Hours Worked', 'Status'],
        rows: records.map(r => [
          r.userId?.name || '—',
          r.userId?.email || '—',
          r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
          r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
          r.hoursWorked > 0 ? `${r.hoursWorked}h` : '—',
          r.status.replace('_', ' '),
        ]),
        fileName:    `attendance_daily_${selectedDate}`,
        orientation: 'l',
      });
    } else {
      buildPdf({
        title:    'Monthly Attendance Summary',
        subtitle: `Farm: ${farmName}  ·  Month: ${selectedMonth}`,
        columns:  ['Worker', 'Email', 'Present', 'Absent', 'Late', 'Half Day', 'Total Hours'],
        rows: summary.map(s => [
          s.user?.name || '—',
          s.user?.email || '—',
          String(s.present),
          String(s.absent),
          String(s.late),
          String(s.half_day),
          `${s.totalHours}h`,
        ]),
        totalsRow: [
          'TOTALS', '',
          String(summary.reduce((n, s) => n + s.present, 0)),
          String(summary.reduce((n, s) => n + s.absent, 0)),
          String(summary.reduce((n, s) => n + s.late, 0)),
          String(summary.reduce((n, s) => n + s.half_day, 0)),
          `${summary.reduce((n, s) => n + s.totalHours, 0).toFixed(1)}h`,
        ],
        fileName:    `attendance_monthly_${selectedMonth}`,
        orientation: 'l',
      });
    }
  };

  // ── CSV Template ──────────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    buildCsvTemplate({
      columns:    ['workerName', 'date', 'status', 'checkIn', 'checkOut', 'notes'],
      sampleRows: [
        ['Abebe Bekele', selectedDate, 'present', '08:00', '17:00', ''],
        ['Sara Haile',   selectedDate, 'late',    '09:30', '17:00', 'Traffic'],
      ],
      fileName: 'attendance_import_template',
    });
  };

  // ── CSV Import ────────────────────────────────────────────────────────────
  const [importStatus, setImportStatus] = useState('');

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('Parsing…');

    try {
      const rows = await parseCsvFile(file);
      if (!rows.length) { setImportStatus('No data rows found.'); return; }

      let created = 0, failed = 0;
      for (const row of rows) {
        const worker = labourUsers.find(u =>
          u.name.toLowerCase() === (row.workerName || '').toLowerCase()
        );
        if (!worker || !selectedFarm || !row.date) { failed++; continue; }

        const payload = {
          userId: worker._id,
          farmId: selectedFarm,
          date:   row.date,
          status: ['present','absent','late','half_day'].includes(row.status) ? row.status : 'present',
          checkIn:  row.checkIn  ? `${row.date}T${row.checkIn}` : undefined,
          checkOut: row.checkOut ? `${row.date}T${row.checkOut}` : undefined,
          notes: row.notes || '',
        };

        try {
          await axios.post(`${API_URL}/api/attendance`, payload, cfg);
          created++;
        } catch { failed++; }
      }

      setImportStatus(`✅ Imported ${created} records.${failed > 0 ? ` ${failed} rows skipped.` : ''}`);
      if (tab === 'daily') loadDaily(); else loadMonthly();
    } catch (err) {
      setImportStatus(`❌ ${err.message}`);
    } finally { e.target.value = ''; }
  };

  return (
    <div className="ap-page">
      <div className="ap-header">
        <h2>{user.role === 'office_manager' ? '🏢 Manage Attendance' : user.role === 'farmer' ? '🌱 Labour Attendance' : '🗓️ Attendance Management'}</h2>
        <p className="ap-subtitle">{user.role === 'office_manager' ? 'View records, correct attendance, and generate reports.' : user.role === 'farmer' ? 'Record and confirm attendance for assigned labour.' : 'Track daily attendance and view monthly summaries.'}</p>
      </div>

      {/* ── Controls ──────────────────────────────────────────── */}
      <div className="ap-card">
        <div className="ap-form-row">
          <div className="ap-field">
            <label>Farm</label>
            <select value={selectedFarm} onChange={e => setSelectedFarm(e.target.value)} className="ap-input">
              <option value="">Select farm…</option>
              {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
            </select>
          </div>
          <div className="ap-field">
            <label>View</label>
            <div className="ap-tab-group">
              <button className={`ap-tab ${tab === 'daily' ? 'active' : ''}`} onClick={() => setTab('daily')}>Daily</button>
              <button className={`ap-tab ${tab === 'monthly' ? 'active' : ''}`} onClick={() => setTab('monthly')}>Monthly</button>
            </div>
          </div>
          {tab === 'daily' ? (
            <div className="ap-field">
              <label>Date</label>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="ap-input" />
            </div>
          ) : (
            <div className="ap-field">
              <label>Month</label>
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="ap-input" />
            </div>
          )}

          {/* PDF / Import toolbar */}
          <div className="ap-field" style={{ justifyContent: 'flex-end', marginTop: 'auto' }}>
            <div className="ap-pdf-toolbar">
              <button className="ap-btn ap-btn-pdf" onClick={handleExportPdf}>📄 Export PDF</button>
              <button className="ap-btn ap-btn-csv" onClick={handleDownloadTemplate}>⬇ CSV Template</button>
              <label className="ap-btn ap-btn-import">
                📥 Import CSV
                <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
              </label>
            </div>
          </div>
        </div>
        {importStatus && (
          <div className={`ap-import-status ${importStatus.startsWith('✅') ? 'ap-import-ok' : importStatus.startsWith('❌') ? 'ap-import-err' : ''}`}>
            {importStatus}
          </div>
        )}
      </div>

      {/* ── Manual Entry ──────────────────────────────────────── */}
      {tab === 'daily' && selectedFarm && (
        <div className="ap-card">
          <h3>✍️ Manual Entry</h3>
          {error && <div className="ap-error">{error}</div>}
          <form className="ap-form" onSubmit={handleManualSave}>
            <div className="ap-form-row">
              <div className="ap-field">
                <label>Worker</label>
                <select value={manualForm.userId} onChange={e => setManualForm(p => ({ ...p, userId: e.target.value }))} className="ap-input">
                  <option value="">Select worker…</option>
                  {labourUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                </select>
              </div>
              <div className="ap-field">
                <label>Status</label>
                <select value={manualForm.status} onChange={e => setManualForm(p => ({ ...p, status: e.target.value }))} className="ap-input">
                  {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="ap-field">
                <label>Check In</label>
                <input type="time" value={manualForm.checkIn}
                  onChange={e => setManualForm(p => ({ ...p, checkIn: selectedDate + 'T' + e.target.value }))} className="ap-input" />
              </div>
              <div className="ap-field">
                <label>Check Out</label>
                <input type="time" value={manualForm.checkOut?.slice(11, 16) || ''}
                  onChange={e => setManualForm(p => ({ ...p, checkOut: selectedDate + 'T' + e.target.value }))} className="ap-input" />
              </div>
            </div>
            <div className="ap-form-actions">
              <button type="submit" className="ap-btn ap-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save Record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Daily Records ─────────────────────────────────────── */}
      {tab === 'daily' && (
        loading ? <div className="ap-loading">Loading…</div> :
        records.length === 0 ? (
          <div className="ap-empty">No attendance records for {selectedDate}.</div>
        ) : (
          <div className="ap-card ap-no-pad">
            <table className="ap-table">
              <thead><tr><th>Worker</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {records.map(r => (
                  <tr key={r._id}>
                    <td><strong>{r.userId?.name || '—'}</strong><div className="ap-sub">{r.userId?.email}</div></td>
                    <td>{r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td>{r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td>{r.hoursWorked > 0 ? `${r.hoursWorked}h` : '—'}</td>
                    <td>
                      <select value={r.status}
                        onChange={e => updateStatus(r._id, e.target.value)}
                        className="ap-status-select"
                        style={STATUS_COLORS[r.status]}>
                        {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </td>
                    <td><span className="ap-badge" style={STATUS_COLORS[r.status]}>{r.status.replace('_',' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Monthly Summary ───────────────────────────────────── */}
      {tab === 'monthly' && (
        loading ? <div className="ap-loading">Loading…</div> :
        summary.length === 0 ? (
          <div className="ap-empty">No data for {selectedMonth}.</div>
        ) : (
          <div className="ap-card ap-no-pad">
            <table className="ap-table">
              <thead><tr><th>Worker</th><th>Present</th><th>Absent</th><th>Late</th><th>Half Day</th><th>Total Hours</th></tr></thead>
              <tbody>
                {summary.map((s, i) => (
                  <tr key={i}>
                    <td><strong>{s.user?.name}</strong><div className="ap-sub">{s.user?.email}</div></td>
                    <td><span className="ap-badge" style={STATUS_COLORS.present}>{s.present}</span></td>
                    <td><span className="ap-badge" style={STATUS_COLORS.absent}>{s.absent}</span></td>
                    <td><span className="ap-badge" style={STATUS_COLORS.late}>{s.late}</span></td>
                    <td><span className="ap-badge" style={STATUS_COLORS.half_day}>{s.half_day}</span></td>
                    <td><strong>{s.totalHours}h</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
