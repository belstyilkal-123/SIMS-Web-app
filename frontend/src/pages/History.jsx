import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import { API_URL } from '../config/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const translations = {
  en: {
    pageTitle: 'Irrigation Reports & History',
    chartTitle: '30-Day Environmental & Water Trends',
    tableTitle: 'Irrigation Activity Logs',
    moisture: 'Soil Moisture (%)',
    temp: 'Temperature (°C)',
    water: 'Water Usage (L)',
    date: 'Date',
    time: 'Time',
    farm: 'Farm Field',
    mode: 'Trigger Mode',
    status: 'State',
    waterQuantity: 'Water Used',
    duration: 'Duration',
    auto: 'Automatic',
    manual: 'Manual',
    seconds: 'sec',
    liters: 'Liters',
    allFarms: 'All Fields',
    searchLogs: 'Search logs...',
    sortBy: 'Sort By',
    newest: 'Newest First',
    oldest: 'Oldest First',
    mostWater: 'Most Water Used',
    loading: 'Loading historical reports...',
    noLogs: 'No logs found matching filter criteria.'
  },
  am: {
    pageTitle: 'የመስኖ ሪፖርቶች እና ታሪክ',
    chartTitle: 'የ30 ቀናት የአፈር እርጥበት እና የውሃ አጠቃቀም አዝማሚያ',
    tableTitle: 'የመስኖ እንቅስቃሴ ምዝግብ ማስታወሻ',
    moisture: 'የአፈር እርጥበት (%)',
    temp: 'ሙቀት (°C)',
    water: 'የውሃ አጠቃቀም (ሊትር)',
    date: 'ቀን',
    time: 'ሰዓት',
    farm: 'የእርሻ ቦታ',
    mode: 'የቀስቅሴ ሁኔታ (ሞድ)',
    status: 'ሁኔታ',
    waterQuantity: 'የተጠቀመው ውሃ',
    duration: 'የወሰደው ጊዜ',
    auto: 'ራስ-ሰር',
    manual: 'በእጅ',
    seconds: 'ሰከንድ',
    liters: 'ሊትር',
    allFarms: 'ሁሉም እርሻዎች',
    searchLogs: 'የእንቅስቃሴ መዝገቦችን ፈልግ...',
    sortBy: 'አደራድር',
    newest: 'የቅርብ ጊዜ ቀዳሚ',
    oldest: 'የቀድሞ ጊዜ ቀዳሚ',
    mostWater: 'ከፍተኛ ውሃ አጠቃቀም',
    loading: 'የታሪክ ሪፖርቶችን በመጫን ላይ...',
    noLogs: 'ከፍለጃ መስፈርቶች ጋር የሚዛመዱ መዝገቦች አልተገኙም።'
  }
};

