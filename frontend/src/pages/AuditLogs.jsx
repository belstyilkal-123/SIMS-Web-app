import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { buildPdf } from '../utils/pdfUtils';
import './AuditLogs.css';

const ACTION_META = {
  CREATE:               { bg: '#dcfce7', color: '#15803d', label: 'CREATE' },
  UPDATE:               { bg: '#dbeafe', color: '#1d4ed8', label: 'UPDATE' },
  DELETE:               { bg: '#fee2e2', color: '#b91c1c', label: 'DELETE' },
  READ:                 { bg: '#f1f5f9', color: '#475569', label: 'READ'   },
  MANUAL_PUMP_OVERRIDE: { bg: '#fef3c7', color: '#92400e', label: 'PUMP'  },
  LOGIN:                { bg: '#ede9fe', color: '#7c3aed', label: 'LOGIN'  },
  LOGOUT:               { bg: '#f1f5f9', color: '#475569', label: 'LOGOUT' },
};

const PAGE_SIZE = 25;

export default function AuditLogs() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user?.token}` } };

  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [page, setPage]       = useState(1);

  useEffect(() => {
    if (!user) return;
    axios.get(`${API_URL}/api/audit-logs`, cfg)
      .then(r => setLogs(r.data))
      .catch(err => console.error('Audit log fetch error:', err))
      .finally(() => setLoading(false));
  }, [user]);

  // Derived filter options
  const actions   = useMemo(() => [...new Set(logs.map(l => l.action).filter(Boolean))].sort(), [logs]);
  const resources = useMemo(() => [...new Set(logs.map(l => l.resource).filter(Boolean))].sort(), [logs]);

  // Filter + search
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter(l => {
      if (filterAction   && l.action   !== filterAction)   return false;
      if (filterResource && l.resource !== filterResource) return false;
      if (q) {
        const hay = [
          l.action, l.resource, l.details,
          l.userId?.name, l.userId?.email, l.ipAddress,
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, search, filterAction, filterResource]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageSlice = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleExportPdf = () => {
    buildPdf({
      title:    'System Audit Log',
      subtitle: `Exported ${new Date().toLocaleString()}  ·  ${filtered.length} records`,
      columns:  ['Timestamp', 'User', 'Action', 'Resource', 'Details', 'IP Address'],
      rows: filtered.map(l => [
        new Date(l.createdAt).toLocaleString(),
        l.userId?.name  || 'System',
        l.action        || '—',
        l.resource      || '—',
        (l.details || '').slice(0, 80),
        l.ipAddress     || 'N/A',
      ]),
      fileName:    `audit_log_${new Date().toISOString().slice(0, 10)}`,
      orientation: 'l',
    });
  };

  return (
    <div className="al-page">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="al-header">
        <div>
          <h2>📝 System Audit Logs</h2>
          <p className="al-subtitle">Full record of all user and system actions.</p>
        </div>
        <button className="al-btn-pdf" onClick={handleExportPdf} disabled={filtered.length === 0}>
          📄 Export PDF
        </button>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="al-filters">
        <input
          className="al-input al-search"
          placeholder="Search user, action, resource, details…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="al-input al-select"
          value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }}>
          <option value="">All Actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="al-input al-select"
          value={filterResource} onChange={e => { setFilterResource(e.target.value); setPage(1); }}>
          <option value="">All Resources</option>
          {resources.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="al-count">{filtered.length} records</span>
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="al-loading">Loading audit logs…</div>
      ) : filtered.length === 0 ? (
        <div className="al-empty">No audit logs match your filters.</div>
      ) : (
        <div className="al-card al-no-pad">
          <table className="al-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Details</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {pageSlice.map(log => {
                const meta = ACTION_META[log.action] || { bg: '#f1f5f9', color: '#475569', label: log.action };
                return (
                  <tr key={log._id}>
                    <td className="al-ts">
                      <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                      <span className="al-ts-time">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td>
                      <strong>{log.userId?.name || 'System'}</strong>
                      {log.userId?.email && <div className="al-sub">{log.userId.email}</div>}
                    </td>
                    <td>
                      <span className="al-badge" style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td>{log.resource || '—'}</td>
                    <td className="al-details">{log.details || '—'}</td>
                    <td className="al-ip">{log.ipAddress || 'N/A'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="al-pagination">
          <button className="al-page-btn" onClick={() => setPage(1)} disabled={currentPage === 1}>«</button>
          <button className="al-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
          <span className="al-page-info">Page {currentPage} of {totalPages}</span>
          <button className="al-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
          <button className="al-page-btn" onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}>»</button>
        </div>
      )}
    </div>
  );
}
