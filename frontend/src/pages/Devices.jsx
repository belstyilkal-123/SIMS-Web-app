import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import EmptyState from '../components/EmptyState';
import FormField from '../components/FormField';
import PermissionDeniedToast from '../components/common/PermissionDeniedToast';
import { API_URL, SOCKET_URL } from '../config/api';

const translations = {
  en: {
    pageTitle: 'Device Management',
    registerDevice: '+ Register Device',
    noDevices: 'No hardware devices registered.',
    hardwareViewTitle: 'Hardware View (ESP8266 Units)',
    attachedComponents: 'Attached Components & Real-Time Data',
    testingPanelTitle: 'Testing Panel (Hardware Debugger)',
    status: 'Status',
    signalStrength: 'Signal Strength',
    firmware: 'Firmware Version',
    lastSeen: 'Last Seen',
    online: 'ONLINE',
    offline: 'OFFLINE',
    testPumpOn: 'Test Pump ON',
    testPumpOff: 'Test Pump OFF',
    testBuzzerOn: 'Test Buzzer ON',
    testBuzzerOff: 'Test Buzzer OFF',
    soilMoistureSensor: 'Soil Moisture Sensor (A0)',
    dht11Sensor: 'DHT11 Climate Sensor (D5)',
    relayControl: 'Water Pump Relay (D3)',
    buzzerControl: 'Alarm Buzzer (D4)',
    waterLevelSensor: 'Water Level Sensor (D1)',
    testingInstructions: 'Directly trigger actuators to verify hardware wiring. Automated triggers are paused during manual testing.',
    deviceList: 'Device List',
    hardwareStats: 'Hardware Details',
    value: 'Value',
    connectedFarm: 'Connected Farm',
    lastSeen: 'Last Seen',
    loading: 'Loading devices...'
  },
  am: {
    pageTitle: 'የመሣሪያዎች አስተዳደር',
    registerDevice: '+ መሣሪያ ይመዝግቡ',
    noDevices: 'ምንም የተመዘገበ መሣሪያ የለም።',
    hardwareViewTitle: 'የሃርድዌር እይታ (ESP8266 ክፍሎች)',
    attachedComponents: 'የተገናኙ አካላት እና የቀጥታ ንባቦች',
    testingPanelTitle: 'የሙከራ ፓነል (ሃርድዌር ማረሚያ)',
    status: 'ሁኔታ',
    signalStrength: 'የግንኙነት ጥንካሬ (ሲግናል)',
    firmware: 'የፊርምዌር ስሪት',
    lastSeen: 'ለመጨረሻ ጊዜ የታየበት',
    online: 'ኦንላይን',
    offline: 'ኦፍላይን',
    testPumpOn: 'ፓምፕ ክፈት',
    testPumpOff: 'ፓምፕ ዝጋ',
    testBuzzerOn: 'ድምፅ ክፈት',
    testBuzzerOff: 'ድምፅ አጥፋ',
    soilMoistureSensor: 'የአፈር እርጥበት መለኪያ (A0)',
    dht11Sensor: 'DHT11 የአየር ሁኔታ መለኪያ (D5)',
    relayControl: 'የውሃ ፓምፕ ሪሌይ (D3)',
    buzzerControl: 'የአደጋ ድምፅ (D4)',
    waterLevelSensor: 'የውሃ ደረጃ መለኪያ (D1)',
    testingInstructions: 'የሃርድዌር ሽቦዎችን ለማረጋገጥ አንቀሳቃሾችን በቀጥታ ያነሳሱ። በእጅ በሚሞከርበት ጊዜ አውቶማቲክ ቀስቅሴዎች ይቆማሉ።',
    deviceList: 'የመሣሪያዎች ዝርዝር',
    hardwareStats: 'የሃርድዌር መረጃ',
    value: 'ዋጋ (ንባብ)',
    connectedFarm: 'የተገናኘበት እርሻ',
    lastSeen: 'ለመጨረሻ ጊዜ የታየበት',
    loading: 'መሣሪያዎችን በመጫን ላይ...'
  }
};

