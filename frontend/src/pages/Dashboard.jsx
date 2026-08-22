import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { LanguageContext } from '../context/LanguageContext';
import { io } from 'socket.io-client';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import GISMap from '../components/GISMap';
import EmptyState from '../components/EmptyState';
import { API_URL, SOCKET_URL } from '../config/api';
import './Dashboard.css';

const translations = {
  en: {
    dashboardTitle: 'Advanced Dashboard',
    farmSelector: 'Farm Field Selector',
    soilMoisture: 'Soil Moisture (Root Zone)',
    waterTank: 'Water Tank Level',
    climateInfo: 'Climate & Soil pH',
    npkInfo: 'Soil Nutrients (NPK)',
    nitrogen: 'Nitrogen (N)',
    phosphorus: 'Phosphorus (P)',
    potassium: 'Potassium (K)',
    phLabel: 'Soil pH Level',
    phStatus: 'Excellent',
    alertLogTitle: 'Alerts & Local Buzzer Log',
    buzzerStatus: 'Local Buzzer Status',
    buzzerActive: 'ACTIVE',
    buzzerMuted: 'MUTED',
    muteBuzzer: 'Mute Buzzer',
    unmuteBuzzer: 'Unmute Buzzer',
    testBuzzer: 'Test Buzzer',
    weatherTitle: 'Bahir Dar Weather',
    temperature: 'Temperature',
    humidity: 'Humidity',
    waterUsage: 'Water Usage',
    todayUsage: "Today's Usage",
    lastIrrigation: 'Last Irrigation',
    systemStatusTitle: 'System & Connectivity',
    sensorHealth: 'Sensor Health',
    espStatus: 'ESP8266 Unit',
    manualControlTitle: 'Manual Pump Control',
    overrideText: 'Override automated irrigation thresholds',
    startPump: '💧 START PUMP',
    stopPump: '🛑 STOP PUMP',
    pumpRunning: 'Pump is currently: ON',
    pumpStopped: 'Pump is currently: OFF',
    trendsTitle: 'pH & Temperature Trends',
    weatherCondition: 'Partly Cloudy',
    field: 'Field',
    noDeviceTitle: 'No Device Connected',
    noDeviceMsg: 'No ESP8266 device is currently online for this farm. Controls are disabled until a device connects.',
    deviceOffline: 'OFFLINE',
    deviceOnline: 'ONLINE',
    offlineBanner: 'Device is offline — showing last known readings. Controls disabled.',
    lastSeen: 'Last seen',
    noFarmsMsg: 'No farms registered. Please add a farm first.',
    loading: 'Loading dashboard...'
  },
  am: {
    dashboardTitle: 'የላቀ ዳሽቦርድ',
    farmSelector: 'የእርሻ ቦታ መምረጫ',
    soilMoisture: 'የአፈር እርጥበት (ስር ዞን)',
    waterTank: 'የውሃ ታንከር ደረጃ',
    climateInfo: 'አየር ንብረት እና የአፈር ፒኤች (pH)',
    npkInfo: 'የአፈር ንጥረ ነገሮች (NPK)',
    nitrogen: 'ናይትሮጅን (N)',
    phosphorus: 'ፎስፈረስ (P)',
    potassium: 'ፖታሲየም (K)',
    phLabel: 'የአፈር ፒኤች ደረጃ',
    phStatus: 'በጣም ጥሩ',
    alertLogTitle: 'የማሳወቂያዎች እና የድምፅ መዝገብ',
    buzzerStatus: 'የአካባቢው ድምፅ (Buzzer) ሁኔታ',
    buzzerActive: 'ገባሪ',
    buzzerMuted: 'ድምፅ አልባ',
    muteBuzzer: 'ድምፅ አጥፋ',
    unmuteBuzzer: 'ድምፅ ክፈት',
    testBuzzer: 'ድምፅ ሞክር',
    weatherTitle: 'የባህር ዳር አየር ሁኔታ',
    temperature: 'ሙቀት',
    humidity: 'እርጥበት',
    waterUsage: 'የውሃ አጠቃቀም',
    todayUsage: 'የዛሬ አጠቃቀም',
    lastIrrigation: 'የመጨረሻ መስኖ ሰዓት',
    systemStatusTitle: 'የስርዓት ግንኙነት',
    sensorHealth: 'የሴንሰሮች ጤና',
    espStatus: 'የESP8266 መሣሪያ',
    manualControlTitle: 'የእጅ መስኖ ቁጥጥር',
    overrideText: 'የአውቶማቲክ መስኖ ገደቦችን ይሽሩ',
    startPump: '💧 ፓምፕ አስጀምር',
    stopPump: '🛑 ፓምፕ አቁም',
    pumpRunning: 'ፓምፕ በአሁን ሰዓት: ክፍት ነው',
    pumpStopped: 'ፓምፕ በአሁን ሰዓት: ዝግ ነው',
    trendsTitle: 'የpH እና የሙቀት ሁኔታዎች',
    weatherCondition: 'ከፊል ደመናማ',
    field: 'እርሻ',
    noDeviceTitle: 'ምንም መሣሪያ አልተገናኘም',
    noDeviceMsg: 'ለዚህ እርሻ በአሁን ሰዓት ምንም ESP8266 መሣሪያ አልተገናኘም። መሣሪያ እስኪገናኝ ቁጥጥሮቹ ተዘግተዋል።',
    deviceOffline: 'ኦፍላይን',
    deviceOnline: 'ኦንላይን',
    offlineBanner: 'መሣሪያ ኦፍላይን ነው — የመጨረሻ ንባቦች ይታያሉ። ቁጥጥሮቹ ተዘግተዋል።',
    lastSeen: 'ለመጨረሻ ጊዜ የታየበት',
    noFarmsMsg: 'ምንም እርሻ አልተመዘገበም። እባክዎ መጀመሪያ እርሻ ያክሉ።',
    loading: 'ዳሽቦርድ በመጫን ላይ...'
  }
};

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const { isAmharic } = useContext(LanguageContext);
  const t = isAmharic ? translations.am : translations.en;

  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [devices, setDevices] = useState([]);
  const [activeDevice, setActiveDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weatherData, setWeatherData] = useState(null);

  const [data, setData] = useState({
    soilMoisture: null,
    temperature: null,
    humidity: null,
    tankLevel: null,
    soilPhLevel: null,
    nitrogen: null,
    phosphorus: null,
    potassium: null,
    todayWaterUsage: null,
    lastIrrigationTime: null,
    pumpStatus: 'OFF',
    buzzerStatus: 'OFF'
  });

  const [phData] = useState([
    { name: '00:00', ph: 6.2, temp: 18 },
    { name: '04:00', ph: 6.3, temp: 17 },
    { name: '08:00', ph: 6.5, temp: 22 },
    { name: '12:00', ph: 6.8, temp: 28 },
    { name: '16:00', ph: 6.6, temp: 26 },
    { name: '20:00', ph: 6.4, temp: 21 },
  ]);

  const [alerts, setAlerts] = useState([]);

  const formatDate = (date) => {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    const fetchFarms = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const res = await axios.get(`${API_URL}/api/farms`, config);
        setFarms(res.data);
        if (res.data.length > 0) {
          setSelectedFarm(res.data[0]);
        }
        setLoading(false);
      } catch (err) {
        console.error("Error fetching farms:", err);
        setLoading(false);
      }
    };
    
    const fetchWeather = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        // Pass the default lat/lon for now, or use geolocation in the future
        const res = await axios.get(`${API_URL}/api/weather?lat=11.5742&lon=37.3614`, config);
        setWeatherData(res.data);
      } catch (err) {
        console.error("Error fetching weather:", err);
      }
    };

    fetchFarms();
    fetchWeather();
  }, [user]);

  useEffect(() => {
    if (!selectedFarm) return;
    const fetchDevices = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const res = await axios.get(`${API_URL}/api/devices?farmId=${selectedFarm._id}`, config);
        setDevices(res.data);
        if (res.data.length > 0) {
          // Select first online device, or first device if all offline
          const onlineDevice = res.data.find(d => d.status === 'online');
          setActiveDevice(onlineDevice || res.data[0]);
        } else {
          setActiveDevice(null);
        }
      } catch (err) {
        console.error("Error fetching devices:", err);
      }
    };

    const fetchDashboardSummary = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const res = await axios.get(`${API_URL}/api/dashboard/summary?farmId=${selectedFarm._id}`, config);
        const d = res.data;
        setData(prev => ({
          ...prev,
          soilMoisture:      d.soilMoisture      ?? prev.soilMoisture,
          temperature:       d.temperature       ?? prev.temperature,
          humidity:          d.humidity          ?? prev.humidity,
          tankLevel:         d.tankLevel         ?? prev.tankLevel,
          soilPhLevel:       d.soilPhLevel       ?? prev.soilPhLevel,
          pumpStatus:        d.pumpStatus        ?? prev.pumpStatus,
          todayWaterUsage:   d.todayWaterUsage   ?? prev.todayWaterUsage,
          lastIrrigationTime: d.lastIrrigationTime
            ? new Date(d.lastIrrigationTime).toLocaleString()
            : prev.lastIrrigationTime,
        }));
      } catch (err) {
        console.error("Error fetching dashboard summary:", err);
      }
    };

    fetchDevices();
    fetchDashboardSummary();
  }, [selectedFarm, user]);

  useEffect(() => {
    const socket = io(SOCKET_URL);

    // Listen for sensor data updates
    socket.on('sensor:update', (payload) => {
      if (activeDevice && payload.deviceId === activeDevice._id) {
        setData(prev => {
          const newData = { 
            ...prev, 
            pumpStatus: payload.pumpStatus || prev.pumpStatus,
            buzzerStatus: payload.buzzerStatus || prev.buzzerStatus 
          };
          payload.sensors.forEach(s => {
            if (s.type === 'moisture') newData.soilMoisture = s.value;
            if (s.type === 'pH') newData.soilPhLevel = s.value;
            if (s.type === 'temperature') newData.temperature = s.value;
            if (s.type === 'humidity') newData.humidity = s.value;
            if (s.type === 'tankLevel') newData.tankLevel = s.value;
            if (s.type === 'nitrogen') newData.nitrogen = s.value;
            if (s.type === 'phosphorus') newData.phosphorus = s.value;
            if (s.type === 'potassium') newData.potassium = s.value;
          });
          return newData;
        });
      }
    });

    // Listen for device status changes (online/offline)
    socket.on('device:status', (payload) => {
      if (activeDevice && payload.deviceId === activeDevice._id) {
        setActiveDevice(prev => ({
          ...prev,
          status: payload.status,
          lastSeen: payload.lastSeen
        }));
        
        // Update devices list
        setDevices(prev => prev.map(d => 
          d._id === payload.deviceId ? { ...d, status: payload.status, lastSeen: payload.lastSeen } : d
        ));
      }
    });

    socket.on('system:alert', (alert) => {
      setAlerts(prev => [
        { type: alert.type || 'warning', message: alert.message, timestamp: new Date() },
        ...prev
      ].slice(0, 5));
    });

    return () => socket.disconnect();
  }, [activeDevice]);

  const handleTogglePump = async () => {
    if (!activeDevice || activeDevice.status !== 'online') return;
    const nextAction = data.pumpStatus === 'ON' ? 'PUMP_OFF' : 'PUMP_ON';
    
    // Optimistic UI update
    setData(prev => ({ ...prev, pumpStatus: nextAction === 'PUMP_ON' ? 'ON' : 'OFF' }));

    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post(`${API_URL}/api/irrigation/manual`, {
        deviceId: activeDevice._id,
        action: nextAction
      }, config);
    } catch (err) {
      console.error("Failed to toggle pump:", err);
      // Revert on error
      setData(prev => ({ ...prev, pumpStatus: nextAction === 'PUMP_ON' ? 'OFF' : 'ON' }));
    }
  };

  const handleToggleBuzzer = async () => {
    if (!activeDevice || activeDevice.status !== 'online') return;
    const nextAction = data.buzzerStatus === 'ON' ? 'BUZZER_OFF' : 'BUZZER_ON';

    // Optimistic UI update
    setData(prev => ({ ...prev, buzzerStatus: nextAction === 'BUZZER_ON' ? 'ON' : 'OFF' }));

    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post(`${API_URL}/api/irrigation/manual`, {
        deviceId: activeDevice._id,
        action: nextAction
      }, config);
    } catch (err) {
      console.error("Failed to toggle buzzer:", err);
      // Revert on error
      setData(prev => ({ ...prev, buzzerStatus: nextAction === 'BUZZER_ON' ? 'OFF' : 'ON' }));
    }
  };

  const isDeviceOnline = activeDevice && activeDevice.status === 'online';
  // Option A palette — Forest Green primary, True Blue for water/action
  const COLORS      = ['#15803D', '#E2E8E2'];
  const TANK_COLORS = ['#2563EB', '#E2E8E2'];

  if (loading) return <div className="container text-center mt-8">{t.loading}</div>;

  if (farms.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <EmptyState type="farm" isAmharic={isAmharic} />
      </div>
    );
  }

  return (
    <div className="dashboard-grid-v2">
      
      {/* Farm Field Selector Row */}
      <div className="card" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '1.5rem' }}>🌾</span>
          <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '1.1rem' }}>{t.farmSelector}</span>
        </div>
        <select 
          className="form-input" 
          style={{ width: '250px', cursor: 'pointer' }}
          value={selectedFarm?._id || ''}
          onChange={(e) => {
            const farm = farms.find(f => f._id === e.target.value);
            if (farm) setSelectedFarm(farm);
          }}
        >
          {farms.map(f => (
            <option key={f._id} value={f._id}>{f.name}</option>
          ))}
        </select>
      </div>

      {/* Offline Device Warning Banner */}
      {!isDeviceOnline && activeDevice && (
        <div className="offline-banner" style={{ gridColumn: '1 / -1' }}>
          <span className="offline-banner-icon">⚠️</span>
          <div>
            <div className="offline-banner-title">{t.offlineBanner}</div>
            <div className="offline-banner-sub">
              {t.lastSeen}: {activeDevice.lastSeen ? new Date(activeDevice.lastSeen).toLocaleString() : 'Never'}
            </div>
          </div>
        </div>
      )}

      {/* No Device Banner */}
      {!activeDevice && (
        <div style={{ gridColumn: '1 / -1' }}>
          <EmptyState type="device" isAmharic={isAmharic} />
        </div>
      )}

      {/* Panel 1 Card 1: Climate & Soil pH */}
      <div className="card summary-card">
        <h3>{t.climateInfo}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t.temperature}:</span>
            <strong style={{ fontSize: '1.2rem', color: isDeviceOnline ? 'inherit' : 'var(--text-muted)' }}>
              {isDeviceOnline ? `${data.temperature}°C` : '--'}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t.humidity}:</span>
            <strong style={{ fontSize: '1.2rem', color: isDeviceOnline ? 'inherit' : 'var(--text-muted)' }}>
              {isDeviceOnline ? `${data.humidity}%` : '--'}
            </strong>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>{t.phLabel}:</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: isDeviceOnline ? 'var(--primary)' : 'var(--text-muted)', marginTop: '2px' }}>
                {isDeviceOnline ? `${data.soilPhLevel} pH` : '-- pH'}
              </div>
            </div>
            {isDeviceOnline && (
              <div style={{ background: '#ecfdf5', color: '#047857', padding: '5px 12px', borderRadius: '20px', fontWeight: '600', fontSize: '0.85rem' }}>
                {t.phStatus}
              </div>
            )}
          </div>
        </div>
      </div>



      {/* Panel 1 Card 2: Alerts & Local Buzzer Log */}
      <div className="card summary-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <h3>{t.alertLogTitle}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', maxHeight: '100px', overflowY: 'auto' }}>
            {alerts.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: a.type === 'alarm' ? 'var(--danger)' : 'var(--accent)', background: a.type === 'alarm' ? '#fee2e2' : '#fef3c7', padding: '6px 10px', borderRadius: '5px', fontWeight: '500' }}>
                ⚠️ {a.message}
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.buzzerStatus}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
              <span className={`status-indicator ${data.buzzerStatus === 'ON' ? 'status-online' : 'status-offline'}`}></span>
              <strong style={{ fontSize: '0.9rem', color: data.buzzerStatus === 'ON' ? 'var(--primary)' : 'var(--danger)' }}>
                {data.buzzerStatus === 'ON' ? t.buzzerActive : t.buzzerMuted}
              </strong>
            </div>
          </div>
          <button 
            className="btn btn-outline" 
            style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '8px' }}
            onClick={handleToggleBuzzer}
            disabled={!isDeviceOnline}
          >
            🔊 {data.buzzerStatus === 'ON' ? t.muteBuzzer : t.testBuzzer}
          </button>
        </div>
      </div>

      {/* Panel 1 Card 3: Weather Widget */}
      <div className="card summary-card">
        <h3>{t.weatherTitle}</h3>

        {weatherData?.unavailable ? (
          /* Weather API unreachable */
          <div style={{ marginTop: 14, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem' }}>📡</div>
            <p style={{ fontSize: '0.82rem', margin: '8px 0 0' }}>
              {isAmharic ? 'የአየር ሁኔታ ውሂብ አሁን አልተገኘም' : 'Weather data unavailable'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
              <div>
                <div style={{ fontSize: '2.5rem', margin: '0' }}>
                  {weatherData?.emoji || '⛅'}
                </div>
                <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-main)', marginTop: '5px' }}>
                  {weatherData ? weatherData.condition : '...'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Bahir Dar, ET
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  {weatherData ? `${weatherData.temp}°C` : '--'}
                </div>
                {weatherData?.humidity != null && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    💧 {weatherData.humidity}% {isAmharic ? 'እርጥበት' : 'Humidity'}
                  </div>
                )}
                <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600', marginTop: '4px' }}>
                  📅 {formatDate(new Date())}
                </div>
              </div>
            </div>

            {/* Rain recommendation */}
            {weatherData?.recommendPostpone && (
              <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#92400e',
                background: '#fffbeb', padding: '7px 10px', borderRadius: '7px',
                fontWeight: '600', border: '1px solid #fcd34d' }}>
                🌧️ {weatherData.rainProbability}% {isAmharic ? 'ዝናብ ሊዘንብ ይችላል። መስኖ ማዘግየት ይሻላል።' : 'rain expected. Consider delaying irrigation.'}
              </div>
            )}

            {/* 3-day mini forecast */}
            {weatherData?.forecast7?.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
                {weatherData.forecast7.slice(1, 4).map((day, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', background: 'var(--surface-hover)',
                    borderRadius: 8, padding: '6px 4px', fontSize: '0.72rem' }}>
                    <div style={{ marginBottom: 2, color: 'var(--text-muted)' }}>
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div style={{ fontSize: '1.1rem' }}>{day.emoji}</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{day.tempMax}°</div>
                    {day.rainChance > 0 && (
                      <div style={{ color: '#2563eb', fontSize: '0.68rem' }}>{day.rainChance}%</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Soil Moisture Dial */}
      <div className="card" style={{ gridColumn: 'span 1' }}>
        <h3>{t.soilMoisture}</h3>
        <div style={{ position: 'relative', height: '180px', display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie 
                data={[{value: data.soilMoisture ?? 0}, {value: 100 - (data.soilMoisture ?? 0)}]} 
                innerRadius={55} outerRadius={70} dataKey="value" startAngle={180} endAngle={0}
              >
                <Cell fill={!isDeviceOnline ? '#CBD5E1' : ((data.soilMoisture ?? 100) < 30 ? 'var(--danger)' : COLORS[0])} />
                <Cell fill={COLORS[1]} />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', top: '65%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
            <span style={{ fontSize: '2rem', fontWeight: '800', color: !isDeviceOnline ? 'var(--text-muted)' : ((data.soilMoisture ?? 100) < 30 ? 'var(--danger)' : 'var(--primary)') }}>
              {isDeviceOnline && data.soilMoisture !== null ? `${data.soilMoisture}%` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Water Tank Dial */}
      <div className="card" style={{ gridColumn: 'span 1' }}>
        <h3>{t.waterTank}</h3>
        <div style={{ position: 'relative', height: '180px', display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie 
                data={[{value: data.tankLevel ?? 0}, {value: 100 - (data.tankLevel ?? 0)}]} 
                innerRadius={55} outerRadius={70} dataKey="value" startAngle={90} endAngle={-270}
              >
                <Cell fill={!isDeviceOnline ? '#CBD5E1' : ((data.tankLevel ?? 100) < 20 ? 'var(--danger)' : TANK_COLORS[0])} />
                <Cell fill={TANK_COLORS[1]} />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
            <span style={{ fontSize: '2rem', fontWeight: '800', color: !isDeviceOnline ? 'var(--text-muted)' : 'var(--action)' }}>
              {isDeviceOnline && data.tankLevel !== null ? `${data.tankLevel}%` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* System Status & Water Usage */}
      <div className="card" style={{ gridColumn: 'span 1', display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
        <h3>{t.systemStatusTitle}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t.sensorHealth}:</span>
            <span style={{ color: isDeviceOnline ? 'var(--primary)' : 'var(--danger)', fontWeight: '700' }}>
              {isDeviceOnline ? t.deviceOnline : t.deviceOffline}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t.espStatus}:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`status-indicator ${isDeviceOnline ? 'status-online' : 'status-offline'}`}></span>
              <span style={{ color: isDeviceOnline ? 'var(--primary)' : 'var(--danger)', fontWeight: '700', fontSize: '0.9rem' }}>
                {activeDevice ? activeDevice.name : 'N/A'}
              </span>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.todayUsage}</span>
              <strong style={{ display: 'block', fontSize: '1.2rem', color: isDeviceOnline ? 'var(--action)' : 'var(--text-muted)' }}>
                {isDeviceOnline && data.todayWaterUsage !== null ? `${data.todayWaterUsage} L` : '-- L'}
              </strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.lastIrrigation}</span>
              <strong style={{ display: 'block', fontSize: '0.9rem' }}>
                {data.lastIrrigationTime ?? '--'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Trends Graph */}
      <div className="card" style={{ gridColumn: '1 / 3', display: 'flex', flexDirection: 'column' }}>
        <h3>{t.trendsTitle}</h3>
        {!isDeviceOnline && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '8px 0 0 0', fontStyle: 'italic' }}>
            {t.offlineBanner}
          </p>
        )}
        <div style={{ width: '100%', height: 210, marginTop: '15px', opacity: isDeviceOnline ? 1 : 0.4 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={phData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="var(--text-muted)" />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} stroke="var(--text-muted)" />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} stroke="var(--text-muted)" />
              <Tooltip />
              <Line yAxisId="left" type="monotone" dataKey="temp" stroke="#F59E0B" strokeWidth={3} name={`${t.temperature} (°C)`} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line yAxisId="right" type="monotone" dataKey="ph" stroke="#8B5CF6" strokeWidth={3} name={t.phLabel} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Manual Pump Control */}
      <div className="card" style={{ gridColumn: '3 / 4', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'stretch' }}>
        <h3 style={{ textAlign: 'center' }}>{t.manualControlTitle}</h3>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', margin: '10px 0 16px 0' }}>
          {t.overrideText}
        </p>

        {/* Connection status pill */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          padding: '7px 14px', borderRadius: '20px', marginBottom: '14px',
          background: isDeviceOnline ? '#dcfce7' : '#fee2e2',
          border: `1px solid ${isDeviceOnline ? '#86efac' : '#fca5a5'}`
        }}>
          <span className={`status-indicator ${isDeviceOnline ? 'status-online' : 'status-offline'}`}></span>
          <span style={{ fontWeight: '600', fontSize: '0.82rem', color: isDeviceOnline ? '#15803d' : '#b91c1c' }}>
            {isDeviceOnline ? `${t.deviceOnline} — ${activeDevice?.name}` : t.deviceOffline}
          </span>
        </div>

        {/* Pump toggle — blue for START (water action), red for STOP */}
        <button
          onClick={handleTogglePump}
          className="btn"
          style={{
            padding: '16px', fontSize: '1rem', fontWeight: '700',
            borderRadius: '12px', width: '100%', transition: 'all 0.2s',
            opacity: isDeviceOnline ? 1 : 0.45,
            cursor: isDeviceOnline ? 'pointer' : 'not-allowed',
            background: !isDeviceOnline
              ? '#cbd5e1'
              : data.pumpStatus === 'ON'
              ? 'linear-gradient(135deg,#ef4444,#b91c1c)'
              : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
            color: 'white',
            boxShadow: isDeviceOnline
              ? data.pumpStatus === 'ON'
                ? '0 4px 14px rgba(239,68,68,0.35)'
                : '0 4px 14px rgba(37,99,235,0.35)'
              : 'none',
            border: 'none'
          }}
          disabled={!isDeviceOnline}
        >
          {data.pumpStatus === 'ON' ? t.stopPump : t.startPump}
        </button>

        {!isDeviceOnline && (
          <p style={{ textAlign: 'center', color: 'var(--danger)', fontSize: '0.78rem', marginTop: '8px', fontWeight: '500' }}>
            ⛔ {isAmharic ? 'ለዚህ ቁጥጥር መሣሪያ ኦንላይን መሆን አለበት' : 'Device must be online to use controls'}
          </p>
        )}

        <div style={{
          textAlign: 'center', marginTop: '12px', padding: '10px',
          borderRadius: '8px',
          background: data.pumpStatus === 'ON' ? '#fee2e2' : '#dcfce7',
          opacity: isDeviceOnline ? 1 : 0.55
        }}>
          <strong style={{ fontSize: '0.88rem', color: data.pumpStatus === 'ON' ? '#b91c1c' : '#15803d' }}>
            {data.pumpStatus === 'ON' ? t.pumpRunning : t.pumpStopped}
          </strong>
        </div>
      </div>

      {/* GIS Satellite Map — full width, bottom of dashboard */}
      <GISMap farms={farms} devices={devices} isAmharic={isAmharic} />

    </div>
  );
};

export default Dashboard;
