import React, { useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config/api';

/* ── Translations ──────────────────────────────────────────────────────── */
const T = {
  en: {
    title: 'Alerts & Notifications',
    markAllRead: 'Mark all read',
    clearRead: 'Clear read',
    noNotifications: 'All clear!',
    noNotificationsSub: 'No notifications match this filter.',
    loading: 'Loading notifications…',
    justNow: 'Just now',
    minutesAgo: 'min ago',
    hoursAgo: 'hr ago',
    daysAgo: 'd ago',
    tabs: {
      all:        { en: 'All',       icon: '🔔' },
      alarm:      { en: 'Alarms',    icon: '🚨' },
      warning:    { en: 'Warnings',  icon: '⚠️' },
      info:       { en: 'Info',      icon: 'ℹ️' },
      unread:     { en: 'Unread',    icon: '🔵' },
    },
  },
  am: {
    title: 'ማስጠንቀቂያዎች እና ማሳወቂያዎች',
    markAllRead: 'ሁሉንም አንብብ',
    clearRead: 'የተነበቡትን አጥፋ',
    noNotifications: 'ሁሉም ጥሩ ነው!',
    noNotificationsSub: 'ምንም ማሳወቂያ አልተገኘም።',
    loading: 'ማሳወቂያዎችን በመጫን ላይ…',
    justNow: 'አሁን ልክ',
    minutesAgo: 'ደቂቃ በፊት',
    hoursAgo: 'ሰዓት በፊት',
    daysAgo: 'ቀን በፊት',
  },
};

/* ── Role display config ────────────────────────────────────────────────── */
const ROLE_INFO = {
  admin:          { label: 'System & Device Alerts', icon: '🛡️', color: '#3b82f6' },
  owner:          { label: 'Full Notifications',      icon: '👑', color: '#f59e0b' },
  office_manager: { label: 'Payment Alerts',          icon: '🏢', color: '#8b5cf6' },
  farmer:         { label: 'Farm & Field Alerts',     icon: '🌱', color: '#16a34a' },
  labor:          { label: 'Work & Assignment Alerts',icon: '👷', color: '#0891b2' },
};

/* ── Source-kind → category label ──────────────────────────────────────── */
const SOURCE_LABEL = {
  SensorData:          { label: 'Farm Sensor',  icon: '🌾' },
  IrrigationLog:       { label: 'Irrigation',   icon: '💧' },
  Device:              { label: 'Device',        icon: '📡' },
  Activity:            { label: 'Work Task',     icon: '📋' },
  Expense:             { label: 'Payment',       icon: '💰' },
  MaintenanceTicket:   { label: 'Maintenance',   icon: '🔧' },
  User:                { label: 'System',        icon: '🛡️' },
};

/* ── Type styles ────────────────────────────────────────────────────────── */
const TYPE_STYLE = {
  alarm:   { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', icon: '🚨', label: 'ALARM'   },
  warning: { bg: '#fffbeb', color: '#92400e', border: '#fcd34d', icon: '⚠️', label: 'WARNING' },
  info:    { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', icon: 'ℹ️', label: 'INFO'    },
  success: { bg: '#dcfce7', color: '#15803d', border: '#86efac', icon: '✅', label: 'SUCCESS' },
};

/* ── Time formatting ────────────────────────────────────────────────────── */
const timeAgo = (date, t) => {
  const secs = Math.floor((Date.now() - new Date(date)) / 1000);
  if (secs < 60)    return t.justNow;
  if (secs < 3600)  return `${Math.floor(secs / 60)} ${t.minutesAgo}`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} ${t.hoursAgo}`;
  return `${Math.floor(secs / 86400)} ${t.daysAgo}`;
};

/* ── Tab config ─────────────────────────────────────────────────────────── */
const TABS = ['all', 'unread', 'alarm', 'warning', 'info'];

export default function Notifications() {
  const { user } = useContext(AuthContext);
  const isAm     = user?.language === 'am';
  const t        = isAm ? T.am : T.en;
  const role     = user?.assignedRole || user?.role;
  const roleInfo = ROLE_INFO[role] || ROLE_INFO.farmer;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [tab, setTab]                     = useState('all');
  const [clearing, setClearing]           = useState(false);

  const cfg = { headers: { Authorization: `Bearer ${user?.token}` } };

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/notifications`, cfg);
      setNotifications(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user?.token]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    try {
      await axios.put(`${API_URL}/api/notifications/${id}/read`, {}, cfg);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch (e) { console.error(e); }
  };

  const markAllRead = async () => {
    try {
      await axios.put(`${API_URL}/api/notifications/read-all`, {}, cfg);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) { console.error(e); }
  };

  const deleteOne = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/notifications/${id}`, cfg);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch (e) { console.error(e); }
  };

  const clearRead = async () => {
    setClearing(true);
    try {
      await axios.delete(`${API_URL}/api/notifications`, cfg);
      setNotifications(prev => prev.filter(n => !n.read));
    } catch (e) { console.error(e); }
    finally { setClearing(false); }
  };

  // ── Filtering ────────────────────────────────────────────────────────────
  const displayed = notifications.filter(n => {
    if (tab === 'unread')  return !n.read;
    if (tab === 'alarm')   return n.type === 'alarm';
    if (tab === 'warning') return n.type === 'warning';
    if (tab === 'info')    return n.type === 'info' || n.type === 'success';
    return true;
  });

  const counts = {
    all:     notifications.length,
    unread:  notifications.filter(n => !n.read).length,
    alarm:   notifications.filter(n => n.type === 'alarm').length,
    warning: notifications.filter(n => n.type === 'warning').length,
    info:    notifications.filter(n => n.type === 'info' || n.type === 'success').length,
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <p style={{ color: 'var(--text-muted)' }}>{t.loading}</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 740 }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            🔔 {t.title}
          </h1>
          {/* Role scope badge */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8,
            fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20,
            background: roleInfo.color + '18', color: roleInfo.color,
            border: `1px solid ${roleInfo.color}40`,
          }}>
            {roleInfo.icon} {roleInfo.label}
          </span>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {counts.unread > 0 && (
            <button className="btn btn-outline"
              style={{ fontSize: '0.8rem', padding: '7px 14px' }}
              onClick={markAllRead}>
              ✅ {t.markAllRead}
            </button>
          )}
          {notifications.some(n => n.read) && (
            <button className="btn btn-outline"
              style={{ fontSize: '0.8rem', padding: '7px 14px', opacity: clearing ? 0.6 : 1 }}
              onClick={clearRead} disabled={clearing}>
              🗑️ {t.clearRead}
            </button>
          )}
        </div>
      </div>

      {/* ── Category tabs ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(tabKey => {
          const count = counts[tabKey];
          const active = tab === tabKey;
          const icons = { all: '🔔', unread: '🔵', alarm: '🚨', warning: '⚠️', info: 'ℹ️' };
          const labels = { all: 'All', unread: 'Unread', alarm: 'Alarms', warning: 'Warnings', info: 'Info' };
          return (
            <button key={tabKey} onClick={() => setTab(tabKey)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 600, border: '1.5px solid',
              borderColor: active ? 'var(--primary)' : 'var(--border)',
              background:  active ? 'var(--primary)' : 'var(--surface)',
              color:       active ? 'white' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>
              <span>{icons[tabKey]}</span>
              <span>{labels[tabKey]}</span>
              {count > 0 && (
                <span style={{
                  background: active ? 'rgba(255,255,255,0.25)' : 'var(--surface-hover)',
                  color: active ? 'white' : 'var(--text-muted)',
                  borderRadius: 10, padding: '0px 7px', fontSize: '0.7rem', fontWeight: 700,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Notification list ────────────────────────────────────────── */}
      {displayed.length === 0 ? (
        <div style={{
          background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
          padding: '60px 32px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔕</div>
          <h3 style={{ color: 'var(--text-main)', margin: '0 0 8px' }}>{t.noNotifications}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>{t.noNotificationsSub}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayed.map(n => {
            const ts    = TYPE_STYLE[n.type] || TYPE_STYLE.info;
            const src   = SOURCE_LABEL[n.sourceRef?.kind];
            return (
              <div key={n._id}
                onClick={() => !n.read && markRead(n._id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '14px 18px', borderRadius: 12, cursor: n.read ? 'default' : 'pointer',
                  background: n.read ? 'var(--surface)' : ts.bg,
                  border: `1px solid ${n.read ? 'var(--border)' : ts.border}`,
                  boxShadow: n.read ? 'none' : '0 1px 6px rgba(0,0,0,0.07)',
                  transition: 'all 0.2s',
                }}>

                {/* Type icon */}
                <span style={{ fontSize: '1.35rem', flexShrink: 0, marginTop: 1 }}>{ts.icon}</span>

                {/* Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {/* Type badge */}
                      <span style={{
                        fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        {ts.label}
                      </span>
                      {/* Source badge */}
                      {src && (
                        <span style={{
                          fontSize: '0.62rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                          background: 'var(--surface-hover)', color: 'var(--text-muted)',
                          border: '1px solid var(--border)',
                        }}>
                          {src.icon} {src.label}
                        </span>
                      )}
                      {/* Unread dot */}
                      {!n.read && (
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563eb', display: 'inline-block', flexShrink: 0 }} />
                      )}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {timeAgo(n.timestamp, t)}
                    </span>
                  </div>

                  <p style={{
                    margin: 0, fontSize: '0.875rem', lineHeight: 1.5,
                    color: n.read ? 'var(--text-muted)' : ts.color,
                    fontWeight: n.read ? 400 : 500,
                  }}>
                    {n.message}
                  </p>
                </div>

                {/* Delete */}
                <button
                  onClick={e => { e.stopPropagation(); deleteOne(n._id); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '1.1rem', color: 'var(--text-muted)', flexShrink: 0,
                    padding: '2px 4px', borderRadius: 4, lineHeight: 1, opacity: 0.6,
                  }}
                  title="Delete">
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
