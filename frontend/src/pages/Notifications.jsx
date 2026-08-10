import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config/api';

const T = {
  en: {
    title: 'Alerts & Notifications',
    markAllRead: 'Mark all as read',
    noNotifications: 'No notifications yet.',
    noNotificationsSub: 'Alerts from your devices and system events will appear here.',
    unread: 'Unread',
    all: 'All',
    alarm: 'ALARM',
    warning: 'WARNING',
    info: 'INFO',
    loading: 'Loading notifications...',
    justNow: 'Just now',
    minutesAgo: 'min ago',
    hoursAgo: 'hr ago',
    daysAgo: 'days ago',
  },
  am: {
    title: 'ማስጠንቀቂያዎች እና ማሳወቂያዎች',
    markAllRead: 'ሁሉንም እንደተነበበ ምልክት አድርግ',
    noNotifications: 'እስካሁን ምንም ማሳወቂያ የለም።',
    noNotificationsSub: 'ከመሣሪያዎ እና ከስርዓቱ ክስተቶች ማስጠንቀቂያዎች እዚህ ይታያሉ።',
    unread: 'ያልተነበቡ',
    all: 'ሁሉም',
    alarm: 'አደጋ',
    warning: 'ማስጠንቀቂያ',
    info: 'መረጃ',
    loading: 'ማሳወቂያዎችን በመጫን ላይ...',
    justNow: 'አሁን ልክ',
    minutesAgo: 'ደቂቃ በፊት',
    hoursAgo: 'ሰዓት በፊት',
    daysAgo: 'ቀናት በፊት',
  }
};

const TYPE_STYLE = {
  alarm:   { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', icon: '🚨' },
  warning: { bg: '#fffbeb', color: '#92400e', border: '#fcd34d', icon: '⚠️' },
  info:    { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', icon: 'ℹ️' },
};

const timeAgo = (date, t) => {
  const secs = Math.floor((Date.now() - new Date(date)) / 1000);
  if (secs < 60)   return t.justNow;
  if (secs < 3600) return `${Math.floor(secs / 60)} ${t.minutesAgo}`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} ${t.hoursAgo}`;
  return `${Math.floor(secs / 86400)} ${t.daysAgo}`;
};

const Notifications = () => {
  const { user } = useContext(AuthContext);
  const isAm = user?.language === 'am';
  const t    = isAm ? T.am : T.en;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [filter, setFilter]               = useState('all'); // 'all' | 'unread'

  const config = { headers: { Authorization: `Bearer ${user?.token}` } };

  const fetch = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/notifications`, config);
      setNotifications(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const markRead = async (id) => {
    try {
      await axios.put(`${API_URL}/api/notifications/${id}/read`, {}, config);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch (e) { console.error(e); }
  };

  const markAllRead = async () => {
    try {
      await axios.put(`${API_URL}/api/notifications/read-all`, {}, config);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) { console.error(e); }
  };

  const deleteOne = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/notifications/${id}`, config);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch (e) { console.error(e); }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const displayed   = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'50vh' }}>
      <p style={{ color:'var(--text-muted)' }}>{t.loading}</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 720 }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
        <div>
          <h1 style={{ fontSize:'1.75rem', fontWeight:800, color:'var(--text-main)', margin:0 }}>
            🔔 {t.title}
          </h1>
          {unreadCount > 0 && (
            <p style={{ color:'var(--text-muted)', fontSize:'0.875rem', marginTop:4 }}>
              {unreadCount} {isAm ? 'ያልተነበቡ ማሳወቂያዎች' : `unread notification${unreadCount !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-outline"
            style={{ fontSize:'0.82rem', padding:'8px 14px' }}
            onClick={markAllRead}>
            ✅ {t.markAllRead}
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:18 }}>
        {['all', 'unread'].map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            style={{
              padding:'6px 18px', borderRadius:20, border:'1.5px solid',
              fontSize:'0.82rem', fontWeight:600, cursor:'pointer',
              borderColor: filter === f ? 'var(--primary)' : 'var(--border)',
              background:  filter === f ? 'var(--primary)' : 'var(--surface)',
              color:       filter === f ? 'white' : 'var(--text-muted)',
            }}>
            {f === 'all' ? t.all : `${t.unread}${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {displayed.length === 0 ? (
        <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)',
          padding:'60px 32px', textAlign:'center' }}>
          <div style={{ fontSize:'3rem', marginBottom:14 }}>🔕</div>
          <h3 style={{ color:'var(--text-main)', margin:'0 0 8px' }}>{t.noNotifications}</h3>
          <p style={{ color:'var(--text-muted)', fontSize:'0.875rem', margin:0 }}>{t.noNotificationsSub}</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {displayed.map(n => {
            const style = TYPE_STYLE[n.type] || TYPE_STYLE.info;
            return (
              <div key={n._id} style={{
                display:'flex', alignItems:'flex-start', gap:14,
                padding:'14px 18px', borderRadius:12,
                background: n.read ? 'var(--surface)' : style.bg,
                border: `1px solid ${n.read ? 'var(--border)' : style.border}`,
                boxShadow: n.read ? 'none' : 'var(--shadow-sm)',
                transition:'all 0.2s',
                cursor: n.read ? 'default' : 'pointer',
              }}
                onClick={() => !n.read && markRead(n._id)}>

                {/* Icon */}
                <span style={{ fontSize:'1.4rem', flexShrink:0, marginTop:1 }}>{style.icon}</span>

                {/* Content */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{
                        fontSize:'0.65rem', fontWeight:700, padding:'2px 8px', borderRadius:20,
                        background: style.bg, color: style.color, border:`1px solid ${style.border}`,
                        textTransform:'uppercase', letterSpacing:'0.06em'
                      }}>
                        {n.type === 'alarm' ? t.alarm : n.type === 'warning' ? t.warning : t.info}
                      </span>
                      {!n.read && (
                        <span style={{ width:8, height:8, borderRadius:'50%', background:'#2563eb',
                          display:'inline-block', flexShrink:0 }}/>
                      )}
                    </div>
                    <span style={{ fontSize:'0.72rem', color:'var(--text-muted)', whiteSpace:'nowrap', flexShrink:0 }}>
                      {timeAgo(n.timestamp, t)}
                    </span>
                  </div>
                  <p style={{ margin:'6px 0 0', fontSize:'0.875rem',
                    color: n.read ? 'var(--text-muted)' : style.color,
                    fontWeight: n.read ? 400 : 500, lineHeight:1.5 }}>
                    {n.message}
                  </p>
                </div>

                {/* Delete button */}
                <button
                  onClick={e => { e.stopPropagation(); deleteOne(n._id); }}
                  style={{ background:'none', border:'none', cursor:'pointer',
                    fontSize:'1rem', color:'var(--text-muted)', flexShrink:0,
                    padding:'2px 4px', borderRadius:4, lineHeight:1 }}
                  title={isAm ? 'ሰርዝ' : 'Delete'}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
