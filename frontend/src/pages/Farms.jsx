import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import FormField from '../components/FormField';
import { API_URL } from '../config/api';

const T = {
  en: {
    pageTitle: 'Zone Control', addNewFarm: 'Add Farm Zone',
    loading: 'Loading farms...', location: 'Location',
    crop: 'Crop Type', size: 'Area Size', acres: 'ha',
    irrigationMethod: 'Irrigation', soilType: 'Soil',
    notAvailable: 'N/A',
    // Modal
    modalTitleAdd: 'Add New Farm Zone',
    modalTitleEdit: 'Edit Farm Zone',
    cancel: 'Cancel',
    save: 'Save Zone',
    saving: 'Saving...',
    delete: 'Delete',
    confirmDelete: 'Are you sure you want to delete this farm zone? This cannot be undone.',
    // Form fields
    farmName: 'Farm Zone Name',
    farmLocation: 'Location (City / Area)',
    cropType: 'Crop Type',
    areaSize: 'Area Size (hectares)',
    soilType: 'Soil Type',
    irrigationMethodLabel: 'Irrigation Method',
    gpsLat: 'GPS Latitude (optional)',
    gpsLng: 'GPS Longitude (optional)',
    // Placeholders
    namePlaceholder: 'e.g. Field A - North Section',
    locationPlaceholder: 'e.g. Bahir Dar, Ethiopia',
    // Options
    cropOptions: ['Maize', 'Teff', 'Wheat', 'Rice', 'Barley', 'Sorghum', 'Other'],
    soilOptions: ['Clay loam', 'Sandy loam', 'Silt loam', 'Clay', 'Sandy', 'Loam'],
    irrigationOptions: ['Drip', 'Sprinkler', 'Flood', 'Furrow', 'Manual'],
    successAdd: 'Farm zone added successfully!',
    successEdit: 'Farm zone updated successfully!',
    successDelete: 'Farm zone deleted.',
    errorSave: 'Failed to save farm zone.',
    requiredName: 'Farm zone name is required',
    requiredLocation: 'Location is required',
  },
  am: {
    pageTitle: 'ዞን ቁጥጥር', addNewFarm: 'አዲስ እርሻ ዞን አክል',
    loading: 'እርሻዎችን በመጫን ላይ...', location: 'ቦታ',
    crop: 'ሰብል ዓይነት', size: 'ስፋት', acres: 'ሄ/ር',
    irrigationMethod: 'መስኖ', soilType: 'አፈር',
    notAvailable: 'N/A',
    modalTitleAdd: 'አዲስ እርሻ ዞን አክል',
    modalTitleEdit: 'እርሻ ዞን አስተካክል',
    cancel: 'ሰርዝ',
    save: 'ዞን አስቀምጥ',
    saving: 'በማስቀመጥ ላይ...',
    delete: 'ሰርዝ',
    confirmDelete: 'ይህን እርሻ ዞን ለመሰረዝ እርግጠኛ ነዎት?',
    farmName: 'የእርሻ ዞን ስም',
    farmLocation: 'ቦታ (ከተማ / አካባቢ)',
    cropType: 'ሰብል ዓይነት',
    areaSize: 'ስፋት (ሄክታር)',
    soilType: 'የአፈር ዓይነት',
    irrigationMethodLabel: 'የመስኖ ዘዴ',
    gpsLat: 'GPS ኬክሮስ (አማራጭ)',
    gpsLng: 'GPS ብዕለ ቅርፅ (አማራጭ)',
    namePlaceholder: 'ለምሳሌ: ሜዳ ሀ - ሰሜናዊ ክፍል',
    locationPlaceholder: 'ለምሳሌ: ባህር ዳር፣ ኢትዮጵያ',
    cropOptions: ['በቆሎ', 'ጤፍ', 'ስንዴ', 'ሩዝ', 'ገብስ', 'ማሽላ', 'ሌሎች'],
    soilOptions: ['ሸክላ ሎም', 'አሸዋ ሎም', 'ሲልት ሎም', 'ሸክላ', 'አሸዋ', 'ሎም'],
    irrigationOptions: ['ቆርቆሮ (Drip)', 'ርጭት (Sprinkler)', 'ጎርፍ (Flood)', 'ፉሮ (Furrow)', 'እጅ'],
    successAdd: 'እርሻ ዞን በተሳካ ሁኔታ ተጨምሯል!',
    successEdit: 'እርሻ ዞን በተሳካ ሁኔታ ተዘምኗል!',
    successDelete: 'እርሻ ዞን ተሰርዟል።',
    errorSave: 'እርሻ ዞን ማስቀመጥ አልተሳካም።',
    requiredName: 'የእርሻ ዞን ስም ያስፈልጋል',
    requiredLocation: 'ቦታ ያስፈልጋል',
  }
};

