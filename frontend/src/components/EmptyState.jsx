/**
 * EmptyState — Shown when a page has no data yet.
 * Uses inline SVG illustration so no external image is needed.
 */
import React from 'react';

const illustrations = {
  farm: (
    <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="55" width="100" height="35" rx="4" fill="#dcfce7"/>
      <rect x="20" y="60" width="18" height="30" rx="2" fill="#15803d" opacity="0.7"/>
      <rect x="44" y="65" width="14" height="25" rx="2" fill="#15803d" opacity="0.5"/>
      <rect x="64" y="58" width="20" height="32" rx="2" fill="#15803d" opacity="0.6"/>
      <rect x="90" y="63" width="12" height="27" rx="2" fill="#15803d" opacity="0.4"/>
      <circle cx="60" cy="32" r="18" fill="#dbeafe"/>
      <path d="M60 20 C60 20 52 30 52 36 C52 40.4 55.6 44 60 44 C64.4 44 68 40.4 68 36 C68 30 60 20 60 20Z" fill="#2563eb" opacity="0.7"/>
      <circle cx="60" cy="36" r="5" fill="white"/>
      <path d="M46 55 Q53 45 60 55 Q67 45 74 55" stroke="#15803d" strokeWidth="1.5" fill="none" opacity="0.5"/>
    </svg>
  ),
  device: (
    <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="30" y="20" width="60" height="55" rx="6" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="2"/>
      <rect x="38" y="30" width="44" height="28" rx="3" fill="#dbeafe"/>
      <circle cx="60" cy="44" r="8" fill="#2563eb" opacity="0.8"/>
      <circle cx="60" cy="44" r="4" fill="white"/>
      <rect x="50" y="62" width="20" height="4" rx="2" fill="#e2e8f0"/>
      <rect x="54" y="68" width="12" height="4" rx="2" fill="#e2e8f0"/>
      {/* WiFi arcs */}
      <path d="M44 22 Q60 14 76 22" stroke="#15803d" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M50 16 Q60 10 70 16" stroke="#15803d" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5"/>
      {/* Spinning gear */}
      <circle cx="95" cy="25" r="10" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5"/>
      <circle cx="95" cy="25" r="5" fill="#f59e0b" opacity="0.6"/>
      <circle cx="95" cy="25" r="2" fill="white"/>
      {[0,60,120,180,240,300].map(a => (
        <rect key={a} x="93.5" y="13" width="3" height="4" rx="1.5" fill="#f59e0b"
          transform={`rotate(${a} 95 25)`}/>
      ))}
    </svg>
  ),
  history: (
    <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="20" width="90" height="65" rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      <line x1="25" y1="72" x2="25" y2="35" stroke="#e2e8f0" strokeWidth="1"/>
      <line x1="25" y1="72" x2="105" y2="72" stroke="#e2e8f0" strokeWidth="1"/>
      {/* Bars */}
      <rect x="32" y="52" width="10" height="20" rx="2" fill="#15803d" opacity="0.5"/>
      <rect x="48" y="44" width="10" height="28" rx="2" fill="#15803d" opacity="0.7"/>
      <rect x="64" y="55" width="10" height="17" rx="2" fill="#2563eb" opacity="0.5"/>
      <rect x="80" y="38" width="10" height="34" rx="2" fill="#15803d" opacity="0.6"/>
      {/* Trend line */}
      <polyline points="37,52 53,44 69,55 85,38" stroke="#f59e0b" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="37" cy="52" r="2.5" fill="#f59e0b"/>
      <circle cx="53" cy="44" r="2.5" fill="#f59e0b"/>
      <circle cx="69" cy="55" r="2.5" fill="#f59e0b"/>
      <circle cx="85" cy="38" r="2.5" fill="#f59e0b"/>
    </svg>
  ),
  notification: (
    <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60 18 C46 18 36 29 36 43 L36 56 L28 64 L28 68 L92 68 L92 64 L84 56 L84 43 C84 29 74 18 60 18Z"
        fill="#dcfce7" stroke="#15803d" strokeWidth="1.5"/>
      <rect x="52" y="68" width="16" height="8" rx="4" fill="#15803d" opacity="0.6"/>
      <circle cx="87" cy="28" r="10" fill="#fee2e2"/>
      <text x="87" y="32" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#ef4444">!</text>
    </svg>
  ),
  generic: (
    <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="50" r="32" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="2"/>
      <path d="M48 44 C48 38 72 38 72 44 C72 50 64 52 60 58" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <circle cx="60" cy="66" r="3" fill="#94a3b8"/>
    </svg>
  )
};

const EmptyState = ({
  type = 'generic',
  title,
  description,
  action,
  actionLabel,
  isAmharic = false
}) => {
  const defaults = {
    farm: {
      title:       isAmharic ? 'ምንም እርሻ አልተጨመረም' : 'No Farms Configured Yet',
      description: isAmharic ? 'የመጀመሪያ እርሻዎን ለማከል ከዚህ ጀምሩ።' : 'Add your first farm zone to start monitoring soil moisture and controlling irrigation.'
    },
    device: {
      title:       isAmharic ? 'ምንም መሣሪያ አልተገናኘም' : 'No Devices Connected',
      description: isAmharic ? 'ESP8266 መሣሪያዎን ለማቀናበር ሃርድዌር ወደ ስርዓቱ ይቀላቀሉ።' : 'Connect your ESP8266 hardware unit and register it to start receiving live sensor data.'
    },
    history: {
      title:       isAmharic ? 'ምንም የታሪክ መረጃ የለም' : 'No History Data Yet',
      description: isAmharic ? 'የመስኖ ምዝገቦች ሲጀምሩ እዚህ ይታያሉ።' : 'Irrigation logs and sensor trend charts will appear here once your devices start reporting data.'
    },
    notification: {
      title:       isAmharic ? 'ምንም ማስጠንቀቂያ የለም' : 'All Clear',
      description: isAmharic ? 'ምንም ንቁ ማስጠንቀቂያ የለም። ስርዓቱ በጥሩ ሁኔታ እየሠራ ነው።' : 'No active alerts. Your irrigation system is running smoothly.'
    },
    generic: {
      title:       isAmharic ? 'ምንም ውሂብ የለም' : 'Nothing Here Yet',
      description: isAmharic ? 'ውሂብ ሲጨምር እዚህ ይታያል።' : 'Data will appear here once available.'
    }
  };

  const d = defaults[type] || defaults.generic;

  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {illustrations[type] || illustrations.generic}
      </div>
      <h3>{title || d.title}</h3>
      <p>{description || d.description}</p>
      {action && actionLabel && (
        <button className="btn btn-primary" onClick={action} style={{ marginTop: 8 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
