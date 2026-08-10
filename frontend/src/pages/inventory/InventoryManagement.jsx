import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { buildPdf } from '../../utils/pdfUtils';
import './Inventory.css';

const CATEGORIES = ['pump','pipe','sensor','valve','filter','electrical',
  'chemical','fertilizer','spare_part','tool','other'];

const CAT_ICONS = {
  pump:'💧', pipe:'🔩', sensor:'📡', valve:'🔧', filter:'🪣',
  electrical:'⚡', chemical:'🧪', fertilizer:'🌿', spare_part:'🔄', tool:'🛠️', other:'📦',
};

const UNITS = ['unit','kg','litre','metre','bag','box','roll','set','pair'];

const emptyForm = {
  name:'', sku:'', category:'other', unit:'unit',
  quantity:'0', reorderLevel:'5', unitCost:'0',
  supplier:'', location:'', description:'', farmId:'',
};

const emptyAdjust = { type:'restock', quantity:'', unitCost:'', reference:'', notes:'' };

export default function InventoryManagement() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const [items,    setItems]    = useState([]);
  const [summary,  setSummary]  = useState({ byCategory:[], lowStock:0, totalValue:0 });
  const [farms,    setFarms]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState(emptyForm);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  // Filters
  const [search,       setSearch]       = useState('');
  const [filterCat,    setFilterCat]    = useState('');
  const [filterFarm,   setFilterFarm]   = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  // Stock adjustment modal
  const [adjustItem,   setAdjustItem]   = useState(null);
  const [adjustForm,   setAdjustForm]   = useState(emptyAdjust);
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustError,  setAdjustError]  = useState('');
  // Transaction history modal
  const [txItem,  setTxItem]  = useState(null);
  const [txList,  setTxList]  = useState([]);
  const [txLoad,  setTxLoad]  = useState(false);

  const load = async () => {
    try {
      const [it, sm, f] = await Promise.all([
        axios.get(`${API_URL}/api/inventory`, cfg),
        axios.get(`${API_URL}/api/inventory/summary`, cfg),
        axios.get(`${API_URL}/api/farms`, cfg),
      ]);
      setItems(it.data);
      setSummary(sm.data);
      setFarms(f.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  /* ── CRUD ────────────────────────────────────────────────────── */
  const handleSave = async e => {
    e.preventDefault();
    if (!form.name) { setError('Item name is required.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = {
        ...form,
        quantity:     Number(form.quantity     || 0),
        reorderLevel: Number(form.reorderLevel || 5),
        unitCost:     Number(form.unitCost     || 0),
        farmId: form.farmId || undefined,
      };
      editId
        ? await axios.put(`${API_URL}/api/inventory/${editId}`, payload, cfg)
        : await axios.post(`${API_URL}/api/inventory`, payload, cfg);
      setSuccess(editId ? 'Item updated.' : 'Item added to inventory.');
      setForm(emptyForm); setEditId(null); setShowForm(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleEdit = item => {
    setEditId(item._id);
    setForm({
      name:         item.name,
      sku:          item.sku        || '',
      category:     item.category,
      unit:         item.unit,
      quantity:     String(item.quantity),
      reorderLevel: String(item.reorderLevel),
      unitCost:     String(item.unitCost),
      supplier:     item.supplier   || '',
      location:     item.location   || '',
      description:  item.description|| '',
      farmId:       item.farmId?._id || '',
    });
    setShowForm(true); setError(''); setSuccess('');
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  const handleDeactivate = async id => {
    if (!window.confirm('Deactivate this item?')) return;
    await axios.delete(`${API_URL}/api/inventory/${id}`, cfg);
    await load();
  };

  /* ── Stock adjustment ────────────────────────────────────────── */
  const handleAdjust = async e => {
    e.preventDefault();
    if (!adjustForm.quantity || Number(adjustForm.quantity) <= 0) {
      setAdjustError('Enter a quantity > 0.'); return;
    }
    setAdjustSaving(true); setAdjustError('');
    try {
      await axios.post(`${API_URL}/api/inventory/${adjustItem._id}/adjust`, {
        type:      adjustForm.type,
        quantity:  Number(adjustForm.quantity),
        unitCost:  adjustForm.unitCost ? Number(adjustForm.unitCost) : undefined,
        reference: adjustForm.reference,
        notes:     adjustForm.notes,
      }, cfg);
      setAdjustItem(null); setAdjustForm(emptyAdjust);
      await load();
    } catch (err) {
      setAdjustError(err.response?.data?.error || 'Adjustment failed');
    } finally { setAdjustSaving(false); }
  };

  /* ── Transaction history ─────────────────────────────────────── */
  const openHistory = async item => {
    setTxItem(item); setTxList([]); setTxLoad(true);
    try {
      const r = await axios.get(`${API_URL}/api/inventory/${item._id}/transactions`, cfg);
      setTxList(r.data);
    } catch (e) { console.error(e); }
    finally { setTxLoad(false); }
  };

  /* ── PDF export ──────────────────────────────────────────────── */
  const handleExport = () => {
    buildPdf({
      title:    'Inventory Report',
      subtitle: `Total Items: ${filtered.length}  ·  Low Stock Alerts: ${summary.lowStock}  ·  Total Value: ETB ${summary.totalValue?.toLocaleString()}`,
      columns:  ['Name','SKU','Category','Farm','Qty','Unit','Reorder At','Unit Cost','Total Value','Location'],
      rows: filtered.map(it => [
        it.name,
        it.sku       || '—',
        it.category,
        it.farmId?.name || 'Central',
        String(it.quantity),
        it.unit,
        String(it.reorderLevel),
        `ETB ${it.unitCost}`,
        `ETB ${it.totalValue?.toLocaleString()}`,
        it.location  || '—',
      ]),
      totalsRow: [
        'TOTALS','','','','','','','',
        `ETB ${filtered.reduce((s,i)=>s+(i.totalValue||0),0).toLocaleString()}`,
        '',
      ],
      fileName:    `inventory_${new Date().toISOString().slice(0,10)}`,
      orientation: 'l',
    });
  };

  /* ── Filtered items ──────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(it => {
      if (filterCat  && it.category !== filterCat) return false;
      if (filterFarm && (it.farmId?._id||it.farmId||'') !== filterFarm) return false;
      if (onlyLowStock && it.quantity > it.reorderLevel) return false;
      if (q) {
        const hay = [it.name, it.sku, it.category, it.supplier, it.location].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, filterCat, filterFarm, onlyLowStock, search]);

  const qtyClass = item =>
    item.quantity === 0 ? 'inv-qty-out' :
    item.quantity <= item.reorderLevel ? 'inv-qty-low' : 'inv-qty-ok';

  if (loading) return <div className="inv-loading">Loading inventory…</div>;

  return (
    <div className="inv-page">

      {/* Header */}
      <div className="inv-header">
        <div>
          <h2>📦 Inventory Management</h2>
          <p className="inv-subtitle">Track stock levels, restock, and manage spare parts.</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="inv-btn inv-btn-primary"
            onClick={() => { setShowForm(v=>!v); setEditId(null); setForm(emptyForm); setError(''); setSuccess(''); }}>
            {showForm ? '✕ Cancel' : '➕ Add Item'}
          </button>
          <button className="inv-btn" style={{ background:'#dc2626', color:'white' }}
            onClick={handleExport} disabled={filtered.length===0}>
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* Low stock banner */}
      {summary.lowStock > 0 && (
        <div className="inv-alert-banner">
          <span style={{ fontSize:'1.3rem' }}>⚠️</span>
          <span><strong>{summary.lowStock} item{summary.lowStock>1?'s':''}</strong> at or below reorder level. Review and restock soon.</span>
          <button style={{ marginLeft:'auto', background:'#fed7aa', border:'none', borderRadius:6,
            padding:'4px 12px', fontSize:'0.8rem', fontWeight:700, cursor:'pointer', color:'#92400e' }}
            onClick={() => setOnlyLowStock(v=>!v)}>
            {onlyLowStock ? 'Show All' : 'Show Low Stock Only'}
          </button>
        </div>
      )}

      {/* KPI strip */}
      <div className="inv-kpi-row">
        {[
          { label:'Total Items',   value: items.length,                               bg:'#dbeafe', color:'#1d4ed8' },
          { label:'Low Stock',     value: summary.lowStock || 0,                      bg:'#fef3c7', color:'#92400e' },
          { label:'Total Value',   value:`ETB ${(summary.totalValue||0).toLocaleString()}`, bg:'#dcfce7', color:'#15803d' },
          { label:'Categories',    value: summary.byCategory?.length || 0,            bg:'#ede9fe', color:'#7c3aed' },
        ].map(k => (
          <div key={k.label} className="inv-kpi" style={{ background:k.bg }}>
            <div className="inv-kpi-value" style={{ color:k.color }}>{k.value}</div>
            <div className="inv-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Category summary cards */}
      {summary.byCategory?.length > 0 && (
        <div className="inv-cat-row">
          {summary.byCategory.map(cat => (
            <div key={cat._id}
              className={`inv-cat-card ${filterCat === cat._id ? 'active' : ''}`}
              onClick={() => setFilterCat(filterCat === cat._id ? '' : cat._id)}>
              <div style={{ fontSize:'1.3rem', marginBottom:2 }}>{CAT_ICONS[cat._id] || '📦'}</div>
              <div className="inv-cat-name">{cat._id.replace('_',' ')}</div>
              <div className="inv-cat-count">{cat.totalItems} items · {cat.totalQty} {cat.totalItems===1?'unit':'units'}</div>
              <div className="inv-cat-value">ETB {cat.totalValue?.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="inv-card">
          <h3>{editId ? '✏️ Edit Item' : '➕ Add Inventory Item'}</h3>
          {error   && <div className="inv-error"   style={{ marginBottom:12 }}>{error}</div>}
          {success && <div className="inv-success" style={{ marginBottom:12 }}>{success}</div>}
          <form className="inv-form" onSubmit={handleSave}>
            <div className="inv-form-row">
              <div className="inv-field inv-field-wide">
                <label>Item Name *</label>
                <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
                  placeholder="e.g. Submersible Pump 1.5HP" className="inv-input" />
              </div>
              <div className="inv-field">
                <label>SKU / Part No.</label>
                <input value={form.sku} onChange={e=>setForm(p=>({...p,sku:e.target.value}))}
                  placeholder="e.g. PMP-001" className="inv-input" />
              </div>
              <div className="inv-field">
                <label>Category</label>
                <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} className="inv-input">
                  {CATEGORIES.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c.replace('_',' ')}</option>)}
                </select>
              </div>
              <div className="inv-field">
                <label>Unit</label>
                <select value={form.unit} onChange={e=>setForm(p=>({...p,unit:e.target.value}))} className="inv-input">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="inv-form-row">
              <div className="inv-field">
                <label>Opening Qty</label>
                <input type="number" min="0" value={form.quantity}
                  onChange={e=>setForm(p=>({...p,quantity:e.target.value}))} className="inv-input" />
              </div>
              <div className="inv-field">
                <label>Reorder Level</label>
                <input type="number" min="0" value={form.reorderLevel}
                  onChange={e=>setForm(p=>({...p,reorderLevel:e.target.value}))} className="inv-input" />
              </div>
              <div className="inv-field">
                <label>Unit Cost (ETB)</label>
                <input type="number" min="0" step="0.01" value={form.unitCost}
                  onChange={e=>setForm(p=>({...p,unitCost:e.target.value}))} className="inv-input" />
              </div>
              <div className="inv-field">
                <label>Assigned Farm</label>
                <select value={form.farmId} onChange={e=>setForm(p=>({...p,farmId:e.target.value}))} className="inv-input">
                  <option value="">Central / Global</option>
                  {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                </select>
              </div>
            </div>
            <div className="inv-form-row">
              <div className="inv-field">
                <label>Supplier</label>
                <input value={form.supplier} onChange={e=>setForm(p=>({...p,supplier:e.target.value}))}
                  placeholder="e.g. ABC Hardware" className="inv-input" />
              </div>
              <div className="inv-field">
                <label>Storage Location</label>
                <input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))}
                  placeholder="e.g. Warehouse A, Shelf 3" className="inv-input" />
              </div>
              <div className="inv-field inv-field-wide">
                <label>Description</label>
                <input value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}
                  placeholder="Optional notes…" className="inv-input" />
              </div>
            </div>
            <div className="inv-form-actions">
              <button type="submit" className="inv-btn inv-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update Item' : 'Add to Inventory'}
              </button>
              {editId && (
                <button type="button" className="inv-btn inv-btn-ghost"
                  onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="inv-filters">
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search name, SKU, supplier…" className="inv-input inv-input-search" />
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} className="inv-input inv-select">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c.replace('_',' ')}</option>)}
        </select>
        <select value={filterFarm} onChange={e=>setFilterFarm(e.target.value)} className="inv-input inv-select">
          <option value="">All Farms / Central</option>
          {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.84rem',
          color:'var(--text-muted)', cursor:'pointer', whiteSpace:'nowrap' }}>
          <input type="checkbox" checked={onlyLowStock} onChange={e=>setOnlyLowStock(e.target.checked)} />
          Low stock only
        </label>
        <span className="inv-count">{filtered.length} items</span>
      </div>

      {/* Items table */}
      {filtered.length === 0 ? (
        <div className="inv-empty">No inventory items found. Add one above.</div>
      ) : (
        <div className="inv-card inv-no-pad">
          <table className="inv-table">
            <thead>
              <tr>
                <th>Item</th><th>Category</th><th>Farm</th><th>Quantity</th>
                <th>Unit Cost</th><th>Total Value</th><th>Location</th>
                <th>Last Restocked</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const isLow = item.quantity <= item.reorderLevel;
                return (
                  <tr key={item._id} className={isLow ? 'inv-low-stock' : ''}>
                    <td>
                      <strong>{CAT_ICONS[item.category]} {item.name}</strong>
                      {item.sku && <div className="inv-sub">SKU: {item.sku}</div>}
                      {item.supplier && <div className="inv-sub">🏭 {item.supplier}</div>}
                    </td>
                    <td>
                      <span className="inv-badge" style={{ background:'var(--surface-hover)', color:'var(--text-muted)' }}>
                        {item.category.replace('_',' ')}
                      </span>
                    </td>
                    <td>{item.farmId?.name || <span className="inv-muted">Central</span>}</td>
                    <td>
                      <span className={`inv-qty ${qtyClass(item)}`}>
                        {item.quantity === 0 ? '⛔' : isLow ? '⚠️' : '✅'} {item.quantity} {item.unit}
                      </span>
                      <div className="inv-sub">Reorder at {item.reorderLevel}</div>
                    </td>
                    <td>ETB {item.unitCost?.toLocaleString()}</td>
                    <td><strong>ETB {item.totalValue?.toLocaleString()}</strong></td>
                    <td style={{ fontSize:'0.82rem' }}>{item.location || '—'}</td>
                    <td style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>
                      {item.lastRestockedAt ? new Date(item.lastRestockedAt).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <button className="inv-btn-icon" onClick={() => handleEdit(item)} title="Edit">✏️</button>
                      <button className="inv-btn-icon" title="Adjust Stock"
                        onClick={() => { setAdjustItem(item); setAdjustForm(emptyAdjust); setAdjustError(''); }}>
                        🔄
                      </button>
                      <button className="inv-btn-icon" title="History"
                        onClick={() => openHistory(item)}>
                        📋
                      </button>
                      {user.role === 'super_administrator' && (
                        <button className="inv-btn-icon inv-btn-danger"
                          onClick={() => handleDeactivate(item._id)} title="Deactivate">🗑️</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustItem && (
        <div className="inv-modal-overlay" onClick={() => setAdjustItem(null)}>
          <div className="inv-modal" onClick={e => e.stopPropagation()}>
            <h3>🔄 Adjust Stock — {adjustItem.name}</h3>
            <div style={{ display:'flex', gap:12, marginBottom:16 }}>
              <span className={`inv-qty ${qtyClass(adjustItem)}`}>
                Current: {adjustItem.quantity} {adjustItem.unit}
              </span>
            </div>
            {adjustError && <div className="inv-error" style={{ marginBottom:10 }}>{adjustError}</div>}
            <form className="inv-form" onSubmit={handleAdjust}>
              <div className="inv-form-row">
                <div className="inv-field">
                  <label>Movement Type</label>
                  <select value={adjustForm.type}
                    onChange={e=>setAdjustForm(p=>({...p,type:e.target.value}))} className="inv-input">
                    <option value="restock">➕ Restock (add stock)</option>
                    <option value="consume">➖ Consume (use stock)</option>
                    <option value="adjustment">✏️ Adjustment (correct count)</option>
                    <option value="write_off">❌ Write-Off (damaged/lost)</option>
                  </select>
                </div>
                <div className="inv-field">
                  <label>Quantity *</label>
                  <input type="number" min="0.01" step="0.01" value={adjustForm.quantity}
                    onChange={e=>setAdjustForm(p=>({...p,quantity:e.target.value}))}
                    className="inv-input" placeholder={`in ${adjustItem.unit}s`} />
                </div>
              </div>
              {adjustForm.type === 'restock' && (
                <div className="inv-field">
                  <label>New Unit Cost (ETB) — optional</label>
                  <input type="number" min="0" step="0.01" value={adjustForm.unitCost}
                    onChange={e=>setAdjustForm(p=>({...p,unitCost:e.target.value}))}
                    className="inv-input" placeholder="Leave blank to keep current" />
                </div>
              )}
              <div className="inv-field">
                <label>Reference / PO Number</label>
                <input value={adjustForm.reference}
                  onChange={e=>setAdjustForm(p=>({...p,reference:e.target.value}))}
                  className="inv-input" placeholder="Optional reference…" />
              </div>
              <div className="inv-field">
                <label>Notes</label>
                <input value={adjustForm.notes}
                  onChange={e=>setAdjustForm(p=>({...p,notes:e.target.value}))}
                  className="inv-input" placeholder="Optional notes…" />
              </div>
              <div className="inv-form-actions">
                <button type="submit" className="inv-btn inv-btn-primary" disabled={adjustSaving}>
                  {adjustSaving ? 'Saving…' : 'Confirm Adjustment'}
                </button>
                <button type="button" className="inv-btn inv-btn-ghost" onClick={() => setAdjustItem(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {txItem && (
        <div className="inv-modal-overlay" onClick={() => setTxItem(null)}>
          <div className="inv-modal" style={{ maxWidth:560 }} onClick={e => e.stopPropagation()}>
            <h3>📋 Stock History — {txItem.name}</h3>
            {txLoad ? (
              <p style={{ color:'var(--text-muted)', textAlign:'center', padding:20 }}>Loading…</p>
            ) : txList.length === 0 ? (
              <p style={{ color:'var(--text-muted)', textAlign:'center' }}>No transactions recorded yet.</p>
            ) : (
              <div style={{ maxHeight:340, overflowY:'auto' }}>
                {txList.map(tx => (
                  <div key={tx._id} className="inv-tx-row">
                    <div>
                      <span className={`inv-tx-type-${tx.type}`}>
                        {tx.type === 'restock' ? '➕' : tx.type === 'consume' ? '➖' : tx.type === 'write_off' ? '❌' : '✏️'} {tx.type.replace('_',' ')}
                      </span>
                      <div className="inv-sub">{new Date(tx.createdAt).toLocaleString()} · {tx.performedBy?.name}</div>
                      {tx.notes && <div className="inv-sub">{tx.notes}</div>}
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontWeight:700 }}>
                        {tx.quantity > 0 ? '+' : ''}{tx.quantity} {txItem.unit}
                      </div>
                      <div className="inv-sub">{tx.quantityBefore} → {tx.quantityAfter}</div>
                      {tx.totalCost > 0 && <div className="inv-sub">ETB {tx.totalCost?.toLocaleString()}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop:16 }}>
              <button className="inv-btn inv-btn-ghost" onClick={() => setTxItem(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