const cropColor = (crop = '') => {
  const c = crop.toLowerCase();
  if (c.includes('maize') || c.includes('corn') || c.includes('በቆሎ')) return { bg: '#dcfce7', color: '#15803d', icon: '🌽' };
  if (c.includes('teff')  || c.includes('ጤፍ'))   return { bg: '#fef3c7', color: '#92400e', icon: '🌾' };
  if (c.includes('wheat') || c.includes('ስንዴ'))  return { bg: '#fef9c3', color: '#854d0e', icon: '🌾' };
  if (c.includes('rice')  || c.includes('ሩዝ'))   return { bg: '#dbeafe', color: '#1d4ed8', icon: '🌿' };
  return { bg: '#f1f5f9', color: '#475569', icon: '🌱' };
};

const EMPTY_FORM = {
  name: '', location: '', cropType: '', areaSize: '',
  soilType: '', irrigationMethod: '', gpsLat: '', gpsLng: ''
};

const Farms = () => {
  const [farms, setFarms]       = useState([]);
  const [loading, setLoad]      = useState(true);
  const [showModal, setModal]   = useState(false);
  const [editFarm, setEditFarm] = useState(null);   // null = add mode, object = edit mode
  const [form, setForm]         = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving]     = useState(false);
  const [banner, setBanner]     = useState({ type: '', text: '' });

  const { user } = useContext(AuthContext);
  const navigate  = useNavigate();
  const isAmharic = user?.language === 'am';
  const t = T[isAmharic ? 'am' : 'en'];

  const config = { headers: { Authorization: `Bearer ${user?.token}` } };

  const fetchFarms = () => {
    axios.get(`${API_URL}/api/farms`, config)
      .then(r => { setFarms(r.data); setLoad(false); })
      .catch(() => setLoad(false));
  };

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchFarms();
  }, [user, navigate]);

  // Open modal for Add
  const openAdd = () => {
    setEditFarm(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModal(true);
  };

  // Open modal for Edit
  const openEdit = (farm) => {
    setEditFarm(farm);
    setForm({
      name: farm.name || '',
      location: farm.location || '',
      cropType: farm.cropType || '',
      areaSize: farm.areaSize || '',
      soilType: farm.soilType || '',
      irrigationMethod: farm.irrigationMethod || '',
      gpsLat: farm.gps?.lat || '',
      gpsLng: farm.gps?.lng || '',
    });
    setFormErrors({});
    setModal(true);
  };

  const closeModal = () => { setModal(false); setEditFarm(null); };

  const validate = () => {
    const errs = {};
    if (!form.name.trim())     errs.name     = t.requiredName;
    if (!form.location.trim()) errs.location = t.requiredLocation;
    return errs;
  };

  const handleSave = async e => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    setSaving(true);
    setBanner({ type: '', text: '' });

    const payload = {
      name:             form.name.trim(),
      location:         form.location.trim(),
      cropType:         form.cropType,
      sizeArea:         form.areaSize ? Number(form.areaSize) : undefined,
      soilType:         form.soilType,
      irrigationMethod: form.irrigationMethod,
      gps: (form.gpsLat && form.gpsLng)
        ? { lat: Number(form.gpsLat), lng: Number(form.gpsLng) }
        : undefined,
    };

    try {
      if (editFarm) {
        await axios.put(`${API_URL}/api/farms/${editFarm._id}`, payload, config);
        setBanner({ type: 'success', text: t.successEdit });
      } else {
        await axios.post(`${API_URL}/api/farms`, payload, config);
        setBanner({ type: 'success', text: t.successAdd });
      }
      closeModal();
      fetchFarms();
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.error || t.errorSave });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (farmId) => {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      await axios.delete(`${API_URL}/api/farms/${farmId}`, config);
      setBanner({ type: 'success', text: t.successDelete });
      fetchFarms();
    } catch {
      setBanner({ type: 'error', text: t.errorSave });
    }
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'50vh' }}>
      <p style={{ color:'var(--text-muted)' }}>{t.loading}</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize:'1.75rem', fontWeight:800, color:'var(--text-main)', margin:0 }}>
            🌾 {t.pageTitle}
          </h1>
          <p style={{ color:'var(--text-muted)', fontSize:'0.875rem', marginTop:4 }}>
            {isAmharic ? `${farms.length} ዞኖች ተመዝግበዋል` : `${farms.length} zone${farms.length !== 1 ? 's' : ''} registered`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          + {t.addNewFarm}
        </button>
      </div>

      {/* Banner */}
      {banner.text && (
        <div style={{
          padding:'11px 16px', borderRadius:8, marginBottom:18, fontWeight:500, fontSize:'0.875rem',
          background: banner.type === 'success' ? '#ecfdf5' : '#fee2e2',
          border: `1px solid ${banner.type === 'success' ? '#a7f3d0' : '#fca5a5'}`,
          color: banner.type === 'success' ? '#047857' : '#b91c1c',
          display:'flex', alignItems:'center', gap:8
        }}>
          {banner.type === 'success' ? '✅' : '❌'} {banner.text}
          <button onClick={() => setBanner({ type:'', text:'' })}
            style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', fontSize:'1rem', color:'inherit' }}>×</button>
        </div>
      )}

      {/* Farm Cards */}
      {farms.length === 0 ? (
        <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)' }}>
          <EmptyState type="farm" isAmharic={isAmharic}
            action={openAdd}
            actionLabel={`+ ${t.addNewFarm}`} />
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:20 }}>
          {farms.map(farm => {
            const chip = cropColor(farm.cropType);
            return (
              <div key={farm._id} style={{
                background:'var(--surface)', borderRadius:14, overflow:'hidden',
                border:'1px solid var(--border)', boxShadow:'var(--shadow-card)',
                transition:'box-shadow 0.2s, transform 0.2s', display:'flex', flexDirection:'column',
              }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow='var(--shadow-lg)'; e.currentTarget.style.transform='translateY(-3px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow='var(--shadow-card)'; e.currentTarget.style.transform='none'; }}>

                <div style={{ height:6, background:chip.color, opacity:0.7 }} />

                <div style={{ padding:'18px 20px 20px', flex:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <h3 style={{ margin:0, fontSize:'1.05rem', fontWeight:700, color:'var(--text-main)' }}>
                      {farm.name}
                    </h3>
                    <span style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px',
                      borderRadius:20, background:chip.bg, color:chip.color,
                      fontSize:'0.72rem', fontWeight:700, whiteSpace:'nowrap' }}>
                      {chip.icon} {farm.cropType || t.notAvailable}
                    </span>
                  </div>

                  <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', marginBottom:14,
                    display:'flex', alignItems:'center', gap:5 }}>
                    📍 {farm.location || t.notAvailable}
                  </p>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                    {[
                      { label: t.size,            value: farm.areaSize ? `${farm.areaSize} ${t.acres}` : t.notAvailable, icon: '📐' },
                      { label: t.soilType,         value: farm.soilType || t.notAvailable, icon: '🪨' },
                      { label: t.irrigationMethod, value: farm.irrigationMethod || t.notAvailable, icon: '💧' },
                    ].map(s => (
                      <div key={s.label} style={{ background:'var(--surface-hover)', borderRadius:8, padding:'8px 12px' }}>
                        <span style={{ fontSize:'0.67rem', color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:2 }}>
                          {s.icon} {s.label}
                        </span>
                        <strong style={{ fontSize:'0.84rem', color:'var(--text-main)' }}>{s.value}</strong>
                      </div>
                    ))}
                  </div>

                  {/* Edit / Delete buttons */}
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn btn-outline"
                      style={{ flex:1, padding:'8px', fontSize:'0.82rem' }}
                      onClick={() => openEdit(farm)}>
                      ✏️ {isAmharic ? 'አስተካክል' : 'Edit'}
                    </button>
                    <button
                      style={{ padding:'8px 14px', fontSize:'0.82rem', borderRadius:8,
                        background:'#fee2e2', color:'#b91c1c', border:'1px solid #fca5a5',
                        cursor:'pointer', fontWeight:600 }}
                      onClick={() => handleDelete(farm._id)}>
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
          display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:1000, padding:'16px',
        }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>

          <div style={{
            background:'var(--surface)', borderRadius:16, width:'100%', maxWidth:540,
            maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)',
          }}>
            {/* Modal header */}
            <div style={{ padding:'20px 24px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ margin:0, fontSize:'1.25rem', fontWeight:700, color:'var(--text-main)' }}>
                🌾 {editFarm ? t.modalTitleEdit : t.modalTitleAdd}
              </h2>
              <button onClick={closeModal} style={{ background:'none', border:'none', cursor:'pointer',
                fontSize:'1.4rem', color:'var(--text-muted)', lineHeight:1 }}>×</button>
            </div>

            <form onSubmit={handleSave} noValidate style={{ padding:'20px 24px 24px' }}>

              {/* Row 1: Name */}
              <FormField label={t.farmName} name="name" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                onBlur={() => {}}
                error={formErrors.name} touched={!!formErrors.name}
                placeholder={t.namePlaceholder} required />

              {/* Row 2: Location */}
              <FormField label={t.farmLocation} name="location" value={form.location}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                onBlur={() => {}}
                error={formErrors.location} touched={!!formErrors.location}
                placeholder={t.locationPlaceholder} required />

              {/* Row 3: 2 column — Crop + Area */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div className="fv-group">
                  <label className="fv-label">{t.cropType}</label>
                  <select value={form.cropType}
                    onChange={e => setForm(p => ({ ...p, cropType: e.target.value }))}
                    style={{ width:'100%', padding:'10px 14px', borderRadius:8,
                      border:'1.5px solid var(--border)', background:'var(--surface)',
                      color:'var(--text-main)', fontSize:'0.95rem', fontFamily:'inherit',
                      cursor:'pointer', outline:'none' }}>
                    <option value="">{isAmharic ? '-- ይምረጡ --' : '-- Select --'}</option>
                    {t.cropOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <FormField label={`${t.areaSize}`} name="areaSize" type="number"
                  value={form.areaSize} min={0}
                  onChange={e => setForm(p => ({ ...p, areaSize: e.target.value }))}
                  onBlur={() => {}} error="" touched={false}
                  placeholder="0.0" />
              </div>

              {/* Row 4: 2 column — Soil + Irrigation */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div className="fv-group">
                  <label className="fv-label">{t.soilType}</label>
                  <select value={form.soilType}
                    onChange={e => setForm(p => ({ ...p, soilType: e.target.value }))}
                    style={{ width:'100%', padding:'10px 14px', borderRadius:8,
                      border:'1.5px solid var(--border)', background:'var(--surface)',
                      color:'var(--text-main)', fontSize:'0.95rem', fontFamily:'inherit',
                      cursor:'pointer', outline:'none' }}>
                    <option value="">{isAmharic ? '-- ይምረጡ --' : '-- Select --'}</option>
                    {t.soilOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="fv-group">
                  <label className="fv-label">{t.irrigationMethodLabel}</label>
                  <select value={form.irrigationMethod}
                    onChange={e => setForm(p => ({ ...p, irrigationMethod: e.target.value }))}
                    style={{ width:'100%', padding:'10px 14px', borderRadius:8,
                      border:'1.5px solid var(--border)', background:'var(--surface)',
                      color:'var(--text-main)', fontSize:'0.95rem', fontFamily:'inherit',
                      cursor:'pointer', outline:'none' }}>
                    <option value="">{isAmharic ? '-- ይምረጡ --' : '-- Select --'}</option>
                    {t.irrigationOptions.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 5: GPS (optional) */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <FormField label={t.gpsLat} name="gpsLat" type="number" value={form.gpsLat}
                  onChange={e => setForm(p => ({ ...p, gpsLat: e.target.value }))}
                  onBlur={() => {}} error="" touched={false} placeholder="e.g. 11.5742" />
                <FormField label={t.gpsLng} name="gpsLng" type="number" value={form.gpsLng}
                  onChange={e => setForm(p => ({ ...p, gpsLng: e.target.value }))}
                  onBlur={() => {}} error="" touched={false} placeholder="e.g. 37.3614" />
              </div>

              {/* Action buttons */}
              <div style={{ display:'flex', gap:12, marginTop:8 }}>
                <button type="button" className="btn btn-outline"
                  style={{ flex:1, padding:'12px' }} onClick={closeModal}>
                  {t.cancel}
                </button>
                <button type="submit" className="btn btn-primary"
                  style={{ flex:2, padding:'12px', opacity: saving ? 0.7 : 1 }}
                  disabled={saving}>
                  {saving ? t.saving : `✅ ${t.save}`}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Farms;
