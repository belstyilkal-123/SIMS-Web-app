import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

/**
 * Role-aware redirect — sends each role to their own home page
 * instead of a generic /access-denied when they hit a forbidden route.
 */
const ROLE_HOME = {
  super_administrator: '/dashboard',
  office_manager:      '/office/overview',
  farmer:              '/dashboard',
  labor:               '/labour/dashboard',
};

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:'60vh', color:'var(--text-muted)', fontSize:'1rem' }}>
      Loading…
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const home = ROLE_HOME[user.role] || '/dashboard';
    return <Navigate to={home} replace />;
  }

  return children;
}