const Devices = () => {
  const { user } = useContext(AuthContext);
  const isAmharic = user?.language === 'am';
  const t = isAmharic ? translations.am : translations.en;

  // Role-based permissions:
  // - Owner: Full access (View, Add, Edit, Remove, Control Pump)
  // - Farmer: View ✅, Add ✅, Edit ✅, Remove 🟡 (own farm only), Control Pump ✅
  // - Admin: View 🟡, View Sensor Data 🟡
  // - Labour: View 🟡 (limited), View Sensor Data 🟡, Report Problem ✅
  const userRole = user?.assignedRole || user?.role;
  const isOwner = userRole === 'owner';
  const isFarmer = userRole === 'farmer';
  const isAdmin = userRole === 'admin';
  const isLabour = userRole === 'labor' || userRole === 'labour';
  
  const canAddDevice = isOwner || isFarmer || isAdmin;
  const canEditDevice = isOwner || isFarmer || isAdmin;
  const canDeleteDevice = isOwner || isFarmer || isAdmin; // Farmer: own farm devices only (checked in backend)
  const canControlPump = isOwner || isFarmer;
  const canViewSensorData = isOwner || isFarmer || isAdmin || isLabour;
  const canReportProblem = isOwner || isFarmer || isLabour;
  const isViewOnly = isAdmin || isLabour;

  // Permission denied toast state
  const [showPermDenied, setShowPermDenied] = useState(false);

  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [farms, setFarms] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editDevice, setEditDevice] = useState(null);
  const [form, setForm] = useState({ name: '', macAddress: '', farmId: '', firmwareVersion: '1.0.0' });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState({ type: '', text: '' });
  const navigate = useNavigate();

  // Selected device live readings
  const [readings, setReadings] = useState({
    moisture: 45,
    temp: 24,
    humidity: 60,
    ph: 6.8,
    tankLevel: 80,
    pump: 'OFF',
    buzzer: 'OFF'
  });

  const fetchDevices = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const response = await axios.get(`${API_URL}/api/devices`, config);
      setDevices(response.data);
      if (response.data.length > 0) {
        const onlineDevice = response.data.find(d => d.status === 'online');
        setSelectedDevice(onlineDevice || response.data[0]);
      } else {
        setSelectedDevice(null);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching devices:", error);
      setLoading(false);
    }
  };

  const fetchFarms = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const res = await axios.get(`${API_URL}/api/farms`, config);
      setFarms(res.data);
    } catch (e) { console.error(e); }
  };

  const openRegister = () => {
    setEditDevice(null);
    setForm({ name: '', macAddress: '', farmId: farms[0]?._id || '', firmwareVersion: '1.0.0' });
    setFormErrors({});
    setShowModal(true);
  };

  const openEdit = (device) => {
    setEditDevice(device);
    setForm({
      name: device.name,
      macAddress: device.macAddress,
      farmId: device.farmId?._id || device.farmId || '',
      firmwareVersion: device.firmwareVersion || '1.0.0'
    });
    setFormErrors({});
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditDevice(null); };

  const validateForm = () => {
    const errs = {};
    if (!form.name.trim())       errs.name       = isAmharic ? 'ስም ያስፈልጋል' : 'Device name is required';
    if (!form.macAddress.trim()) errs.macAddress = isAmharic ? 'MAC አድራሻ ያስፈልጋል' : 'MAC address is required';
    if (!form.farmId)            errs.farmId     = isAmharic ? 'እርሻ ይምረጡ' : 'Please assign a farm';
    return errs;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errs = validateForm();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setSaving(true);
    setBanner({ type: '', text: '' });
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const payload = {
        name: form.name.trim(),
        macAddress: form.macAddress.trim().toUpperCase(),
        farmId: form.farmId,
        firmwareVersion: form.firmwareVersion || '1.0.0'
      };
      if (editDevice) {
        await axios.put(`${API_URL}/api/devices/${editDevice._id}`, payload, config);
        setBanner({ type: 'success', text: isAmharic ? 'መሣሪያ ተዘምኗል!' : 'Device updated successfully!' });
      } else {
        await axios.post(`${API_URL}/api/devices`, payload, config);
        setBanner({ type: 'success', text: isAmharic ? 'መሣሪያ ተመዝግቧል!' : 'Device registered successfully!' });
      }
      closeModal();
      await fetchDevices();
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.error || (isAmharic ? 'ስህተት ተፈጥሯል' : 'Failed to save device') });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (deviceId) => {
    const msg = isAmharic ? 'ይህን መሣሪያ ለመሰረዝ እርግጠኛ ነዎት?' : 'Delete this device? This cannot be undone.';
    if (!window.confirm(msg)) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`${API_URL}/api/devices/${deviceId}`, config);
      setBanner({ type: 'success', text: isAmharic ? 'መሣሪያ ተሰርዟል።' : 'Device deleted.' });
      if (selectedDevice?._id === deviceId) setSelectedDevice(null);
      await fetchDevices();
    } catch (err) {
      setBanner({ type: 'error', text: err.response?.data?.error || 'Failed to delete device' });
    }
  };

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchDevices();
    fetchFarms();
  }, [user, navigate]);

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('sensor:update', (payload) => {
      if (selectedDevice && payload.deviceId === selectedDevice._id) {
        setReadings(prev => {
          const newReadings = { 
            ...prev, 
            pump: payload.pumpStatus || prev.pump,
            buzzer: payload.buzzerStatus || prev.buzzer 
          };
          payload.sensors.forEach(s => {
            if (s.type === 'moisture') newReadings.moisture = s.value;
            if (s.type === 'pH') newReadings.ph = s.value;
            if (s.type === 'temperature') newReadings.temp = s.value;
            if (s.type === 'humidity') newReadings.humidity = s.value;
            if (s.type === 'tankLevel') newReadings.tankLevel = s.value;
          });
          return newReadings;
        });
      }
    });

    // Listen for device status changes (online/offline)
    socket.on('device:status', (payload) => {
      if (selectedDevice && payload.deviceId === selectedDevice._id) {
        setSelectedDevice(prev => ({
          ...prev,
          status: payload.status,
          lastSeen: payload.lastSeen
        }));
      }
      
      // Update all devices in the list
      setDevices(prev => prev.map(d => 
        d._id === payload.deviceId ? { ...d, status: payload.status, lastSeen: payload.lastSeen } : d
      ));
    });

    return () => socket.disconnect();
  }, [selectedDevice]);

  const sendTestCommand = async (action) => {
    if (!selectedDevice || selectedDevice.status !== 'online') return;
    try {
      if (action.startsWith('PUMP')) {
        setReadings(prev => ({ ...prev, pump: action === 'PUMP_ON' ? 'ON' : 'OFF' }));
      } else if (action.startsWith('BUZZER')) {
        setReadings(prev => ({ ...prev, buzzer: action === 'BUZZER_ON' ? 'ON' : 'OFF' }));
      }

      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post(`${API_URL}/api/irrigation/manual`, {
        deviceId: selectedDevice._id,
        action: action
      }, config);
    } catch (error) {
      console.error("Error sending debugger command:", error);
      // Revert optimistic update on failure
      if (action.startsWith('PUMP')) {
        setReadings(prev => ({ ...prev, pump: action === 'PUMP_ON' ? 'OFF' : 'ON' }));
      } else if (action.startsWith('BUZZER')) {
        setReadings(prev => ({ ...prev, buzzer: action === 'BUZZER_ON' ? 'OFF' : 'ON' }));
      }
    }
  };

  const isSelectedOnline = selectedDevice && selectedDevice.status === 'online';

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'50vh' }}>
      <p style={{ color:'var(--text-muted)' }}>{t.loading}</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize:'1.75rem', fontWeight:800, color:'var(--text-main)', margin:0 }}>
            📡 {t.pageTitle}
          </h1>
          <p style={{ color:'var(--text-muted)', fontSize:'0.875rem', marginTop:4 }}>
            {isAmharic
              ? `${devices.length} መሣሪያ${devices.length !== 1 ? 'ዎች' : ''} ተመዝግቧ${devices.length !== 1 ? 'ል' : ''}`
              : `${devices.length} device${devices.length !== 1 ? 's' : ''} registered`}
          </p>
        </div>
        {/* Owner and Farmer can register devices */}
        {canAddDevice && (
          <button className="btn btn-primary" onClick={openRegister}>
            {t.registerDevice}
          </button>
        )}
      </div>

      {/* Banner */}
      {banner.text && (
        <div style={{
          padding:'11px 16px', borderRadius:8, marginBottom:16, fontWeight:500, fontSize:'0.875rem',
          display:'flex', alignItems:'center', gap:8,
          background: banner.type === 'success' ? '#ecfdf5' : '#fee2e2',
          border: `1px solid ${banner.type === 'success' ? '#a7f3d0' : '#fca5a5'}`,
          color: banner.type === 'success' ? '#047857' : '#b91c1c',
        }}>
          {banner.type === 'success' ? '✅' : '❌'} {banner.text}
          <button onClick={() => setBanner({ type:'', text:'' })}
            style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', fontSize:'1rem', color:'inherit' }}>×</button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:24 }}>

        {/* ── Left: Device list ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <p style={{ fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase',
            letterSpacing:'0.08em', color:'var(--text-muted)', marginBottom:4 }}>
            {t.deviceList}
          </p>

          {devices.length === 0 ? (
            <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)' }}>
              <EmptyState type="device" isAmharic={isAmharic} />
            </div>
          ) : (
            devices.map(device => (
              <div key={device._id} onClick={() => setSelectedDevice(device)}
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  border: selectedDevice?._id === device._id
                    ? '2px solid var(--primary)'
                    : '1px solid var(--border)',
                  boxShadow: selectedDevice?._id === device._id
                    ? 'var(--shadow-lg)' : 'var(--shadow-card)',
                  transition: 'all 0.2s',
                  borderLeft: `4px solid ${device.status === 'online' ? '#15803d' : '#ef4444'}`,
                }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                  <span style={{ fontWeight:700, fontSize:'0.92rem', color:'var(--text-main)' }}>
                    {device.name}
                  </span>
                  <span style={{
                    padding:'2px 8px', borderRadius:20, fontSize:'0.68rem', fontWeight:700,
                    background: device.status === 'online' ? '#dcfce7' : '#fee2e2',
                    color: device.status === 'online' ? '#15803d' : '#b91c1c',
                  }}>
                    {device.status === 'online' ? t.online : t.offline}
                  </span>
                </div>
                <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontFamily:'monospace', marginBottom:6 }}>
                  {device.macAddress}
                </p>
                <div style={{ fontSize:'0.75rem', display:'flex', justifyContent:'space-between', color:'var(--text-muted)' }}>
                  <span>🌾 {device.farmId ? device.farmId.name : (isAmharic ? 'ያልተመደበ' : 'Unassigned')}</span>
                </div>
                {device.lastSeen && (
                  <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', marginTop:6 }}>
                    🕐 {new Date(device.lastSeen).toLocaleString()}
                  </div>
                )}
                {/* Edit / Delete — Owner and Farmer */}
                {(canEditDevice || canDeleteDevice) && (
                  <div style={{ display:'flex', gap:6, marginTop:10 }}>
                    {canEditDevice && (
                      <button
                        className="btn btn-outline"
                        style={{ flex:1, padding:'5px 8px', fontSize:'0.75rem' }}
                        onClick={e => { e.stopPropagation(); openEdit(device); }}>
                        ✏️ {isAmharic ? 'አስተካክል' : 'Edit'}
                      </button>
                    )}
                    {canDeleteDevice && (
                      <button
                        style={{ padding:'5px 10px', fontSize:'0.75rem', borderRadius:8,
                          background:'#fee2e2', color:'#b91c1c', border:'1px solid #fca5a5',
                          cursor:'pointer', fontWeight:600 }}
                        onClick={e => { e.stopPropagation(); handleDelete(device._id); }}>
                        🗑️
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* ── Right: Detail panels ── */}
        {selectedDevice && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Hardware stats */}
            <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)', padding:'20px 22px', boxShadow:'var(--shadow-card)' }}>
              <h3 style={{ fontSize:'0.8rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:16 }}>
                ⚙️ {t.hardwareViewTitle}
              </h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                {[
                  { label: t.status, value: selectedDevice.status === 'online' ? t.online : t.offline,
                    color: selectedDevice.status === 'online' ? '#15803d' : '#ef4444',
                    bg: selectedDevice.status === 'online' ? '#dcfce7' : '#fee2e2' },
                  { label: t.signalStrength, value: selectedDevice.signalStrength ? `${selectedDevice.signalStrength} dBm` : '-65 dBm',
                    color: '#2563eb', bg: '#dbeafe' },
                  { label: t.firmware, value: `v${selectedDevice.firmwareVersion || '1.0.4'}`,
                    color: '#92400e', bg: '#fef3c7' },
                  { label: isAmharic ? 'ባትሪ' : 'Battery',
                    value: selectedDevice.batteryLevel ? `${selectedDevice.batteryLevel}%` : '92%',
                    color: (selectedDevice.batteryLevel || 100) < 25 ? '#b91c1c' : '#15803d',
                    bg: (selectedDevice.batteryLevel || 100) < 25 ? '#fee2e2' : '#dcfce7' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius:10, padding:'12px', textAlign:'center' }}>
                    <div style={{ fontSize:'0.68rem', color: s.color, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{s.label}</div>
                    <strong style={{ fontSize:'0.95rem', color: s.color }}>{s.value}</strong>
                  </div>
                ))}
              </div>
              {selectedDevice.lastSeen && (
                <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:10, textAlign:'right' }}>
                  🕐 {t.lastSeen}: {new Date(selectedDevice.lastSeen).toLocaleString()}
                </p>
              )}
            </div>

            {/* Sensor readings */}
            <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)', padding:'20px 22px', boxShadow:'var(--shadow-card)' }}>
              <h3 style={{ fontSize:'0.8rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:16 }}>
                📊 {t.attachedComponents}
              </h3>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { icon:'🪴', label: t.soilMoistureSensor,
                    value: isSelectedOnline ? `${readings.moisture}%` : '--',
                    valueColor: !isSelectedOnline ? 'var(--text-muted)' : readings.moisture < 30 ? 'var(--danger)' : '#15803d' },
                  { icon:'🌡️', label: t.dht11Sensor,
                    value: isSelectedOnline ? `${readings.temp}°C / ${readings.humidity}% RH` : '--',
                    valueColor: isSelectedOnline ? 'var(--text-main)' : 'var(--text-muted)' },
                  { icon:'🧪', label: isAmharic ? 'pH ሴንሰር (D2)' : 'pH Sensor (D2)',
                    value: isSelectedOnline ? `${readings.ph} pH` : '-- pH',
                    valueColor: isSelectedOnline ? '#15803d' : 'var(--text-muted)' },
                  { icon:'💧', label: t.waterLevelSensor,
                    value: isSelectedOnline ? `${readings.tankLevel}%` : '--',
                    valueColor: !isSelectedOnline ? 'var(--text-muted)' : readings.tankLevel < 20 ? 'var(--danger)' : '#2563eb' },
                  { icon:'⚡', label: t.relayControl,
                    value: isSelectedOnline ? readings.pump : '--',
                    valueColor: !isSelectedOnline ? 'var(--text-muted)' : readings.pump === 'ON' ? '#15803d' : 'var(--text-muted)' },
                  { icon:'🚨', label: t.buzzerControl,
                    value: isSelectedOnline ? readings.buzzer : '--',
                    valueColor: !isSelectedOnline ? 'var(--text-muted)' : readings.buzzer === 'ON' ? '#ef4444' : 'var(--text-muted)' },
                ].map(s => (
                  <div key={s.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'10px 14px', background:'var(--surface-hover)', borderRadius:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:'1.15rem' }}>{s.icon}</span>
                      <span style={{ fontSize:'0.85rem', fontWeight:600, color:'var(--text-main)' }}>{s.label}</span>
                    </div>
                    <strong style={{ fontSize:'0.9rem', color: s.valueColor }}>{s.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Testing panel */}
            <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)',
              padding:'20px 22px', boxShadow:'var(--shadow-card)', opacity: isSelectedOnline ? 1 : 0.65 }}>
              <h3 style={{ fontSize:'0.8rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:12 }}>
                🛠️ {t.testingPanelTitle}
              </h3>

              {!isSelectedOnline && canControlPump && (
                <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:10,
                  padding:'12px 16px', marginBottom:14, display:'flex', gap:10, alignItems:'flex-start' }}>
                  <span style={{ fontSize:'1.3rem' }}>⚠️</span>
                  <div>
                    <strong style={{ color:'#b91c1c', fontSize:'0.875rem', display:'block', marginBottom:2 }}>
                      {isAmharic ? 'መሣሪያ ኦፍላይን ነው' : 'Device Offline'}
                    </strong>
                    <span style={{ color:'#b91c1c', fontSize:'0.8rem' }}>
                      {isAmharic ? 'ሙከራ ለማድረግ ኦንላይን መሆን አለበት።' : 'Device must be online to test hardware.'}
                    </span>
                  </div>
                </div>
              )}

              {canControlPump ? (
                <>
                  <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:16, lineHeight:1.5 }}>
                    {t.testingInstructions}
                  </p>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      <button className="btn btn-primary"
                        onClick={() => sendTestCommand('PUMP_ON')}
                        disabled={!isSelectedOnline || readings.pump === 'ON'}
                        style={{ width:'100%', padding:'11px', fontSize:'0.875rem' }}>
                        💦 {t.testPumpOn}
                      </button>
                      <button className="btn btn-danger"
                        onClick={() => sendTestCommand('PUMP_OFF')}
                        disabled={!isSelectedOnline || readings.pump === 'OFF'}
                        style={{ width:'100%', padding:'11px', fontSize:'0.875rem' }}>
                        🛑 {t.testPumpOff}
                      </button>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      <button className="btn btn-secondary"
                        onClick={() => sendTestCommand('BUZZER_ON')}
                        disabled={!isSelectedOnline || readings.buzzer === 'ON'}
                        style={{ width:'100%', padding:'11px', fontSize:'0.875rem' }}>
                        🔊 {t.testBuzzerOn}
                      </button>
                      <button className="btn btn-danger"
                        onClick={() => sendTestCommand('BUZZER_OFF')}
                        disabled={!isSelectedOnline || readings.buzzer === 'OFF'}
                        style={{ width:'100%', padding:'11px', fontSize:'0.875rem' }}>
                        🔇 {t.testBuzzerOff}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* View-only notice for Admin/Labour */
                <div 
                  onClick={() => setShowPermDenied(true)}
                  style={{ 
                    padding:'16px', borderRadius:10, background:'#f1f5f9',
                    textAlign:'center', fontSize:'0.85rem', color:'var(--text-muted)', fontWeight:500,
                    border:'1px solid var(--border)', cursor:'pointer',
                    transition:'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e2e8f0';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}>
                  👁️ Device control is restricted to Owners and Farmers.<br/>
                  <span style={{ fontSize:'0.78rem' }}>You can monitor device status but not control hardware.</span>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ── Register / Edit Device Modal ── */}
      {showModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
          display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:1000, padding:16
        }} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>

          <div style={{
            background:'var(--surface)', borderRadius:16, width:'100%', maxWidth:460,
            boxShadow:'0 20px 60px rgba(0,0,0,0.35)', overflow:'hidden'
          }}>
            {/* Modal header */}
            <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--border)',
              display:'flex', justifyContent:'space-between', alignItems:'center',
              background:'var(--surface)' }}>
              <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:700, color:'var(--text-main)' }}>
                📡 {editDevice
                  ? (isAmharic ? 'መሣሪያ አስተካክል' : 'Edit Device')
                  : (isAmharic ? 'አዲስ መሣሪያ ምዝገባ' : 'Register New Device')}
              </h2>
              <button onClick={closeModal}
                style={{ background:'none', border:'none', cursor:'pointer',
                  fontSize:'1.4rem', color:'var(--text-muted)', lineHeight:1 }}>×</button>
            </div>

            <form onSubmit={handleSave} noValidate style={{ padding:'22px' }}>

              {/* Device Name */}
              <FormField
                label={isAmharic ? 'የመሣሪያ ስም' : 'Device Name'}
                name="name" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                onBlur={() => {}}
                error={formErrors.name} touched={!!formErrors.name}
                placeholder={isAmharic ? 'ለምሳሌ: ሜዳ ሀ ሴንሰር' : 'e.g. Field A Sensor Unit'}
                required autoFocus />

              {/* MAC Address */}
              <FormField
                label={isAmharic ? 'MAC አድራሻ' : 'MAC Address'}
                name="macAddress" value={form.macAddress}
                onChange={e => setForm(p => ({ ...p, macAddress: e.target.value }))}
                onBlur={() => {}}
                error={formErrors.macAddress} touched={!!formErrors.macAddress}
                placeholder="AA:BB:CC:DD:EE:01"
                hint={isAmharic ? 'ከESP8266 ቺፕ ወይም ከ Serial Monitor ያግኙ' : 'Found on the ESP8266 chip or Arduino Serial Monitor'}
                required />

              {/* Assign to Farm */}
              <div className="fv-group">
                <label className="fv-label">
                  {isAmharic ? 'ለእርሻ ይመድቡ' : 'Assign to Farm'} <span className="fv-required">*</span>
                </label>
                <select value={form.farmId}
                  onChange={e => setForm(p => ({ ...p, farmId: e.target.value }))}
                  style={{ width:'100%', padding:'10px 14px', borderRadius:8,
                    border:`1.5px solid ${formErrors.farmId ? '#ef4444' : 'var(--border)'}`,
                    background:'var(--surface)', color:'var(--text-main)',
                    fontSize:'0.95rem', fontFamily:'inherit', cursor:'pointer', outline:'none' }}>
                  <option value="">{isAmharic ? '-- እርሻ ይምረጡ --' : '-- Select a Farm --'}</option>
                  {farms.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                </select>
                {formErrors.farmId && (
                  <p className="fv-error"><span>⚠</span> {formErrors.farmId}</p>
                )}
                {farms.length === 0 && (
                  <p className="fv-hint" style={{ color:'#b45309' }}>
                    ⚠ {isAmharic ? 'ምንም እርሻ አልተመዘገበም። መጀመሪያ እርሻ ያክሉ።' : 'No farms registered yet. Add a farm first.'}
                  </p>
                )}
              </div>

              {/* Firmware Version */}
              <FormField
                label={isAmharic ? 'የፊርምዌር ስሪት (አማራጭ)' : 'Firmware Version (optional)'}
                name="firmwareVersion" value={form.firmwareVersion}
                onChange={e => setForm(p => ({ ...p, firmwareVersion: e.target.value }))}
                onBlur={() => {}}
                error="" touched={false}
                placeholder="1.0.4" />

              {/* Info box */}
              <div style={{ background:'#dbeafe', border:'1px solid #93c5fd', borderRadius:8,
                padding:'10px 14px', marginBottom:18, fontSize:'0.8rem', color:'#1e40af', lineHeight:1.6 }}>
                💡 {isAmharic
                  ? 'MAC አድራሻውን ከESP8266 ስኬቱ ጋር ያዛምዱ: DEVICE_ID ተለዋዋጭ ተጠቀም'
                  : 'Match the MAC address with the DEVICE_ID variable in the ESP8266 sketch'}
              </div>

              {/* Buttons */}
              <div style={{ display:'flex', gap:12 }}>
                <button type="button" className="btn btn-outline"
                  style={{ flex:1, padding:'11px' }} onClick={closeModal}>
                  {isAmharic ? 'ሰርዝ' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary"
                  style={{ flex:2, padding:'11px', opacity: saving ? 0.7 : 1 }}
                  disabled={saving}>
                  {saving
                    ? (isAmharic ? 'በማስቀመጥ ላይ...' : 'Saving...')
                    : `✅ ${editDevice ? (isAmharic ? 'አዘምን' : 'Update Device') : (isAmharic ? 'መሣሪያ ምዝገባ' : 'Register Device')}`}
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
        isAmharic={isAmharic} 
      />
    </div>
  );
};

export default Devices;


