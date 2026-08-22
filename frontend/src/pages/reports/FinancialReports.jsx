/**
 * Financial Reports Page
 * 
 * Provides financial metrics for Payroll and Operational Expenses.
 * 
 * Role-based access:
 * - Owner: Full access to financial data
 * - Office Manager: Full access to financial data
 * - Farmer: Limited access (own farm only)
 * - Labour: No access
 */

import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { buildPdf } from '../../utils/pdfUtils';
import './FinancialReports.css';

const PIE_COLORS = ['#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

export default function FinancialReports() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const userRole = user?.assignedRole || user?.role;
  const canViewAll = ['owner', 'admin', 'office_manager'].includes(userRole);

  const [data, setData] = useState(null);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterFarm, setFilterFarm] = useState('');

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      const [reportRes, farmRes] = await Promise.all([
        axios.get(`${API_URL}/api/financial-reports/summary${filterFarm ? '?farmId=' + filterFarm : ''}`, cfg),
        axios.get(`${API_URL}/api/farms`, cfg).catch(() => ({ data: [] })),
      ]);
      setData(reportRes.data);
      setFarms(farmRes.data || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load financial reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, [filterFarm]);

  // ── PDF Export ────────────────────────────────────────────────────────────
  const exportPdf = () => {
    if (!data) return;

    const rows = [
      ['Total Payroll Paid', `ETB ${data.summary.totalPayrollPaid?.toLocaleString() || 0}`],
      ['Total Expenses Paid', `ETB ${data.summary.totalExpensesPaid?.toLocaleString() || 0}`],
      ['Total Outflow', `ETB ${data.summary.totalOutflow?.toLocaleString() || 0}`],
      ['Pending Outflow', `ETB ${data.summary.pendingOutflow?.toLocaleString() || 0}`],
    ];

    buildPdf({
      title: 'Financial Report',
      subtitle: `Generated ${new Date().toLocaleDateString()}${filterFarm ? ` · Farm: ${farms.find(f => f._id === filterFarm)?.name || 'All'}` : ''}`,
      columns: ['Metric', 'Value'],
      rows,
      fileName: `financial_report_${new Date().toISOString().slice(0, 10)}`,
      orientation: 'p',
    });
  };

  const expensePieData = useMemo(() => {
    if (!data?.expenseByCategory) return [];
    return data.expenseByCategory.map((e, i) => ({
      name: e._id ? e._id.charAt(0).toUpperCase() + e._id.slice(1) : 'Other',
      value: e.totalAmount,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [data?.expenseByCategory]);

  if (loading) return <div className="fr-loading">Loading financial reports…</div>;
  if (error) return <div className="fr-error">{error}</div>;
  if (!data) return <div className="fr-error">No data available</div>;

  const { summary, payroll, expenses } = data;

  return (
    <div className="fr-page">
      {/* Header */}
      <div className="fr-header">
        <div>
          <h2>📊 Financial Reports</h2>
          <p className="fr-subtitle">
            {canViewAll ? 'Organization-wide payroll and operational expense overview.'
              : 'Expense and payroll summary for your farm.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canViewAll && farms.length > 0 && (
            <select
              className="fr-input fr-select"
              value={filterFarm}
              onChange={e => setFilterFarm(e.target.value)}
            >
              <option value="">All Farms</option>
              {farms.map(f => (
                <option key={f._id} value={f._id}>{f.name}</option>
              ))}
            </select>
          )}
          <button className="fr-btn fr-btn-danger" onClick={exportPdf}>
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="fr-kpi-grid">
        {[
          { icon: '👷', label: 'Payroll Paid', value: `ETB ${summary.totalPayrollPaid?.toLocaleString() || 0}`, color: '#7c3aed', bg: '#ede9fe' },
          { icon: '💸', label: 'Expenses Paid', value: `ETB ${summary.totalExpensesPaid?.toLocaleString() || 0}`, color: '#dc2626', bg: '#fee2e2' },
          { icon: '📊', label: 'Total Outflow', value: `ETB ${summary.totalOutflow?.toLocaleString() || 0}`, color: '#1d4ed8', bg: '#dbeafe' },
          { icon: '⏳', label: 'Pending Outflow', value: `ETB ${summary.pendingOutflow?.toLocaleString() || 0}`, color: '#92400e', bg: '#fef3c7' },
        ].map(k => (
          <div key={k.label} className="fr-kpi" style={{ background: k.bg }}>
            <span className="fr-kpi-icon">{k.icon}</span>
            <div className="fr-kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="fr-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Section Cards */}
      <div className="fr-section-grid">
        {/* Payroll Summary */}
        <div className="fr-card">
          <div className="fr-card-header">
            <h3>👷 Payroll Breakdown</h3>
            <span className="fr-badge">{payroll?.total || 0} records</span>
          </div>
          <div className="fr-stats-grid">
            <div className="fr-stat">
              <span className="fr-stat-label">Pending Approval</span>
              <span className="fr-stat-value" style={{ color: '#1d4ed8' }}>{payroll?.submitted?.count || 0}</span>
              <span className="fr-stat-amount">ETB {payroll?.submitted?.amount?.toLocaleString() || 0}</span>
            </div>
            <div className="fr-stat">
              <span className="fr-stat-label">Paid Out</span>
              <span className="fr-stat-value" style={{ color: '#15803d' }}>{payroll?.paid?.count || 0}</span>
              <span className="fr-stat-amount">ETB {payroll?.paid?.amount?.toLocaleString() || 0}</span>
            </div>
            <div className="fr-stat">
              <span className="fr-stat-label">Draft / Pending</span>
              <span className="fr-stat-value" style={{ color: '#92400e' }}>{payroll?.pending?.count || 0}</span>
              <span className="fr-stat-amount">ETB {payroll?.pending?.amount?.toLocaleString() || 0}</span>
            </div>
          </div>
        </div>

        {/* Expenses Summary */}
        <div className="fr-card">
          <div className="fr-card-header">
            <h3>💵 Expenses Breakdown</h3>
            <span className="fr-badge">{expenses?.total || 0} requests</span>
          </div>
          <div className="fr-stats-grid">
            <div className="fr-stat">
              <span className="fr-stat-label">Pending Approval</span>
              <span className="fr-stat-value" style={{ color: '#92400e' }}>{expenses?.pending?.count || 0}</span>
              <span className="fr-stat-amount">ETB {expenses?.pending?.amount?.toLocaleString() || 0}</span>
            </div>
            <div className="fr-stat">
              <span className="fr-stat-label">Approved</span>
              <span className="fr-stat-value" style={{ color: '#1d4ed8' }}>{expenses?.approved?.count || 0}</span>
              <span className="fr-stat-amount">ETB {expenses?.approved?.amount?.toLocaleString() || 0}</span>
            </div>
            <div className="fr-stat">
              <span className="fr-stat-label">Processed</span>
              <span className="fr-stat-value" style={{ color: '#15803d' }}>{expenses?.processed?.count || 0}</span>
              <span className="fr-stat-amount">ETB {expenses?.processed?.amount?.toLocaleString() || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expense by Category Pie Chart */}
      {expensePieData.length > 0 && (
        <div className="fr-card" style={{ marginTop: 20 }}>
          <h3>🏷️ Expense Breakdown by Category</h3>
          <div style={{ width: '100%', height: 300, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expensePieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {expensePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `ETB ${value.toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
