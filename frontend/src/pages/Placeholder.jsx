import React, { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';

const PAGE_MAP = {
  '/notifications': { type: 'notification', icon: '🔔' },
};

const Placeholder = () => {
  const { user } = useContext(AuthContext);
  const isAmharic = user?.language === 'am';
  const location = useLocation();

  const mapped = PAGE_MAP[location.pathname];
  const pageName = location.pathname.substring(1).replace(/-/g, ' ');

  if (mapped) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            {mapped.icon} {pageName.charAt(0).toUpperCase() + pageName.slice(1)}
          </h1>
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <EmptyState type={mapped.type} isAmharic={isAmharic} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, textTransform: 'capitalize' }}>
          {pageName}
        </h1>
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
        <EmptyState type="generic" isAmharic={isAmharic} />
      </div>
    </div>
  );
};

export default Placeholder;
