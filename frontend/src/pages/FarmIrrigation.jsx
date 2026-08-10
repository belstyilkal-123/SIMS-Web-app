import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { io } from 'socket.io-client';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import GISMap from '../components/GISMap';
import EmptyState from '../components/EmptyState';
import FormField from '../components/FormField';
import { API_URL, SOCKET_URL } from '../config/api';
import './Dashboard.css';

/* ─── translations ─────────────────────────────────────────────────────── */
const T = {
  en: {
    pageTitle: 'Farm & Irrigation Management',
    tabFarm: '🌾 Farm Management', tabIrrigation: '🚰 Irrigation Control',
    addNewFarm: 'Add Farm Zone', loading: 'Loading…',
    location: 'Location', crop: 'Crop Type', size: 'Area Size', acres: 'ha',
    irrigationMethod: 'Irrigation', soilType: 'Soil', notAvailable: 'N/A',
    modalTitleAdd: 'Add New Farm Zone', modalTitleEdit: 'Edit Farm Zone',
    cancel: 'Cancel', save: 'Save Zone', saving: 'Saving…',
    confirmDelete: 'Delete this farm zone? This cannot be undone.',
    farmName: 'Farm Zone Name', farmLocation: 'Location (City / Area)',
    cropType: 'Crop Type', areaSize: 'Area Size (hectares)',
    soilTypeLabel: 'Soil Type', irrigationMethodLabel: 'Irrigation Method',
    gpsLat: 'GPS Latitude (optional)', gpsLng: 'GPS Longitude (optional)',
    namePlaceholder: 'e.g. Field A – North Section',
    locationPlaceholder: 'e.g. Bahir Dar, Ethiopia',
    cropOptions: ['Maize','Teff','Wheat','Rice','Barley','Sorghum','Other'],
    soilOptions: ['Clay loam','Sandy loam','Silt loam','Clay','Sandy','Loam'],
    irrigationOptions: ['Drip','Sprinkler','Flood','Furrow','Manual'],
    successAdd: 'Farm zone added!', successEdit: 'Farm zone updated!',
    successDelete: 'Farm zone deleted.', errorSave: 'Failed to save farm zone.',
    requiredName: 'Farm zone name is required', requiredLocation: 'Location is required',
    farmSelector: 'Select Farm',
    soilMoisture: 'Soil Moisture (Root Zone)', waterTank: 'Water Tank Level',
    climateInfo: 'Climate & Soil pH', npkInfo: 'Soil Nutrients (NPK)',
    nitrogen: 'Nitrogen (N)', phosphorus: 'Phosphorus (P)', potassium: 'Potassium (K)',
    phLabel: 'Soil pH Level', phStatus: 'Excellent',
    alertLogTitle: 'Alerts & Buzzer Log', buzzerStatus: 'Local Buzzer',
    buzzerActive: 'ACTIVE', buzzerMuted: 'MUTED',
    muteBuzzer: 'Mute Buzzer', testBuzzer: 'Test Buzzer',
    temperature: 'Temperature', humidity: 'Humidity',
    todayUsage: "Today's Usage", lastIrrigation: 'Last Irrigation',
    systemStatusTitle: 'System & Connectivity', sensorHealth: 'Sensor Health',
    espStatus: 'ESP8266 Unit', manualControlTitle: 'Manual Pump Control',
    overrideText: 'Override automated irrigation thresholds',
    startPump: '💧 START PUMP', stopPump: '🛑 STOP PUMP',
    pumpRunning: 'Pump is currently: ON', pumpStopped: 'Pump is currently: OFF',
    trendsTitle: 'pH & Temperature Trends',
    deviceOffline: 'OFFLINE', deviceOnline: 'ONLINE',
    offlineBanner: 'Device offline — showing last known readings. Controls disabled.',
    lastSeen: 'Last seen',
    viewIrrigation: 'View Irrigation',
    irrigationSwitchHint: '🚰 Click to open Irrigation tab for this farm',
  },
  am: {
    pageTitle: 'የእርሻ እና የመስኖ አስተዳደር',
    tabFarm: '🌾 እርሻ አስተዳደር', tabIrrigation: '🚰 የመስኖ ቁጥጥር',
    addNewFarm: 'አዲስ ዞን አክል', loading: 'በመጫን ላይ…',
    location: 'ቦታ', crop: 'ሰብል', size: 'ስፋት', acres: 'ሄ/ር',
    irrigationMethod: 'መስኖ', soilType: 'አፈር', notAvailable: 'N/A',
    modalTitleAdd: 'አዲስ እርሻ ዞን', modalTitleEdit: 'ዞን አስተካክል',
    cancel: 'ሰርዝ', save: 'አስቀምጥ', saving: 'በማስቀመጥ…',
    confirmDelete: 'ይህን ዞን ለመሰረዝ እርግጠኛ ነዎት?',
    farmName: 'የዞን ስም', farmLocation: 'ቦታ (ከተማ / አካባቢ)',
    cropType: 'ሰብል ዓይነት', areaSize: 'ስፋት (ሄ/ር)',
    soilTypeLabel: 'የአፈር ዓይነት', irrigationMethodLabel: 'የመስኖ ዘዴ',
    gpsLat: 'GPS ኬክሮስ (አማራጭ)', gpsLng: 'GPS ብዕለ ቅርፅ (አማራጭ)',
    namePlaceholder: 'ለምሳሌ: ሜዳ ሀ – ሰሜናዊ', locationPlaceholder: 'ለምሳሌ: ባህር ዳር',
    cropOptions: ['በቆሎ','ጤፍ','ስንዴ','ሩዝ','ገብስ','ማሽላ','ሌሎች'],
    soilOptions: ['ሸክላ ሎም','አሸዋ ሎም','ሲልት ሎም','ሸክላ','አሸዋ','ሎም'],
    irrigationOptions: ['ቆርቆሮ','ርጭት','ጎርፍ','ፉሮ','እጅ'],
    successAdd: 'ዞን ተጨምሯል!', successEdit: 'ዞን ተዘምኗል!',
    successDelete: 'ዞን ተሰርዟል።', errorSave: 'ማስቀመጥ አልተሳካም።',
    requiredName: 'ስም ያስፈልጋል', requiredLocation: 'ቦታ ያስፈልጋል',
    farmSelector: 'እርሻ ምረጥ',
    soilMoisture: 'የአፈር እርጥበት (ስር ዞን)', waterTank: 'ታንከር ደረጃ',
    climateInfo: 'አየር ንብረት እና pH', npkInfo: 'ንጥረ ነገሮች (NPK)',
    nitrogen: 'ናይትሮጅን (N)', phosphorus: 'ፎስፈረስ (P)', potassium: 'ፖታሲየም (K)',
    phLabel: 'pH ደረጃ', phStatus: 'ጥሩ',
    alertLogTitle: 'ማሳወቂያዎች', buzzerStatus: 'ድምፅ',
    buzzerActive: 'ገባሪ', buzzerMuted: 'ዝምታ', muteBuzzer: 'አጥፋ', testBuzzer: 'ሞክር',
    temperature: 'ሙቀት', humidity: 'እርጥበት',
    todayUsage: 'የዛሬ አጠቃቀም', lastIrrigation: 'ያለፈ መስኖ',
    systemStatusTitle: 'ሁኔታ', sensorHealth: 'ሴንሰር',
    espStatus: 'ESP8266', manualControlTitle: 'እጅ ቁጥጥር',
    overrideText: 'ራስ-ሰር ቁጥጥርን ቅልጥፍ',
    startPump: '💧 አስጀምር', stopPump: '🛑 አቁም',
    pumpRunning: 'ፓምፕ: ክፍት', pumpStopped: 'ፓምፕ: ዝግ',
    trendsTitle: 'ትንታኔ',
    deviceOffline: 'ኦፍላይን', deviceOnline: 'ኦንላይን',
    offlineBanner: 'ኦፍላይን — የመጨረሻ ንባቦች። ቁጥጥሮቹ ተዘግተዋል።',
    lastSeen: 'ለመጨረሻ ጊዜ',
    viewIrrigation: 'መስኖ ይቆጣጠሩ',
    irrigationSwitchHint: '🚰 የዚህ እርሻ መስኖ ቁጥጥር ለማየት ጠቅ ያድርጉ',
  },
};