const History = () => {
  const { user } = useContext(AuthContext);
  const isAmharic = user?.language === 'am';
  const t = isAmharic ? translations.am : translations.en;
  const navigate = useNavigate();

  const [logs, setLogs]     = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);
  const [noDataMsg, setNoDataMsg] = useState('');
  
  // Filtering & Sorting State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFarm, setSelectedFarm] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchHistory = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const response = await axios.get(`${API_URL}/api/reports/history`, config);
        setLogs(response.data.logs || []);
        setTrends(response.data.trends || []);
        setHasRealData(response.data.hasRealData || false);
        setNoDataMsg(response.data.message || '');
        setLoading(false);
      } catch (error) {
        console.error("Error fetching history analytics:", error);
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user, navigate]);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'50vh' }}>
      <p style={{ color:'var(--text-muted)' }}>{t.loading}</p>
    </div>
  );

  // Filter Farms list dynamically from logs
  const farmsList = ['all', ...new Set(logs.map(log => log.farm))];

  // Filter & Sort Logic
  const filteredLogs = logs
    .filter(log => {
      const matchesSearch = log.farm.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            log.device.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            log.mode.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFarm = selectedFarm === 'all' || log.farm === selectedFarm;
      return matchesSearch && matchesFarm;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.timestamp) - new Date(a.timestamp);
      if (sortBy === 'oldest') return new Date(a.timestamp) - new Date(b.timestamp);
      if (sortBy === 'mostWater') return b.waterUsed - a.waterUsed;
      return 0;
    });

  return (
    <div className="container" style={{ maxWidth: '1200px' }}>
      <h1 style={{ fontSize: '2.5rem', color: 'var(--primary)', fontWeight: '700', marginBottom: '8px' }}>
        {t.pageTitle}
      </h1>

      {/* ── No real data yet banner ── */}
      {!hasRealData && (
        <div style={{
          background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: 12,
          padding: '20px 24px', marginBottom: 24,
          display: 'flex', alignItems: 'flex-start', gap: 14
        }}>
          <span style={{ fontSize: '2rem', flexShrink: 0 }}>📡</span>
          <div>
            <strong style={{ color: '#92400e', fontSize: '1rem', display: 'block', marginBottom: 4 }}>
              {isAmharic ? 'የቀጥታ ውሂብ እስካሁን የለም' : 'No Real Data Yet'}
            </strong>
            <p style={{ color: '#78350f', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>
              {isAmharic
                ? 'ESP8266 መሣሪያዎ ገና አልተገናኘም። መሣሪያዎ ሲገናኝ ትክክለኛ የሴንሰር ንባቦች፣ የመስኖ ምዝግብ ማስታወሻዎች እና ቻርቶች እዚህ ይታያሉ።'
                : 'Your ESP8266 device has not connected yet. Once your device is online and sending data, real sensor readings, irrigation logs, and trend charts will appear here.'}
            </p>
            <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: '#92400e', background: '#fef3c7',
                padding: '4px 12px', borderRadius: 20, border: '1px solid #fcd34d' }}>
                📋 {isAmharic ? 'መጀመሪያ: እርሻ ዞን ይፍጠሩ' : 'Step 1: Create a Farm Zone'}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#92400e', background: '#fef3c7',
                padding: '4px 12px', borderRadius: 20, border: '1px solid #fcd34d' }}>
                📡 {isAmharic ? 'ሁለተኛ: መሣሪያ ይመዝግቡ' : 'Step 2: Register a Device'}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#92400e', background: '#fef3c7',
                padding: '4px 12px', borderRadius: 20, border: '1px solid #fcd34d' }}>
                ⚡ {isAmharic ? 'ሦስተኛ: ESP8266 ይበኩ' : 'Step 3: Power on the ESP8266'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Trend Chart ── */}
      <div className="glass-card mb-8" style={{ padding: '25px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '16px', color: 'var(--text-main)' }}>
          📈 {t.chartTitle}
        </h3>

        {trends.length === 0 ? (
          <div style={{ height: 200, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            background: 'var(--surface-hover)', borderRadius: 10 }}>
            <span style={{ fontSize: '2.5rem' }}>📊</span>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>
              {isAmharic
                ? 'ቻርት ውሂብ እስካሁን የለም። መሣሪያዎ ሲገናኝ ቻርቱ ይሞላል።'
                : 'No chart data yet. The trend chart will populate once your device starts sending readings.'}
            </p>
          </div>
        ) : (
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMoisture" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#15803d" stopOpacity={0.75}/>
                    <stop offset="95%" stopColor="#15803d" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.7}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.7}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }} />
                <Legend verticalAlign="top" height={36}/>
                <Area type="monotone" dataKey="soilMoisture" stroke="#15803d" strokeWidth={2} fillOpacity={1} fill="url(#colorMoisture)" name={t.moisture} />
                <Area type="monotone" dataKey="waterUsage"   stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorWater)"    name={t.water} />
                <Area type="monotone" dataKey="temperature"  stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorTemp)"     name={t.temp} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Filter and Sort bar — only show when there are logs */}
      {logs.length > 0 && (
        <div className="glass-card mb-4" style={{ padding: '15px 20px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <input type="text" className="form-input" placeholder={t.searchLogs}
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div style={{ width: '200px' }}>
            <select className="form-input" value={selectedFarm} onChange={e => setSelectedFarm(e.target.value)}>
              {farmsList.map(n => <option key={n} value={n}>{n === 'all' ? t.allFarms : n}</option>)}
            </select>
          </div>
          <div style={{ width: '200px' }}>
            <select className="form-input" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="newest">{t.newest}</option>
              <option value="oldest">{t.oldest}</option>
              <option value="mostWater">{t.mostWater}</option>
            </select>
          </div>

          {/* CSV Export button */}
          <a
            href={`${API_URL}/api/reports/export?format=csv`}
            download
            onClick={e => {
              // Attach auth header via fetch + blob so token is sent
              e.preventDefault();
              fetch(`${API_URL}/api/reports/export?format=csv`, {
                headers: { Authorization: `Bearer ${user.token}` },
              })
                .then(r => r.blob())
                .then(blob => {
                  const url = URL.createObjectURL(blob);
                  const a   = document.createElement('a');
                  a.href     = url;
                  a.download = `irrigation_export_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                })
                .catch(() => alert('Export failed. Please try again.'));
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 8,
              background: '#0891b2', color: 'white',
              fontSize: '0.84rem', fontWeight: 600,
              textDecoration: 'none', whiteSpace: 'nowrap',
              transition: 'background 0.15s', cursor: 'pointer',
            }}
          >
            ⬇ {isAmharic ? 'CSV ወደ ውጭ' : 'Export CSV'}
          </a>
        </div>
      )}

      {/* Irrigation log table */}
      {logs.length === 0 ? (
        <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)' }}>
          <EmptyState type="history" isAmharic={isAmharic} />
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '0px', overflowX: 'auto', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ background: 'var(--surface-hover)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '15px 20px', color: 'var(--text-muted)', fontWeight: '600' }}>{t.date}</th>
                <th style={{ padding: '15px 20px', color: 'var(--text-muted)', fontWeight: '600' }}>{t.farm}</th>
                <th style={{ padding: '15px 20px', color: 'var(--text-muted)', fontWeight: '600' }}>{t.mode}</th>
                <th style={{ padding: '15px 20px', color: 'var(--text-muted)', fontWeight: '600' }}>{t.status}</th>
                <th style={{ padding: '15px 20px', color: 'var(--text-muted)', fontWeight: '600' }}>{t.waterQuantity}</th>
                <th style={{ padding: '15px 20px', color: 'var(--text-muted)', fontWeight: '600' }}>{t.duration}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t.noLogs}
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log._id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '15px 20px' }}>
                      <div style={{ fontWeight: '500' }}>{new Date(log.timestamp).toLocaleDateString()}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleTimeString()}</div>
                    </td>
                    <td style={{ padding: '15px 20px', fontWeight: '600' }}>{log.farm}</td>
                    <td style={{ padding: '15px 20px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '600',
                        background: log.mode === 'auto' ? '#dcfce7' : '#dbeafe',
                        color: log.mode === 'auto' ? '#15803d' : '#1d4ed8'
                      }}>
                        {log.mode === 'auto' ? t.auto : t.manual}
                      </span>
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <span style={{ fontWeight: '700', color: log.status === 'ON' ? 'var(--primary)' : 'var(--danger)' }}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ padding: '15px 20px', fontWeight: '700', color: '#2563eb' }}>
                      {log.waterUsed} {t.liters}
                    </td>
                    <td style={{ padding: '15px 20px', fontWeight: '500' }}>
                      {log.duration} {t.seconds}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default History;
