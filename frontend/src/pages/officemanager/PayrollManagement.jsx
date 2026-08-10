import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { buildPdf, buildCsvTemplate, parseCsvFile } from '../../utils/pdfUtils';
import './OfficePages.css';

const PAY_STATUS_COLORS = {
  pending:   { bg: '#fef3c7', color: '#92400e' },
  paid:      { bg: '#dcfce7', color: '#15803d' },
  cancelled: { bg: '#fee2e2', color: '#b91c1c' },
};

const currentPeriod = new Date().toISOString().slice(0, 7);

export default function PayrollManagement() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const [records, setRecords]       = useState([]);
  const [farms, setFarms]           = useState([]);
  const [labourUsers, setLabourUsers] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState('');
  const [filterPeriod, setFilterPeriod] = useState(currentPeriod);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [form, setForm]             = useState({
    userId: '', farmId: '', period: currentPeriod,
    baseSalary: '', bonus: '0', deductions: '0', notes: ''
  });
  const [editId, setEditId]         = useState(null);
  const [showForm, setShowForm]     = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get(`${API_URL}/api/farms`, cfg),
      axios.get(`${API_URL}/api/admin/users?role=labor`, cfg),
    ]).then(([f, u]) => {
      setFarms(f.data); setLabourUsers(u.data);
      if (f.data.length > 0) setSelectedFarm(f.data[0]._id);
    });
  }, []);

  const load = async () => {
    if (!selectedFarm) return;
    setLoading(true);
    const q = `?farmId=${selectedFarm}&period=${filterPeriod}`;
    const r = await axios.get(`${API_URL}/api/payroll${q}`, cfg).catch(() => ({ data: [] }));
    setRecords(r.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedFarm, filterPeriod]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setSaving(true);
    try {
      const payload = {
        ...form,
        farmId: selectedFarm,
        baseSalary: Number(form.baseSalary),
        bonus:      Number(form.bonus || 0),
        deductions: Number(form.deductions || 0),
      };
      if (editId) {
        await axios.put(`${API_URL}/api/payroll/${editId}`, payload, cfg);
        setSuccess('Payroll record updated.');
      } else {
        await axios.post(`${API_URL}/api/payroll`, payload, cfg);
        setSuccess(`Payroll record created for period ${form.period}.`);
      }
      setForm({ userId: '', farmId: '', period: currentPeriod, baseSalary: '', bonus: '0', deductions: '0', notes: '' });
      setEditId(null); setShowForm(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const markPaid = async (id) => {
    await axios.put(`${API_URL}/api/payroll/${id}`, { paymentStatus: 'paid' }, cfg);
    await load();
  };

  const handleEdit = (r) => {
    setEditId(r._id);
    setForm({
      userId: r.userId?._id || r.userId || '',
      farmId: r.farmId?._id || r.farmId || '',
      period: r.period,
      baseSalary: String(r.baseSalary),
      bonus: String(r.bonus),
      deductions: String(r.deductions),
      notes: r.notes || '',
    });
    setShowForm(true);
    setError(''); setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Totals — declared before handlers that reference them
  const totalNet     = records.reduce((s, r) => s + (r.netPay || 0), 0);
  const totalPending = records.filter(r => r.paymentStatus === 'pending').reduce((s, r) => s + (r.netPay || 0), 0);
  const totalPaid    = records.filter(r => r.paymentStatus === 'paid').reduce((s, r) => s + (r.netPay || 0), 0);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this payroll record?')) return;
    await axios.delete(`${API_URL}/api/payroll/${id}`, cfg);
    await load();
  };

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const handleExportPdf = () => {
    const farmName = farms.find(f => f._id === selectedFarm)?.name || 'All Farms';
    buildPdf({
      title:    'Payroll Report',
      subtitle: `Farm: ${farmName}  ·  Period: ${filterPeriod}  ·  ${records.length} workers`,
      columns:  ['Worker', 'Email', 'Period', 'Base (ETB)', 'Bonus', 'Deductions', 'Net Pay (ETB)', 'Days', 'Hours', 'Status'],
      rows: records.map(r => [
        r.userId?.name || '—',
        r.userId?.email || '—',
        r.period,
        r.baseSalary?.toLocaleString(),
        r.bonus > 0 ? `+${r.bonus}` : '0',
        r.deductions > 0 ? `-${r.deductions}` : '0',
        r.netPay?.toLocaleString(),
        String(r.daysPresent),
        `${r.hoursWorked}h`,
        r.paymentStatus,
      ]),
      totalsRow: [
        'TOTALS', '', '',
        records.reduce((s, r) => s + (r.baseSalary || 0), 0).toLocaleString(),
        records.reduce((s, r) => s + (r.bonus || 0), 0).toLocaleString(),
        records.reduce((s, r) => s + (r.deductions || 0), 0).toLocaleString(),
        totalNet.toLocaleString(),
        String(records.reduce((s, r) => s + (r.daysPresent || 0), 0)),
        `${records.reduce((s, r) => s + (r.hoursWorked || 0), 0).toFixed(1)}h`,
        `Paid: ${records.filter(r => r.paymentStatus === 'paid').length}`,
      ],
      fileName:    `payroll_${filterPeriod}`,
      orientation: 'l',
    });
  };

  // ── CSV Template ──────────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    buildCsvTemplate({
      columns:    ['workerName', 'period', 'baseSalary', 'bonus', 'deductions', 'notes'],
      sampleRows: [
        ['Abebe Bekele', filterPeriod, '3500', '200', '0', ''],
        ['Sara Haile',   filterPeriod, '3200', '0',   '100', 'Advance deducted'],
      ],
      fileName: 'payroll_import_template',
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
        if (!worker || !selectedFarm || !row.period || !row.baseSalary) { failed++; continue; }

        try {
          await axios.post(`${API_URL}/api/payroll`, {
            userId:     worker._id,
            farmId:     selectedFarm,
            period:     row.period,
            baseSalary: Number(row.baseSalary),
            bonus:      Number(row.bonus || 0),
            deductions: Number(row.deductions || 0),
            notes:      row.notes || '',
          }, cfg);
          created++;
        } catch { failed++; }
      }

      setImportStatus(`✅ Imported ${created} records.${failed > 0 ? ` ${failed} rows skipped (duplicate or invalid).` : ''}`);
      await load();
    } catch (err) {
      setImportStatus(`❌ ${err.message}`);
    } finally { e.target.value = ''; }
  };

  return (
    <div className="op-page">
      <div className="op-header">
        <h2>💰 Payroll Management</h2>
        <p className="op-subtitle">Process and manage labour wages, bonuses, and payment status.</p>
      </div>

      {/* Controls */}
      <div className="op-controls">
        <div className="op-field">
          <label>Farm</label>
          <select value={selectedFarm} onChange={e => setSelectedFarm(e.target.value)} className="op-select">
            {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
          </select>
        </div>
        <div className="op-field">
          <label>Period</label>
          <input type="month" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="op-select" />
        </div>
        <button className="op-btn op-btn-primary" onClick={() => { setShowForm(v => !v); setEditId(null); setError(''); setSuccess(''); }}>
          {showForm ? '✕ Cancel' : '➕ New Payroll Entry'}
        </button>

        {/* PDF / Import toolbar */}
        <div className="op-pdf-toolbar">
          <button className="op-btn op-btn-pdf" onClick={handleExportPdf} disabled={records.length === 0}>
            📄 Export PDF
          </button>
          <button className="op-btn op-btn-csv" onClick={handleDownloadTemplate}>
            ⬇ CSV Template
          </button>
          <label className="op-btn op-btn-import">
            📥 Import CSV
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
          </label>
        </div>
      </div>

      {importStatus && (
        <div className={`op-import-status ${importStatus.startsWith('✅') ? 'op-import-ok' : importStatus.startsWith('❌') ? 'op-import-err' : ''}`}>
          {importStatus}
        </div>
      )}

      {/* KPI Strip */}
      <div className="op-kpi-row">
        {[
          { label: 'Total Payroll',   value: `ETB ${totalNet.toLocaleString()}`,     bg: '#ede9fe', color: '#7c3aed' },
          { label: 'Pending Payment', value: `ETB ${totalPending.toLocaleString()}`, bg: '#fef3c7', color: '#92400e' },
          { label: 'Paid Out',        value: `ETB ${totalPaid.toLocaleString()}`,    bg: '#dcfce7', color: '#15803d' },
          { label: 'Workers',         value: records.length,                          bg: '#dbeafe', color: '#1d4ed8' },
        ].map(k => (
          <div key={k.label} className="op-kpi" style={{ background: k.bg }}>
            <div className="op-kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="op-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="op-card">
          <h3>{editId ? '✏️ Edit Payroll Record' : '➕ New Payroll Record'}</h3>
          {error   && <div className="op-error">{error}</div>}
          {success && <div className="op-success">{success}</div>}
          <form className="op-form" onSubmit={handleSave}>
            <div className="op-form-row">
              <div className="op-field">
                <label>Worker *</label>
                <select value={form.userId} onChange={e => setForm(p => ({ ...p, userId: e.target.value }))} className="op-select">
                  <option value="">Select worker…</option>
                  {labourUsers.map(u => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <div className="op-field">
                <label>Period *</label>
                <input type="month" value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))} className="op-select" />
              </div>
              <div className="op-field">
                <label>Base Salary (ETB) *</label>
                <input type="number" min="0" value={form.baseSalary}
                  onChange={e => setForm(p => ({ ...p, baseSalary: e.target.value }))}
                  placeholder="e.g. 3500" className="op-select" />
              </div>
              <div className="op-field">
                <label>Bonus (ETB)</label>
                <input type="number" min="0" value={form.bonus}
                  onChange={e => setForm(p => ({ ...p, bonus: e.target.value }))}
                  className="op-select" />
              </div>
              <div className="op-field">
                <label>Deductions (ETB)</label>
                <input type="number" min="0" value={form.deductions}
                  onChange={e => setForm(p => ({ ...p, deductions: e.target.value }))}
                  className="op-select" />
              </div>
            </div>
            <div className="op-field">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="op-select op-textarea" placeholder="Optional…" />
            </div>

            {/* Net Pay Preview */}
            {form.baseSalary && (
              <div className="op-net-preview">
                Net Pay: <strong>ETB {Math.max(0, (Number(form.baseSalary) + Number(form.bonus || 0) - Number(form.deductions || 0))).toLocaleString()}</strong>
              </div>
            )}

            <div className="op-form-actions">
              <button type="submit" className="op-btn op-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update Record' : 'Create Record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payroll Table */}
      {loading ? <div className="op-loading">Loading payroll…</div> :
        records.length === 0 ? (
          <div className="op-empty">No payroll records for {filterPeriod}. Add one above.</div>
        ) : (
          <div className="op-card op-no-pad">
            <table className="op-table">
              <thead>
                <tr><th>Worker</th><th>Period</th><th>Base</th><th>Bonus</th><th>Deductions</th><th>Net Pay</th><th>Days</th><th>Hours</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r._id}>
                    <td><strong>{r.userId?.name}</strong><div className="op-sub">{r.userId?.email}</div></td>
                    <td>{r.period}</td>
                    <td>ETB {r.baseSalary?.toLocaleString()}</td>
                    <td>{r.bonus > 0 ? `+ETB ${r.bonus}` : '—'}</td>
                    <td>{r.deductions > 0 ? `-ETB ${r.deductions}` : '—'}</td>
                    <td><strong>ETB {r.netPay?.toLocaleString()}</strong></td>
                    <td>{r.daysPresent}</td>
                    <td>{r.hoursWorked}h</td>
                    <td>
                      <span className="op-badge" style={PAY_STATUS_COLORS[r.paymentStatus]}>
                        {r.paymentStatus}
                      </span>
                    </td>
                    <td>
                      {r.paymentStatus === 'pending' && (
                        <button className="op-btn-sm op-btn-pay" onClick={() => markPaid(r._id)} title="Mark as Paid">
                          💸 Pay
                        </button>
                      )}
                      <button className="op-btn-icon" onClick={() => handleEdit(r)} title="Edit">✏️</button>
                      <button className="op-btn-icon op-btn-danger" onClick={() => handleDelete(r._id)} title="Delete">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="op-tfoot">
                  <td colSpan={5}><strong>Totals</strong></td>
                  <td><strong>ETB {totalNet.toLocaleString()}</strong></td>
                  <td colSpan={4}>{records.reduce((s, r) => s + (r.daysPresent || 0), 0)} days · {records.reduce((s, r) => s + (r.hoursWorked || 0), 0).toFixed(1)}h</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      }
    </div>
  );
}