/* ─── helpers ──────────────────────────────────────────────────────────── */
const cropColor = (crop = '') => {
  const c = crop.toLowerCase();
  if (c.includes('maize') || c.includes('corn') || c.includes('በቆሎ')) return { bg:'#dcfce7', color:'#15803d', icon:'🌽' };
  if (c.includes('teff')  || c.includes('ጤፍ'))  return { bg:'#fef3c7', color:'#92400e', icon:'🌾' };
  if (c.includes('wheat') || c.includes('ስንዴ')) return { bg:'#fef9c3', color:'#854d0e', icon:'🌾' };
  if (c.includes('rice')  || c.includes('ሩዝ'))  return { bg:'#dbeafe', color:'#1d4ed8', icon:'🌿' };
  return { bg:'#f1f5f9', color:'#475569', icon:'🌱' };
};

const EMPTY_FORM = { name:'', location:'', cropType:'', areaSize:'', soilType:'', irrigationMethod:'', gpsLat:'', gpsLng:'' };
const COLORS      = ['#15803D','#E2E8E2'];
const TANK_COLORS = ['#2563EB','#E2E8E2'];

/* ─── Select helper ─────────────────────────────────────────────────────── */
const Sel = ({ label, value, onChange, options, isAm }) => (
  <div className="fv-group">
    <label className="fv-label">{label}</label>
    <select value={value} onChange={onChange}
      style={{ width:'100%', padding:'10px 14px', borderRadius:8,
        border:'1.5px solid var(--border)', background:'var(--surface)',
        color:'var(--text-main)', fontSize:'0.95rem', outline:'none', cursor:'pointer' }}>
      <option value="">{isAm ? '-- ይምረጡ --' : '-- Select --'}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

/* ══════════════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function FarmIrrigation() {
  const { user } = useContext(AuthContext);
  const isAm = user?.language === 'am';
  const t    = T[isAm ? 'am' : 'en'];
  const cfg  = { headers: { Authorization: `Bearer ${user?.token}` } };

  /* ── tab ───────────────────────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState('farm');

  /* ── Farm state ─────────────────────────────────────────────────────────── */
  const [farms, setFarms]           = useState([]);
  const [loadingFarms, setLoadFarms] = useState(true);
  const [showModal, setModal]       = useState(false);
  const [editFarm, setEditFarm]     = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving]         = useState(false);
  const [banner, setBanner]         = useState({ type:'', text:'' });

  /* ── Irrigation state ───────────────────────────────────────────────────── */
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [devices, setDevices]           = useState([]);
  const [activeDevice, setActiveDevice] = useState(null);
  const [sensorData, setSensorData]     = useState({
    soilMoisture:null, temperature:null, humidity:null,
    tankLevel:null, soilPhLevel:null, nitrogen:null,
    phosphorus:null, potassium:null,
    todayWaterUsage:null, lastIrrigationTime:null,
    pumpStatus:'OFF', buzzerStatus:'OFF',
  });
  const [alerts, setAlerts] = useState([]);
  const [phData]            = useState([
    {name:'00:00',ph:6.2,temp:18},{name:'04:00',ph:6.3,temp:17},
    {name:'08:00',ph:6.5,temp:22},{name:'12:00',ph:6.8,temp:28},
    {name:'16:00',ph:6.6,temp:26},{name:'20:00',ph:6.4,temp:21},
  ]);

  /* ── load farms ─────────────────────────────────────────────────────────── */
  const fetchFarms = () =>
    axios.get(`${API_URL}/api/farms`, cfg)
      .then(r => { setFarms(r.data); setLoadFarms(false); })
      .catch(() => setLoadFarms(false));

  useEffect(() => { fetchFarms(); }, []);

  /* sync selectedFarm */
  useEffect(() => {
    if (farms.length > 0 && !selectedFarm) setSelectedFarm(farms[0]);
  }, [farms]);

  /* load devices + summary when farm changes */
  useEffect(() => {
    if (!selectedFarm) return;
    axios.get(`${API_URL}/api/devices?farmId=${selectedFarm._id}`, cfg)
      .then(r => {
        setDevices(r.data);
        const online = r.data.find(d => d.status === 'online');
        setActiveDevice(online || r.data[0] || null);
      }).catch(() => {});
    axios.get(`${API_URL}/api/dashboard/summary?farmId=${selectedFarm._id}`, cfg)
      .then(r => {
        const d = r.data;
        setSensorData(prev => ({
          ...prev,
          soilMoisture:       d.soilMoisture       ?? prev.soilMoisture,
          temperature:        d.temperature        ?? prev.temperature,
          humidity:           d.humidity           ?? prev.humidity,
          tankLevel:          d.tankLevel          ?? prev.tankLevel,
          soilPhLevel:        d.soilPhLevel        ?? prev.soilPhLevel,
          pumpStatus:         d.pumpStatus         ?? prev.pumpStatus,
          todayWaterUsage:    d.todayWaterUsage     ?? prev.todayWaterUsage,
          lastIrrigationTime: d.lastIrrigationTime
            ? new Date(d.lastIrrigationTime).toLocaleString()
            : prev.lastIrrigationTime,
        }));
      }).catch(() => {});
  }, [selectedFarm]);

  /* WebSocket */
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('sensor:update', payload => {
      if (!activeDevice || payload.deviceId !== activeDevice._id) return;
      setSensorData(prev => {
        const nd = { ...prev,
          pumpStatus:   payload.pumpStatus   || prev.pumpStatus,
          buzzerStatus: payload.buzzerStatus || prev.buzzerStatus,
        };
        payload.sensors?.forEach(s => {
          if (s.type === 'moisture')    nd.soilMoisture = s.value;
          if (s.type === 'pH')          nd.soilPhLevel  = s.value;
          if (s.type === 'temperature') nd.temperature  = s.value;
          if (s.type === 'humidity')    nd.humidity     = s.value;
          if (s.type === 'tankLevel')   nd.tankLevel    = s.value;
          if (s.type === 'nitrogen')    nd.nitrogen     = s.value;
          if (s.type === 'phosphorus')  nd.phosphorus   = s.value;
          if (s.type === 'potassium')   nd.potassium    = s.value;
        });
        return nd;
      });
    });
    socket.on('device:status', payload => {
      if (!activeDevice || payload.deviceId !== activeDevice._id) return;
      setActiveDevice(prev => ({ ...prev, status: payload.status, lastSeen: payload.lastSeen }));
      setDevices(prev => prev.map(d => d._id === payload.deviceId ? { ...d, status: payload.status } : d));
    });
    socket.on('system:alert', alert => setAlerts(prev => [{ ...alert, ts: new Date() }, ...prev].slice(0, 5)));
    return () => socket.disconnect();
  }, [activeDevice]);

  /* pump / buzzer */
  const togglePump = async () => {
    if (!isOnline) return;
    const action = sensorData.pumpStatus === 'ON' ? 'PUMP_OFF' : 'PUMP_ON';
    setSensorData(prev => ({ ...prev, pumpStatus: action === 'PUMP_ON' ? 'ON' : 'OFF' }));
    try {
      await axios.post(`${API_URL}/api/irrigation/manual`, { deviceId: activeDevice._id, action }, cfg);
    } catch {
      setSensorData(prev => ({ ...prev, pumpStatus: action === 'PUMP_ON' ? 'OFF' : 'ON' }));
    }
  };
  const toggleBuzzer = async () => {
    if (!isOnline) return;
    const action = sensorData.buzzerStatus === 'ON' ? 'BUZZER_OFF' : 'BUZZER_ON';
    setSensorData(prev => ({ ...prev, buzzerStatus: action === 'BUZZER_ON' ? 'ON' : 'OFF' }));
    try {
      await axios.post(`${API_URL}/api/irrigation/manual`, { deviceId: activeDevice._id, action }, cfg);
    } catch {
      setSensorData(prev => ({ ...prev, buzzerStatus: action === 'BUZZER_ON' ? 'OFF' : 'ON' }));
    }
  };

  const isOnline = activeDevice?.status === 'online';

  /* Farm CRUD */
  const openAdd  = () => { setEditFarm(null); setForm(EMPTY_FORM); setFormErrors({}); setModal(true); };
  const openEdit = farm => {
    setEditFarm(farm);
    setForm({
      name: farm.name||'', location: farm.location||'',
      cropType: farm.cropType||'', areaSize: farm.areaSize||'',
      soilType: farm.soilType||'', irrigationMethod: farm.irrigationMethod||'',
      gpsLat: farm.gps?.lat||'', gpsLng: farm.gps?.lng||'',
    });
    setFormErrors({}); setModal(true);
  };
  const closeModal = () => { setModal(false); setEditFarm(null); };
  const validate   = () => {
    const e = {};
    if (!form.name.trim())     e.name     = t.requiredName;
    if (!form.location.trim()) e.location = t.requiredLocation;
    return e;
  };
  const handleSave = async ev => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(), location: form.location.trim(),
      cropType: form.cropType, sizeArea: form.areaSize ? Number(form.areaSize) : undefined,
      soilType: form.soilType, irrigationMethod: form.irrigationMethod,
      gps: form.gpsLat && form.gpsLng ? { lat: Number(form.gpsLat), lng: Number(form.gpsLng) } : undefined,
    };
    try {
      editFarm
        ? await axios.put(`${API_URL}/api/farms/${editFarm._id}`, payload, cfg)
        : await axios.post(`${API_URL}/api/farms`, payload, cfg);
      setBanner({ type:'success', text: editFarm ? t.successEdit : t.successAdd });
      closeModal(); fetchFarms();
    } catch (err) {
      setBanner({ type:'error', text: err.response?.data?.error || t.errorSave });
    } finally { setSaving(false); }
  };
  const handleDelete = async id => {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      await axios.delete(`${API_URL}/api/farms/${id}`, cfg);
      setBanner({ type:'success', text: t.successDelete });
      fetchFarms();
    } catch { setBanner({ type:'error', text: t.errorSave }); }
  };

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ maxWidth: 1300 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:'1.75rem', fontWeight:800, color:'var(--text-main)', margin:0 }}>
            🌾 {t.pageTitle}
          </h1>
          <p style={{ color:'var(--text-muted)', fontSize:'0.875rem', marginTop:4 }}>
            {isAm ? `${farms.length} ዞኖች ተመዝግበዋል` : `${farms.length} farm zone${farms.length !== 1 ? 's' : ''} registered`}
          </p>
        </div>

        {/* ── Tab switcher ──────────────────────────────────────────────── */}
        <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
          {[
            { key:'farm',       label: t.tabFarm       },
            { key:'irrigation', label: t.tabIrrigation },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding:'10px 22px', border:'none', fontWeight:700, fontSize:'0.88rem',
                cursor:'pointer', transition:'all 0.15s',
                background: activeTab === tab.key ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'var(--surface)',
                color:      activeTab === tab.key ? 'white' : 'var(--text-muted)',
                borderRight: tab.key === 'farm' ? '1px solid var(--border)' : 'none',
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Banner ──────────────────────────────────────────────────────── */}
      {banner.text && (
        <div style={{
          padding:'11px 16px', borderRadius:8, marginBottom:18, fontWeight:500,
          fontSize:'0.875rem', display:'flex', alignItems:'center', gap:8,
          background: banner.type === 'success' ? '#ecfdf5' : '#fee2e2',
          border: `1px solid ${banner.type === 'success' ? '#a7f3d0' : '#fca5a5'}`,
          color:  banner.type === 'success' ? '#047857' : '#b91c1c',
        }}>
          {banner.type === 'success' ? '✅' : '❌'} {banner.text}
          <button onClick={() => setBanner({ type:'', text:'' })}
            style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', fontSize:'1rem', color:'inherit' }}>×</button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 1 — FARM MANAGEMENT
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'farm' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:18 }}>
            <button className="btn btn-primary" onClick={openAdd}>+ {t.addNewFarm}</button>
          </div>

          {loadingFarms ? (
            <p style={{ color:'var(--text-muted)' }}>{t.loading}</p>
          ) : farms.length === 0 ? (
            <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)' }}>
              <EmptyState type="farm" isAmharic={isAm} action={openAdd} actionLabel={`+ ${t.addNewFarm}`} />
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:20 }}>
              {farms.map(farm => {
                const chip = cropColor(farm.cropType);
                return (
                  <div key={farm._id} style={{
                    background:'var(--surface)', borderRadius:14, overflow:'hidden',
                    border:'1px solid var(--border)', boxShadow:'var(--shadow-card)',
                    display:'flex', flexDirection:'column', transition:'box-shadow 0.2s,transform 0.2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow='var(--shadow-lg)'; e.currentTarget.style.transform='translateY(-3px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow='var(--shadow-card)'; e.currentTarget.style.transform='none'; }}>
                    <div style={{ height:6, background:chip.color, opacity:0.7 }} />
                    <div style={{ padding:'18px 20px 20px', flex:1 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                        <h3 style={{ margin:0, fontSize:'1.05rem', fontWeight:700, color:'var(--text-main)' }}>{farm.name}</h3>
                        <span style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px',
                          borderRadius:20, background:chip.bg, color:chip.color,
                          fontSize:'0.72rem', fontWeight:700, whiteSpace:'nowrap' }}>
                          {chip.icon} {farm.cropType || t.notAvailable}
                        </span>
                      </div>
                      <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', marginBottom:14 }}>
                        📍 {farm.location || t.notAvailable}
                      </p>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                        {[
                          { label:t.size,            value: farm.areaSize ? `${farm.areaSize} ${t.acres}` : t.notAvailable, icon:'📐' },
                          { label:t.soilType,        value: farm.soilType || t.notAvailable,       icon:'🪨' },
                          { label:t.irrigationMethod,value: farm.irrigationMethod || t.notAvailable,icon:'💧' },
                        ].map(s => (
                          <div key={s.label} style={{ background:'var(--surface-hover)', borderRadius:8, padding:'8px 12px' }}>
                            <span style={{ fontSize:'0.67rem', color:'var(--text-muted)', fontWeight:600,
                              textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:2 }}>
                              {s.icon} {s.label}
                            </span>
                            <strong style={{ fontSize:'0.84rem', color:'var(--text-main)' }}>{s.value}</strong>
                          </div>
                        ))}
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button className="btn btn-outline" style={{ flex:1, padding:'8px', fontSize:'0.82rem' }}
                          onClick={() => openEdit(farm)}>✏️ {isAm ? 'አስተካክል' : 'Edit'}</button>
                        <button onClick={() => handleDelete(farm._id)}
                          style={{ padding:'8px 14px', fontSize:'0.82rem', borderRadius:8,
                            background:'#fee2e2', color:'#b91c1c', border:'1px solid #fca5a5',
                            cursor:'pointer', fontWeight:600 }}>🗑️</button>
                        {/* Quick-jump to Irrigation tab for this farm */}
                        <button
                          title={t.irrigationSwitchHint}
                          onClick={() => { setSelectedFarm(farm); setActiveTab('irrigation'); }}
                          style={{ padding:'8px 14px', fontSize:'0.82rem', borderRadius:8,
                            background:'#dbeafe', color:'#1d4ed8', border:'1px solid #93c5fd',
                            cursor:'pointer', fontWeight:600 }}>🚰</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 2 — IRRIGATION CONTROL
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'irrigation' && (
        <div>

          {/* Farm selector */}
          {farms.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20,
              background:'var(--surface)', padding:'12px 18px', borderRadius:10,
              border:'1px solid var(--border)' }}>
              <span style={{ fontWeight:600, color:'var(--text-main)', whiteSpace:'nowrap' }}>
                🌾 {t.farmSelector}:
              </span>
              <select className="form-input" style={{ width:260, cursor:'pointer' }}
                value={selectedFarm?._id || ''}
                onChange={e => setSelectedFarm(farms.find(f => f._id === e.target.value))}>
                {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
            </div>
          )}

          {/* Offline banner */}
          {!isOnline && activeDevice && (
            <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:10,
              padding:'12px 18px', marginBottom:18, display:'flex', gap:12, alignItems:'center' }}>
              <span style={{ fontSize:'1.3rem' }}>⚠️</span>
              <div>
                <div style={{ fontWeight:600, color:'#92400e' }}>{t.offlineBanner}</div>
                <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:2 }}>
                  {t.lastSeen}: {activeDevice.lastSeen ? new Date(activeDevice.lastSeen).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>
          )}

          {/* No device */}
          {!activeDevice && (
            <div style={{ marginBottom:18 }}>
              <EmptyState type="device" isAmharic={isAm} />
            </div>
          )}

          <div className="dashboard-grid-v2">

            {/* ── Climate & Soil pH ─────────────────────────────────────── */}
            <div className="card summary-card">
              <h3>{t.climateInfo}</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:15 }}>
                {[
                  { label:t.temperature, value:sensorData.temperature, suffix:'°C' },
                  { label:t.humidity,    value:sensorData.humidity,    suffix:'%'  },
                ].map(row => (
                  <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ color:'var(--text-muted)' }}>{row.label}:</span>
                    <strong style={{ fontSize:'1.2rem', color: isOnline ? 'inherit' : 'var(--text-muted)' }}>
                      {isOnline && row.value !== null ? `${row.value}${row.suffix}` : '--'}
                    </strong>
                  </div>
                ))}
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:10,
                  display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <span style={{ color:'var(--text-muted)' }}>{t.phLabel}:</span>
                    <div style={{ fontSize:'1.3rem', fontWeight:'bold', marginTop:2,
                      color: isOnline ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {isOnline && sensorData.soilPhLevel !== null ? `${sensorData.soilPhLevel} pH` : '-- pH'}
                    </div>
                  </div>
                  {isOnline && (
                    <span style={{ background:'#ecfdf5', color:'#047857',
                      padding:'5px 12px', borderRadius:20, fontWeight:600, fontSize:'0.85rem' }}>
                      {t.phStatus}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── NPK ──────────────────────────────────────────────────── */}
            <div className="card summary-card">
              <h3>{t.npkInfo}</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:15 }}>
                {[
                  { label:t.nitrogen,   val:sensorData.nitrogen,   color:'#3b82f6' },
                  { label:t.phosphorus, val:sensorData.phosphorus, color:'#eab308' },
                  { label:t.potassium,  val:sensorData.potassium,  color:'#ef4444' },
                ].map(n => (
                  <div key={n.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ color:'var(--text-muted)' }}>{n.label}:</span>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:80, height:8, background:'#e2e8f0', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', background:n.color,
                          width:`${isOnline && n.val !== null ? Math.min(100, n.val) : 0}%` }} />
                      </div>
                      <strong style={{ fontSize:'1rem', width:40, textAlign:'right',
                        color: isOnline ? n.color : 'var(--text-muted)' }}>
                        {isOnline && n.val !== null ? `${n.val} mg` : '--'}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Alerts & Buzzer ───────────────────────────────────────── */}
            <div className="card summary-card" style={{ display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <div>
                <h3>{t.alertLogTitle}</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:12, maxHeight:100, overflowY:'auto' }}>
                  {alerts.length === 0
                    ? <span style={{ color:'var(--text-muted)', fontSize:'0.82rem' }}>
                        {isAm ? 'ምንም ማሳወቂያ የለም' : 'No active alerts'}
                      </span>
                    : alerts.map((a, i) => (
                      <div key={i} style={{ fontSize:'0.85rem', padding:'6px 10px', borderRadius:5, fontWeight:500,
                        color: a.type === 'alarm' ? 'var(--danger)' : 'var(--accent)',
                        background: a.type === 'alarm' ? '#fee2e2' : '#fef3c7' }}>
                        ⚠️ {a.message}
                      </div>
                    ))
                  }
                </div>
              </div>
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, marginTop:10,
                display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{t.buzzerStatus}</div>
                  <strong style={{ fontSize:'0.9rem',
                    color: sensorData.buzzerStatus === 'ON' ? 'var(--primary)' : 'var(--danger)' }}>
                    {sensorData.buzzerStatus === 'ON' ? t.buzzerActive : t.buzzerMuted}
                  </strong>
                </div>
                <button className="btn btn-outline"
                  style={{ padding:'6px 12px', fontSize:'0.85rem', borderRadius:8 }}
                  onClick={toggleBuzzer} disabled={!isOnline}>
                  🔊 {sensorData.buzzerStatus === 'ON' ? t.muteBuzzer : t.testBuzzer}
                </button>
              </div>
            </div>

            {/* ── Weather placeholder ────────────────────────────────────── */}
            <div className="card summary-card">
              <h3>☀️ {isAm ? 'የአየር ሁኔታ' : 'Weather'}</h3>
              <div style={{ marginTop:14, textAlign:'center', color:'var(--text-muted)' }}>
                <div style={{ fontSize:'2.5rem' }}>⛅</div>
                <p style={{ fontSize:'0.82rem', margin:'8px 0 0' }}>
                  {isAm ? 'ከዋናው ዳሽቦርድ ይመልከቱ' : 'View on main Dashboard for full forecast'}
                </p>
              </div>
            </div>

            {/* ── Soil Moisture Dial ─────────────────────────────────────── */}
            <div className="card" style={{ gridColumn:'span 1' }}>
              <h3>{t.soilMoisture}</h3>
              <div style={{ position:'relative', height:180, display:'flex', justifyContent:'center', marginTop:10 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{value:sensorData.soilMoisture??0},{value:100-(sensorData.soilMoisture??0)}]}
                      innerRadius={55} outerRadius={70} dataKey="value" startAngle={180} endAngle={0}>
                      <Cell fill={!isOnline ? '#CBD5E1' : ((sensorData.soilMoisture??100) < 30 ? 'var(--danger)' : COLORS[0])} />
                      <Cell fill={COLORS[1]} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position:'absolute', top:'65%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
                  <span style={{ fontSize:'2rem', fontWeight:800,
                    color: !isOnline ? 'var(--text-muted)' : ((sensorData.soilMoisture??100) < 30 ? 'var(--danger)' : 'var(--primary)') }}>
                    {isOnline && sensorData.soilMoisture !== null ? `${sensorData.soilMoisture}%` : '--'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Tank Level Dial ────────────────────────────────────────── */}
            <div className="card" style={{ gridColumn:'span 1' }}>
              <h3>{t.waterTank}</h3>
              <div style={{ position:'relative', height:180, display:'flex', justifyContent:'center', marginTop:10 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{value:sensorData.tankLevel??0},{value:100-(sensorData.tankLevel??0)}]}
                      innerRadius={55} outerRadius={70} dataKey="value" startAngle={90} endAngle={-270}>
                      <Cell fill={!isOnline ? '#CBD5E1' : ((sensorData.tankLevel??100) < 20 ? 'var(--danger)' : TANK_COLORS[0])} />
                      <Cell fill={TANK_COLORS[1]} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
                  <span style={{ fontSize:'2rem', fontWeight:800,
                    color: !isOnline ? 'var(--text-muted)' : 'var(--action)' }}>
                    {isOnline && sensorData.tankLevel !== null ? `${sensorData.tankLevel}%` : '--'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── System Status ─────────────────────────────────────────── */}
            <div className="card" style={{ gridColumn:'span 1', display:'flex', flexDirection:'column', justifyContent:'space-around' }}>
              <h3>{t.systemStatusTitle}</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'var(--text-muted)' }}>{t.sensorHealth}:</span>
                  <span style={{ color: isOnline ? 'var(--primary)' : 'var(--danger)', fontWeight:700 }}>
                    {isOnline ? t.deviceOnline : t.deviceOffline}
                  </span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ color:'var(--text-muted)' }}>{t.espStatus}:</span>
                  <span style={{ fontWeight:700, fontSize:'0.9rem',
                    color: isOnline ? 'var(--primary)' : 'var(--danger)' }}>
                    {activeDevice ? activeDevice.name : 'N/A'}
                  </span>
                </div>
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:10,
                  display:'flex', justifyContent:'space-between' }}>
                  <div>
                    <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{t.todayUsage}</span>
                    <strong style={{ display:'block', fontSize:'1.2rem',
                      color: isOnline ? 'var(--action)' : 'var(--text-muted)' }}>
                      {isOnline && sensorData.todayWaterUsage !== null ? `${sensorData.todayWaterUsage} L` : '-- L'}
                    </strong>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{t.lastIrrigation}</span>
                    <strong style={{ display:'block', fontSize:'0.85rem' }}>
                      {sensorData.lastIrrigationTime ?? '--'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Trends Chart ─────────────────────────────────────────── */}
            <div className="card" style={{ gridColumn:'1 / 3', display:'flex', flexDirection:'column' }}>
              <h3>{t.trendsTitle}</h3>
              {!isOnline && (
                <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', margin:'8px 0 0', fontStyle:'italic' }}>
                  {t.offlineBanner}
                </p>
              )}
              <div style={{ width:'100%', height:210, marginTop:15, opacity: isOnline ? 1 : 0.4 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={phData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="var(--text-muted)" />
                    <YAxis yAxisId="left"  axisLine={false} tickLine={false} stroke="var(--text-muted)" />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} stroke="var(--text-muted)" />
                    <Tooltip />
                    <Line yAxisId="left"  type="monotone" dataKey="temp" stroke="#F59E0B" strokeWidth={3}
                      name={`${t.temperature} (°C)`} dot={{ r:4 }} activeDot={{ r:6 }} />
                    <Line yAxisId="right" type="monotone" dataKey="ph"   stroke="#8B5CF6" strokeWidth={3}
                      name={t.phLabel} dot={{ r:4 }} activeDot={{ r:6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Manual Pump Control ──────────────────────────────────── */}
            <div className="card" style={{ gridColumn:'3 / 4', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'stretch' }}>
              <h3 style={{ textAlign:'center' }}>{t.manualControlTitle}</h3>
              <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:'0.85rem', margin:'10px 0 16px' }}>
                {t.overrideText}
              </p>

              {/* Connection pill */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                padding:'7px 14px', borderRadius:20, marginBottom:14,
                background: isOnline ? '#dcfce7' : '#fee2e2',
                border: `1px solid ${isOnline ? '#86efac' : '#fca5a5'}` }}>
                <span style={{ fontWeight:600, fontSize:'0.82rem',
                  color: isOnline ? '#15803d' : '#b91c1c' }}>
                  {isOnline ? `${t.deviceOnline} — ${activeDevice?.name}` : t.deviceOffline}
                </span>
              </div>

              {/* Pump button */}
              <button onClick={togglePump} className="btn"
                style={{
                  padding:16, fontSize:'1rem', fontWeight:700, borderRadius:12, width:'100%',
                  border:'none', color:'white', transition:'all 0.2s',
                  opacity: isOnline ? 1 : 0.45,
                  cursor: isOnline ? 'pointer' : 'not-allowed',
                  background: !isOnline
                    ? '#cbd5e1'
                    : sensorData.pumpStatus === 'ON'
                      ? 'linear-gradient(135deg,#ef4444,#b91c1c)'
                      : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                  boxShadow: isOnline
                    ? sensorData.pumpStatus === 'ON'
                      ? '0 4px 14px rgba(239,68,68,0.35)'
                      : '0 4px 14px rgba(37,99,235,0.35)'
                    : 'none',
                }}
                disabled={!isOnline}>
                {sensorData.pumpStatus === 'ON' ? t.stopPump : t.startPump}
              </button>

              {!isOnline && (
                <p style={{ textAlign:'center', color:'var(--danger)', fontSize:'0.78rem', marginTop:8, fontWeight:500 }}>
                  ⛔ {isAm ? 'ለቁጥጥር መሣሪያ ኦንላይን መሆን አለበት' : 'Device must be online to use controls'}
                </p>
              )}

              <div style={{ textAlign:'center', marginTop:12, padding:10, borderRadius:8,
                background: sensorData.pumpStatus === 'ON' ? '#fee2e2' : '#dcfce7',
                opacity: isOnline ? 1 : 0.55 }}>
                <strong style={{ fontSize:'0.88rem',
                  color: sensorData.pumpStatus === 'ON' ? '#b91c1c' : '#15803d' }}>
                  {sensorData.pumpStatus === 'ON' ? t.pumpRunning : t.pumpStopped}
                </strong>
              </div>
            </div>

            {/* ── GIS Map ───────────────────────────────────────────────── */}
            <GISMap farms={farms} devices={devices} isAmharic={isAm} />

          </div>{/* end dashboard-grid-v2 */}
        </div>
      )}{/* end irrigation tab */}

      {/* ════════════════════════════════════════════════════════════════
          ADD / EDIT FARM MODAL
      ════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
          display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:1000, padding:16 }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={{ background:'var(--surface)', borderRadius:16, width:'100%', maxWidth:540,
            maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>

            <div style={{ padding:'20px 24px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ margin:0, fontSize:'1.25rem', fontWeight:700, color:'var(--text-main)' }}>
                🌾 {editFarm ? t.modalTitleEdit : t.modalTitleAdd}
              </h2>
              <button onClick={closeModal}
                style={{ background:'none', border:'none', cursor:'pointer',
                  fontSize:'1.4rem', color:'var(--text-muted)', lineHeight:1 }}>×</button>
            </div>

            <form onSubmit={handleSave} noValidate style={{ padding:'20px 24px 24px' }}>
              <FormField label={t.farmName} name="name" value={form.name}
                onChange={e => setForm(p => ({...p, name: e.target.value}))}
                onBlur={() => {}} error={formErrors.name} touched={!!formErrors.name}
                placeholder={t.namePlaceholder} required />

              <FormField label={t.farmLocation} name="location" value={form.location}
                onChange={e => setForm(p => ({...p, location: e.target.value}))}
                onBlur={() => {}} error={formErrors.location} touched={!!formErrors.location}
                placeholder={t.locationPlaceholder} required />

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <Sel label={t.cropType} value={form.cropType} isAm={isAm}
                  onChange={e => setForm(p => ({...p, cropType: e.target.value}))}
                  options={t.cropOptions} />
                <FormField label={t.areaSize} name="areaSize" type="number" min={0}
                  value={form.areaSize}
                  onChange={e => setForm(p => ({...p, areaSize: e.target.value}))}
                  onBlur={() => {}} error="" touched={false} placeholder="0.0" />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <Sel label={t.soilTypeLabel} value={form.soilType} isAm={isAm}
                  onChange={e => setForm(p => ({...p, soilType: e.target.value}))}
                  options={t.soilOptions} />
                <Sel label={t.irrigationMethodLabel} value={form.irrigationMethod} isAm={isAm}
                  onChange={e => setForm(p => ({...p, irrigationMethod: e.target.value}))}
                  options={t.irrigationOptions} />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <FormField label={t.gpsLat} name="gpsLat" type="number" value={form.gpsLat}
                  onChange={e => setForm(p => ({...p, gpsLat: e.target.value}))}
                  onBlur={() => {}} error="" touched={false} placeholder="e.g. 11.5742" />
                <FormField label={t.gpsLng} name="gpsLng" type="number" value={form.gpsLng}
                  onChange={e => setForm(p => ({...p, gpsLng: e.target.value}))}
                  onBlur={() => {}} error="" touched={false} placeholder="e.g. 37.3614" />
              </div>

              <div style={{ display:'flex', gap:12, marginTop:8 }}>
                <button type="button" className="btn btn-outline"
                  style={{ flex:1, padding:12 }} onClick={closeModal}>
                  {t.cancel}
                </button>
                <button type="submit" className="btn btn-primary"
                  style={{ flex:2, padding:12, opacity: saving ? 0.7 : 1 }}
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
}
