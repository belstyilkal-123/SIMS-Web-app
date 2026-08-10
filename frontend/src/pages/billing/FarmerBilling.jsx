import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { buildPdf } from '../../utils/pdfUtils';
import './Billing.css';

const STATUS_COLORS = {
  pending:        { bg:'#fef3c7', color:'#92400e' },
  partially_paid: { bg:'#dbeafe', color:'#1e40af' },
  paid:           { bg:'#dcfce7', color:'#15803d' },
  overdue:        { bg:'#fee2e2', color:'#b91c1c' },
  cancelled:      { bg:'#f1f5f9', color:'#475569' },
};

export default function FarmerBilling() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const [invoices, setInvoices] = useState([]);
  const [stats,    setStats]    = useState({});
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all'); // 'all' | 'pending' | 'paid' | 'overdue'
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [receipt,  setReceipt]  = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const fileRef = useRef(null);

  const load = async () => {
    try {
      const [inv, s] = await Promise.all([
        axios.get(`${API_URL}/api/billing`, cfg),
        axios.get(`${API_URL}/api/billing/stats/summary`, cfg),
      ]);
      setInvoices(inv.data);
      setStats(s.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = invoices.filter(inv => {
    if (filter === 'all') return true;
    return inv.paymentStatus === filter ||
      (filter === 'pending' && inv.paymentStatus === 'overdue');
  });

  /* Handle receipt image → base64 */
  const handleReceiptFile = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setReceipt(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handlePay = async () => {
    if (!payAmount || Number(payAmount) <= 0) { setError('Enter a valid amount.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await axios.put(`${API_URL}/api/billing/${payModal._id}`, {
        paidAmount:   Number(payAmount),
        receiptImage: receipt || undefined,
        receiptNote:  receiptNote || undefined,
      }, cfg);
      setSuccess('Payment recorded. The office manager will verify your receipt.');
      setPayModal(null); setPayAmount(''); setReceipt(''); setReceiptNote('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Payment failed');
    } finally { setSaving(false); }
  };

  const downloadPdf = inv => {
    buildPdf({
      title:    `Invoice ${inv.invoiceNumber}`,
      subtitle: `Farm: ${inv.farmId?.name}  ·  Period: ${inv.periodStart?.slice(0,10)} → ${inv.periodEnd?.slice(0,10)}`,
      columns:  ['Item', 'Amount (ETB)'],
      rows: [
        ['Water Used',      `${inv.waterUsedLitres?.toLocaleString()} L × ETB ${inv.ratePerLitre} = ETB ${inv.waterCharge?.toLocaleString()}`],
        ['Maintenance Fee', `ETB ${inv.maintenanceFee}`],
        ['Service Charge',  `ETB ${inv.serviceCharge}`],
        ['Tax',             `ETB ${inv.tax}`],
        ['Discount',        `- ETB ${inv.discount}`],
        ['TOTAL',           `ETB ${inv.totalAmount?.toLocaleString()}`],
        ['Paid',            `ETB ${inv.paidAmount?.toLocaleString()}`],
        ['Balance Due',     `ETB ${Math.max(0, inv.totalAmount - inv.paidAmount).toLocaleString()}`],
        ['Status',          inv.paymentStatus.replace('_',' ')],
        ['Due Date',        inv.dueDate ? inv.dueDate.slice(0,10) : '—'],
      ],
      fileName:    `invoice_${inv.invoiceNumber}`,
      orientation: 'p',
    });
  };

  const totalBalance = invoices
    .filter(i => !['paid','cancelled'].includes(i.paymentStatus))
    .reduce((s, i) => s + Math.max(0, i.totalAmount - i.paidAmount), 0);

  if (loading) return <div className="bl-loading">Loading your invoices…</div>;

  return (
    <div className="bl-page">
      <div className="bl-header">
        <div>
          <h2>🧾 My Bills & Payments</h2>
          <p className="bl-subtitle">View water usage invoices and pay your bills.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="bl-kpi-row">
        {[
          { label:'Balance Due',   value:`ETB ${totalBalance.toLocaleString()}`,                 bg:'#fef3c7', color:'#92400e' },
          { label:'Total Paid',    value:`ETB ${(stats.totalRevenue||0).toLocaleString()}`,      bg:'#dcfce7', color:'#15803d' },
          { label:'Overdue',       value: invoices.filter(i=>i.paymentStatus==='overdue').length,bg:'#fee2e2', color:'#b91c1c' },
          { label:'Total Invoices',value: invoices.length,                                        bg:'#dbeafe', color:'#1d4ed8' },
        ].map(k => (
          <div key={k.label} className="bl-kpi" style={{ background:k.bg }}>
            <div className="bl-kpi-value" style={{ color:k.color }}>{k.value}</div>
            <div className="bl-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', width:'fit-content' }}>
        {[
          { key:'all',     label:'All' },
          { key:'pending', label:'Unpaid' },
          { key:'paid',    label:'Paid' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ padding:'8px 18px', border:'none', fontWeight:600, fontSize:'0.84rem', cursor:'pointer',
              background: filter === f.key ? '#16a34a' : 'transparent',
              color: filter === f.key ? 'white' : 'var(--text-muted)',
              borderRight: f.key !== 'paid' ? '1px solid var(--border)' : 'none' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      {filtered.length === 0 ? (
        <div className="bl-empty">No invoices {filter !== 'all' ? `with status "${filter}"` : ''}.</div>
      ) : (
        <div className="bl-invoice-list">
          {filtered.map(inv => {
            const balance = Math.max(0, inv.totalAmount - inv.paidAmount);
            const isUnpaid = !['paid','cancelled'].includes(inv.paymentStatus);
            return (
              <div key={inv._id} className="bl-invoice-item">
                <div className="bl-invoice-item-left">
                  <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <strong style={{ fontSize:'1rem' }}>{inv.invoiceNumber}</strong>
                    <span className="bl-badge" style={STATUS_COLORS[inv.paymentStatus]}>
                      {inv.paymentStatus.replace('_',' ')}
                    </span>
                    {inv.paymentStatus === 'overdue' && (
                      <span style={{ fontSize:'0.75rem', color:'#b91c1c', fontWeight:600 }}>⚠️ OVERDUE</span>
                    )}
                  </div>
                  <div className="bl-invoice-meta">
                    <span>🌾 {inv.farmId?.name || '—'}</span>
                    <span>📅 {inv.periodStart?.slice(0,10)} → {inv.periodEnd?.slice(0,10)}</span>
                    <span>💧 {inv.waterUsedLitres?.toLocaleString()} L</span>
                    {inv.dueDate && <span style={{ color: inv.paymentStatus==='overdue'?'#b91c1c':'inherit' }}>
                      Due: {inv.dueDate.slice(0,10)}
                    </span>}
                  </div>
                  {inv.notes && <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', margin:'6px 0 0' }}>{inv.notes}</p>}
                  {inv.receiptImage && (
                    <div style={{ marginTop:8, background:'#f0fdf4', borderRadius:7, padding:'6px 10px',
                      fontSize:'0.78rem', color:'#15803d' }}>
                      📎 Receipt uploaded{inv.receiptNote ? `: ${inv.receiptNote}` : ''}
                    </div>
                  )}
                </div>

                <div className="bl-invoice-item-right">
                  <div style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--text-main)' }}>
                    ETB {inv.totalAmount?.toLocaleString()}
                  </div>
                  {inv.paidAmount > 0 && (
                    <div style={{ fontSize:'0.8rem', color:'#15803d', marginTop:2 }}>
                      Paid: ETB {inv.paidAmount?.toLocaleString()}
                    </div>
                  )}
                  {balance > 0 && (
                    <div style={{ fontSize:'0.82rem', color:'#92400e', fontWeight:600, marginTop:2 }}>
                      Balance: ETB {balance.toLocaleString()}
                    </div>
                  )}

                  <div className="bl-invoice-actions" style={{ justifyContent:'flex-end' }}>
                    <button className="bl-btn" style={{ padding:'7px 14px', fontSize:'0.8rem', background:'#dc2626', color:'white' }}
                      onClick={() => downloadPdf(inv)}>
                      📄 Download
                    </button>
                    {isUnpaid && (
                      <button className="bl-btn bl-btn-pay"
                        style={{ padding:'7px 14px', fontSize:'0.8rem' }}
                        onClick={() => { setPayModal(inv); setPayAmount(String(balance)); setError(''); }}>
                        💳 Pay Now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment modal */}
      {payModal && (
        <div className="bl-modal-overlay" onClick={() => setPayModal(null)}>
          <div className="bl-modal" onClick={e => e.stopPropagation()}>
            <h3>💳 Pay Invoice {payModal.invoiceNumber}</h3>
            <p style={{ fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:16 }}>
              Total: <strong>ETB {payModal.totalAmount?.toLocaleString()}</strong>
              {payModal.paidAmount > 0 && ` · Already paid: ETB ${payModal.paidAmount?.toLocaleString()}`}
            </p>
            {error   && <div className="bl-error"   style={{ marginBottom:10 }}>{error}</div>}
            {success && <div className="bl-success" style={{ marginBottom:10 }}>{success}</div>}

            <div className="bl-field" style={{ marginBottom:12 }}>
              <label>Amount to Pay (ETB)</label>
              <input type="number" min="0" value={payAmount}
                onChange={e => setPayAmount(e.target.value)} className="bl-input" />
            </div>
            <div className="bl-field" style={{ marginBottom:12 }}>
              <label>Payment Note / Reference</label>
              <input value={receiptNote} onChange={e => setReceiptNote(e.target.value)}
                placeholder="e.g. Bank transfer ref #12345" className="bl-input" />
            </div>
            <div className="bl-field" style={{ marginBottom:16 }}>
              <label>Upload Receipt (optional)</label>
              <input type="file" accept="image/*,.pdf" ref={fileRef}
                onChange={handleReceiptFile}
                style={{ fontSize:'0.84rem', color:'var(--text-main)' }} />
              {receipt && (
                <div style={{ marginTop:6, fontSize:'0.78rem', color:'#15803d' }}>
                  ✅ Receipt attached
                </div>
              )}
            </div>

            <div className="bl-form-actions">
              <button className="bl-btn bl-btn-primary" disabled={saving} onClick={handlePay}>
                {saving ? 'Submitting…' : '💳 Submit Payment'}
              </button>
              <button className="bl-btn bl-btn-ghost" onClick={() => { setPayModal(null); setError(''); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
