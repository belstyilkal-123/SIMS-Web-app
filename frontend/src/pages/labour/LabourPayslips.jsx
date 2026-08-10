import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { buildPdf } from '../../utils/pdfUtils';
import './LabourPages.css';

const STATUS_COLORS = {
  pending:   { bg: '#fef3c7', color: '#92400e' },
  paid:      { bg: '#dcfce7', color: '#15803d' },
  cancelled: { bg: '#fee2e2', color: '#b91c1c' },
};

export default function LabourPayslips() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null); // detail modal

  useEffect(() => {
    axios.get(`${API_URL}/api/payroll`, cfg)
      .then(r => setPayslips(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalEarned = payslips.filter(p => p.paymentStatus === 'paid')
    .reduce((s, p) => s + (p.netPay || 0), 0);
  const totalPending = payslips.filter(p => p.paymentStatus === 'pending')
    .reduce((s, p) => s + (p.netPay || 0), 0);

  const exportPayslip = (p) => {
    buildPdf({
      title:    `Payslip — ${p.period}`,
      subtitle: `Worker: ${user.name}  ·  Farm: ${p.farmId?.name || '—'}`,
      columns:  ['Item', 'Amount (ETB)'],
      rows: [
        ['Base Salary',  p.baseSalary?.toLocaleString()],
        ['Bonus',        p.bonus > 0  ? `+${p.bonus}` : '0'],
        ['Deductions',   p.deductions > 0 ? `-${p.deductions}` : '0'],
        ['Net Pay',      p.netPay?.toLocaleString()],
        ['Days Present', String(p.daysPresent)],
        ['Hours Worked', `${p.hoursWorked}h`],
        ['Status',       p.paymentStatus],
        ['Paid On',      p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—'],
      ],
      fileName:    `payslip_${p.period}_${user.name.replace(/\s+/g,'_')}`,
      orientation: 'p',
    });
  };

  if (loading) return <div className="lp-loading">Loading payslips…</div>;

  return (
    <div className="lp-page">
      <div className="lp-header">
        <h2>💵 My Payslips</h2>
        <p className="lp-subtitle">View and download your monthly payslips.</p>
      </div>

      {/* Summary KPIs */}
      <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
        {[
          { label:'Total Paid',    value:`ETB ${totalEarned.toLocaleString()}`,  bg:'#dcfce7', color:'#15803d' },
          { label:'Pending',       value:`ETB ${totalPending.toLocaleString()}`, bg:'#fef3c7', color:'#92400e' },
          { label:'Total Periods', value: payslips.length,                       bg:'#dbeafe', color:'#1d4ed8' },
        ].map(k => (
          <div key={k.label} style={{ flex:'1 1 120px', background:k.bg, borderRadius:12,
            padding:'16px 18px', textAlign:'center', border:`1px solid ${k.color}22` }}>
            <div style={{ fontSize:'1.5rem', fontWeight:800, color:k.color }}>{k.value}</div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', fontWeight:500 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {payslips.length === 0 ? (
        <div className="lp-empty">No payslips available yet. Contact your office manager.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {payslips.sort((a,b) => b.period.localeCompare(a.period)).map(p => (
            <div key={p._id} style={{
              background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
              padding:'16px 20px', display:'flex', justifyContent:'space-between',
              alignItems:'center', gap:16, flexWrap:'wrap', boxShadow:'var(--shadow-card)'
            }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <strong style={{ fontSize:'1rem', color:'var(--text-main)' }}>{p.period}</strong>
                  <span className="lp-badge" style={STATUS_COLORS[p.paymentStatus]}>{p.paymentStatus}</span>
                </div>
                <div style={{ display:'flex', gap:16, fontSize:'0.8rem', color:'var(--text-muted)', flexWrap:'wrap' }}>
                  <span>🌾 {p.farmId?.name || '—'}</span>
                  <span>📅 {p.daysPresent} days present</span>
                  <span>⏱ {p.hoursWorked}h worked</span>
                  {p.paidAt && <span>✅ Paid {new Date(p.paidAt).toLocaleDateString()}</span>}
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--text-main)' }}>
                  ETB {p.netPay?.toLocaleString()}
                </div>
                <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:8 }}>
                  Base {p.baseSalary?.toLocaleString()}
                  {p.bonus > 0 && ` + ${p.bonus} bonus`}
                  {p.deductions > 0 && ` − ${p.deductions} deducted`}
                </div>
                <button onClick={() => exportPayslip(p)}
                  style={{ padding:'6px 14px', borderRadius:7, background:'#dc2626', color:'white',
                    border:'none', fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>
                  📄 Download PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
