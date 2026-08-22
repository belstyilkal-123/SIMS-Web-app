import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

/**
 * Role-aware redirect — sends each role to their correct home page
 * instead of a generic /access-denied when they hit a forbidden route.
 * Uses assignedRole (spec §54) — the officially granted role after approval.
 */
const ROLE_HOME = {
  owner:          '/owner/dashboard',
  admin:          '/admin/dashboard',
  office_manager: '/office/overview',
  farmer:         '/dashboard',
  labor:          '/labour/dashboard',
};

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '60vh', color: 'var(--text-muted)', fontSize: '1rem',
    }}>
      Loading…
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  const role = user.assignedRole || user.role;

  if (allowedRoles && !allowedRoles.includes(role)) {
    const home = ROLE_HOME[role] || '/login';
    return <Navigate to={home} replace />;
  }

  return children;
}

