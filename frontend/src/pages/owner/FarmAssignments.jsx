import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import PermissionDeniedToast from '../../components/common/PermissionDeniedToast';
import './OwnerPages.css';

const T = {
  en: {
    title: 'Farm Assignments',
    subtitle: 'Assign farmers to farms and manage workforce distribution',
    assignFarmer: '+ Assign Farmer',
    noAssignments: 'No farm assignments yet.',
    farmer: 'Farmer',
    farm: 'Farm',
    location: 'Location',
    cropType: 'Crop',
    actions: 'Actions',
    unassign: 'Unassign',
    unassignConfirm: 'Remove this farmer from the farm?',
    selectFarmer: 'Select Farmer',
    selectFarm: 'Select Farm',
    assign: 'Assign',
    cancel: 'Cancel',
    loading: 'Loading assignments...',
    unassignedFarmers: 'Unassigned Farmers',
    availableFarms: 'Available Farms',
    noUnassigned: 'All farmers are assigned to farms.',
    currentAssignments: 'Current Assignments',
  },
  am: {
    title: 'የእርሻ ማስተላለፊያ',
    subtitle: 'አርሶ አደሮችን ወደ እርሻ ያስተላልፉ',
    assignFarmer: '+ አርሶ አደር አስተላልፍ',
    noAssignments: 'እስካሁን ምንም ማስተላለፊያ የለም።',
    farmer: 'አርሶ አደር',
    farm: 'እርሻ',
    location: 'ቦታ',
    cropType: 'ሰብል',
    actions: 'ተግባሮች',
    unassign: 'አስወግድ',
    unassignConfirm: 'ይህን አርሶ አደር ከእርሻው ማስወገድ ይፈልጋሉ?',
    selectFarmer: 'አርሶ አደር ይምረጡ',
    selectFarm: 'እርሻ ይምረጡ',
    assign: 'አስተላልፍ',
    cancel: 'ሰርዝ',
    loading: 'በመጫን ላይ...',
    unassignedFarmers: 'ያልተመደቡ አርሶ አደሮች',
    availableFarms: 'ያሉ እርሻዎች',
    noUnassigned: 'ሁሉም አርሶ አደሮች ተመድበዋል።',
    currentAssignments: 'አሁን ያሉ ማስተላለፊያዎች',
  },
};

