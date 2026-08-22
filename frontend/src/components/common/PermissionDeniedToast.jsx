import React, { useEffect, useState } from 'react';

/**
 * PermissionDeniedToast - A user-friendly notification shown when users
 * attempt actions they don't have permission for.
 * 
 * Usage:
 * const [showPermissionDenied, setShowPermissionDenied] = useState(false);
 * <PermissionDeniedToast show={showPermissionDenied} onClose={() => setShowPermissionDenied(false)} />
 */

const T = {
  en: {
    title: 'Permission Required',
    message: "You don't have permission to perform this action.",
  },
  am: {
    title: 'ፈቃድ ያስፈልጋል',
    message: 'ይህን ተግባር ለማከናወን ፈቃድ የሎትም።',
  }
};

const PermissionDeniedToast = ({ show, onClose, isAmharic = false }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      // Auto-close after 4 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for fade-out animation
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show && !isVisible) return null;

  const t = isAmharic ? T.am : T.en;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10000,
        animation: isVisible ? 'slideIn 0.3s ease-out' : 'slideOut 0.3s ease-in',
        maxWidth: '400px',
        width: 'auto',
      }}
    >
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          @keyframes slideOut {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
        `}
      </style>
      <div
        style={{
          background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
          border: '2px solid #fb923c',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(251, 146, 60, 0.25), 0 4px 12px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'white' }}>
              {t.title}
            </h3>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '6px',
              width: '28px',
              height: '28px',
              cursor: 'pointer',
              fontSize: '1.1rem',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px' }}>
          <p style={{
            margin: 0,
            fontSize: '0.9rem',
            lineHeight: '1.6',
            color: '#7c2d12',
            fontWeight: '500',
          }}>
            {t.message}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PermissionDeniedToast;