export default function FarmAssignments() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };
  const isAm = user?.language === 'am';
  const t = isAm ? T.am : T.en;

  const [assignments, setAssignments] = useState([]);
  const [farms, setFarms] = useState([]);
  const [unassignedFarmers, setUnassignedFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ farmerId: '', farmId: '' });
  const [saving, setSaving] = useState(false);
  const [showPermDenied, setShowPermDenied] = useState(false);
  const [banner, setBanner] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/farm-assignments`, cfg);
      setAssignments(res.data.assignments || []);
      setFarms(res.data.farms || []);
      setUnassignedFarmers(res.data.unassignedFarmers || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
      setLoading(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!formData.farmerId || !formData.farmId) {
      setBanner({ type: 'error', text: isAm ? 'አርሶ አደር እና እርሻ ይምረጡ' : 'Please select both a farmer and a farm' });
      return;
    }

    setSaving(true);
    setBanner({ type: '', text: '' });
    try {
      const res = await axios.post(`${API_URL}/api/farm-assignments`, formData, cfg);
      setShowForm(false);
      setFormData({ farmerId: '', farmId: '' });
      setBanner({ type: 'success', text: res.data.message || (isAm ? 'ተሳካ!' : 'Farmer assigned successfully!') });
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.details || 'Failed to assign farmer';
      setBanner({ type: 'error', text: msg });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (farmerId) => {
    if (!window.confirm(t.unassignConfirm)) return;
    try {
      await axios.delete(`${API_URL}/api/farm-assignments/${farmerId}`, cfg);
      setBanner({ type: 'success', text: isAm ? 'አርሶ አደሩ ተወግዷል' : 'Farmer unassigned successfully' });
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to unassign farmer';
      setBanner({ type: 'error', text: msg });
    }
  };

  if (loading) {
    return <div className="ow-loading">{t.loading}</div>;
  }

  return (
    <div className="ow-page">
      {/* Header */}
      <div className="ow-header">
        <h2>🌾 {t.title}</h2>
        <p className="ow-subtitle">{t.subtitle}</p>
      </div>

      {/* Banner */}
      {banner.text && (
        <div style={{
          padding: '11px 16px', borderRadius: 8, fontWeight: 500, fontSize: '0.875rem',
          display: 'flex', alignItems: 'center', gap: 8,
          background: banner.type === 'success' ? '#ecfdf5' : '#fee2e2',
          border: `1px solid ${banner.type === 'success' ? '#a7f3d0' : '#fca5a5'}`,
          color: banner.type === 'success' ? '#047857' : '#b91c1c',
        }}>
          {banner.type === 'success' ? '✅' : '❌'} {banner.text}
          <button onClick={() => setBanner({ type: '', text: '' })}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'inherit' }}>×</button>
        </div>
      )}

      {/* Unassigned Farmers Alert */}
      {unassignedFarmers.length > 0 && (
        <div className="ow-card" style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}>
          <div className="ow-card-header">
            <h3 style={{ margin: 0, color: '#92400e' }}>⚠️ {t.unassignedFarmers} ({unassignedFarmers.length})</h3>
            <button className="ow-btn ow-btn-approve" onClick={() => setShowForm(true)}>
              {t.assignFarmer}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {unassignedFarmers.map(f => (
              <span key={f._id} style={{
                padding: '6px 12px',
                background: '#fff',
                borderRadius: 20,
                fontSize: '0.82rem',
                fontWeight: 600,
                border: '1px solid #fcd34d'
              }}>
                👤 {f.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Current Assignments */}
      <div className="ow-card">
        <div className="ow-card-header">
          <h3>{t.currentAssignments}</h3>
          {unassignedFarmers.length === 0 && (
            <button className="ow-btn ow-btn-approve" onClick={() => setShowForm(true)}>
              {t.assignFarmer}
            </button>
          )}
        </div>

        {assignments.length === 0 ? (
          <div className="ow-empty">
            <p>{t.noAssignments}</p>
            <p style={{ fontSize: '0.85rem', marginTop: 8 }}>
              {isAm ? 'አርሶ አደሮችን ወደ እርሻዎች ያስተላልፉ' : 'Assign farmers to your farms to get started'}
            </p>
          </div>
        ) : (
          <div className="ow-table-wrap">
            <table className="ow-table">
              <thead>
                <tr>
                  <th>{t.farmer}</th>
                  <th>{t.farm}</th>
                  <th>{t.location}</th>
                  <th>{t.cropType}</th>
                  <th>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{item.farmer?.name || '—'}</strong>
                      <div className="ow-sub">{item.farmer?.email || ''}</div>
                    </td>
                    <td>
                      {item.farm ? (
                        <span style={{
                          padding: '3px 10px',
                          background: '#dcfce7',
                          color: '#15803d',
                          borderRadius: 12,
                          fontSize: '0.78rem',
                          fontWeight: 600
                        }}>
                          🌾 {item.farm.name}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {isAm ? 'ያልተመደበ' : 'Unassigned'}
                        </span>
                      )}
                    </td>
                    <td>{item.farm?.location || '—'}</td>
                    <td>{item.farm?.cropType || '—'}</td>
                    <td>
                      {item.farm && (
                        <button
                          className="ow-btn ow-btn-reject"
                          onClick={() => handleUnassign(item.farmer._id)}
                        >
                          {t.unassign}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Available Farms */}
      <div className="ow-card">
        <h3>🌾 {t.availableFarms} ({farms.length})</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12, marginTop: 12 }}>
          {farms.map(farm => (
            <div key={farm._id} style={{
              padding: 14,
              background: 'var(--surface-hover)',
              borderRadius: 10,
              border: '1px solid var(--border)'
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 4 }}>🌾 {farm.name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>📍 {farm.location || 'No location'}</div>
              {farm.cropType && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>🌱 {farm.cropType}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Assign Farmer Modal */}
      {showForm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 420,
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                {t.assignFarmer}
              </h2>
              <button onClick={() => setShowForm(false)} style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.4rem',
                color: 'var(--text-muted)',
                lineHeight: 1
              }}>×</button>
            </div>

            <form onSubmit={handleAssign} style={{ padding: 22 }}>
              <div className="fv-group">
                <label className="fv-label">{t.selectFarmer} <span className="fv-required">*</span></label>
                <select
                  value={formData.farmerId}
                  onChange={(e) => setFormData({ ...formData, farmerId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1.5px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-main)',
                    fontSize: '0.95rem',
                    cursor: 'pointer'
                  }}
                  required
                >
                  <option value="">{t.selectFarmer}</option>
                  {unassignedFarmers.map(f => (
                    <option key={f._id} value={f._id}>{f.name} ({f.email})</option>
                  ))}
                </select>
              </div>

              <div className="fv-group" style={{ marginTop: 12 }}>
                <label className="fv-label">{t.selectFarm} <span className="fv-required">*</span></label>
                <select
                  value={formData.farmId}
                  onChange={(e) => setFormData({ ...formData, farmId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1.5px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-main)',
                    fontSize: '0.95rem',
                    cursor: 'pointer'
                  }}
                  required
                >
                  <option value="">{t.selectFarm}</option>
                  {farms.map(f => (
                    <option key={f._id} value={f._id}>{f.name} - {f.location || 'No location'}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button
                  type="button"
                  className="ow-btn"
                  style={{ flex: 1, padding: '11px', background: '#f1f5f9', color: '#475569' }}
                  onClick={() => setShowForm(false)}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="ow-btn ow-btn-approve"
                  style={{ flex: 2, padding: '11px', opacity: saving ? 0.7 : 1 }}
                  disabled={saving}
                >
                  {saving ? (isAm ? 'በማስተላለፍ...' : 'Assigning...') : t.assign}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permission Denied Toast */}
      <PermissionDeniedToast
        show={showPermDenied}
        onClose={() => setShowPermDenied(false)}
        isAmharic={isAm}
      />
    </div>
  );
}
