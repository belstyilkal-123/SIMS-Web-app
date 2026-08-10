import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';

// ── Public pages (eager) ───────────────────────────────────────────────────
import Home             from './pages/Home';
import Login            from './pages/Login';
import Register         from './pages/Register';
import ForgotPassword   from './pages/ForgotPassword';
import ResetPassword    from './pages/ResetPassword';
import RequestMagicLink from './pages/RequestMagicLink';
import MagicLinkVerify  from './pages/MagicLinkVerify';
import AccessDenied     from './pages/AccessDenied';

// ── Lazy-loaded pages ──────────────────────────────────────────────────────

// All roles
const Notifications = lazy(() => import('./pages/Notifications'));
const Settings      = lazy(() => import('./pages/Settings'));
const About         = lazy(() => import('./pages/About'));
const Contact       = lazy(() => import('./pages/Contact'));

// Super Admin + Farmer + Office Manager
const FarmIrrigation    = lazy(() => import('./pages/FarmIrrigation'));
const History           = lazy(() => import('./pages/History'));
const FarmerReports     = lazy(() => import('./pages/farmer/FarmerReports'));
const LabourAttachments = lazy(() => import('./pages/farmer/LabourAttachments'));

// Super Admin + Farmer (device management)
const Devices = lazy(() => import('./pages/Devices'));

// Super Admin only
const AuditLogs            = lazy(() => import('./pages/AuditLogs'));
const UserManagement       = lazy(() => import('./pages/admin/UserManagement'));
const AttendanceManagement = lazy(() => import('./pages/admin/AttendanceManagement'));

// Super Admin + Office Manager (task/activity management)
const ActivityAssignment = lazy(() => import('./pages/admin/ActivityAssignment'));

// Labour only
const LabourDashboard  = lazy(() => import('./pages/labour/LabourDashboard'));
const LabourActivities = lazy(() => import('./pages/labour/LabourActivities'));
const LabourAttendance = lazy(() => import('./pages/labour/LabourAttendance'));
const LabourPayslips   = lazy(() => import('./pages/labour/LabourPayslips'));

// Office Manager + Super Admin
const PayrollManagement = lazy(() => import('./pages/officemanager/PayrollManagement'));
const OfficeOverview    = lazy(() => import('./pages/officemanager/OfficeOverview'));
const OfficeAttendance  = lazy(() => import('./pages/officemanager/OfficeAttendance'));

// Inventory
const InventoryManagement = lazy(() => import('./pages/inventory/InventoryManagement'));

// Billing
const InvoiceManagement     = lazy(() => import('./pages/billing/InvoiceManagement'));
const FarmerBilling         = lazy(() => import('./pages/billing/FarmerBilling'));

// Maintenance
const MaintenanceManagement = lazy(() => import('./pages/maintenance/MaintenanceManagement'));
const FarmerMaintenance     = lazy(() => import('./pages/maintenance/FarmerMaintenance'));
const LabourMaintenance     = lazy(() => import('./pages/maintenance/LabourMaintenance'));

// ── Suspense fallback ──────────────────────────────────────────────────────
const PageLoader = () => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
    height:'60vh', color:'var(--text-muted)', gap:12, fontSize:'0.95rem' }}>
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
      style={{ animation:'spin 0.9s linear infinite' }}>
      <circle cx="11" cy="11" r="9" stroke="#16a34a" strokeWidth="2.5"
        strokeDasharray="40 20" strokeLinecap="round"/>
    </svg>
    Loading…
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

// ── Role constants ─────────────────────────────────────────────────────────
const SA         = ['super_administrator'];
const SA_OM      = ['super_administrator', 'office_manager'];
const SA_FM      = ['super_administrator', 'farmer'];
const SA_OM_FM   = ['super_administrator', 'office_manager', 'farmer'];
const LABOR      = ['labor'];
const ALL        = ['super_administrator', 'office_manager', 'farmer', 'labor'];

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>

                {/* ── PUBLIC ──────────────────────────────────────── */}
                <Route path="/"                       element={<Home />} />
                <Route path="/login"                  element={<Login />} />
                <Route path="/register"               element={<Register />} />
                <Route path="/forgot-password"        element={<ForgotPassword />} />
                <Route path="/reset-password/:token"  element={<ResetPassword />} />
                <Route path="/auth/magic-link"        element={<RequestMagicLink />} />
                <Route path="/auth/magic-link/verify" element={<MagicLinkVerify />} />
                <Route path="/access-denied"          element={<AccessDenied />} />

                {/* ── AUTHENTICATED ───────────────────────────────── */}
                <Route element={<Layout />}>

                  {/* ALL ROLES */}
                  <Route path="/notifications" element={<ProtectedRoute allowedRoles={ALL}><Notifications /></ProtectedRoute>} />
                  <Route path="/settings"      element={<ProtectedRoute allowedRoles={ALL}><Settings /></ProtectedRoute>} />
                  <Route path="/about"         element={<ProtectedRoute allowedRoles={ALL}><About /></ProtectedRoute>} />
                  <Route path="/contact"       element={<ProtectedRoute allowedRoles={ALL}><Contact /></ProtectedRoute>} />

                  {/* SUPER ADMIN + FARMER (farm ops dashboard) */}
                  <Route path="/dashboard"      element={<ProtectedRoute allowedRoles={SA_FM}><Dashboard /></ProtectedRoute>} />
                  <Route path="/farm-control"   element={<ProtectedRoute allowedRoles={SA_FM}><FarmIrrigation /></ProtectedRoute>} />
                  <Route path="/history"        element={<ProtectedRoute allowedRoles={SA_FM}><History /></ProtectedRoute>} />
                  <Route path="/devices"        element={<ProtectedRoute allowedRoles={SA_FM}><Devices /></ProtectedRoute>} />
                  <Route path="/farmer/reports" element={<ProtectedRoute allowedRoles={SA_FM}><FarmerReports /></ProtectedRoute>} />
                  <Route path="/farmer/labour"  element={<ProtectedRoute allowedRoles={SA_FM}><LabourAttachments /></ProtectedRoute>} />

                  {/* SUPER ADMIN + OFFICE MANAGER + FARMER */}
                  <Route path="/farm-view"     element={<ProtectedRoute allowedRoles={SA_OM_FM}><FarmIrrigation /></ProtectedRoute>} />

                  {/* SUPER ADMIN + OFFICE MANAGER (task/people management) */}
                  <Route path="/activities"    element={<ProtectedRoute allowedRoles={SA_OM}><ActivityAssignment /></ProtectedRoute>} />
                  <Route path="/payroll"       element={<ProtectedRoute allowedRoles={SA_OM}><PayrollManagement /></ProtectedRoute>} />
                  <Route path="/office/overview"    element={<ProtectedRoute allowedRoles={SA_OM}><OfficeOverview /></ProtectedRoute>} />
                  <Route path="/office/attendance"  element={<ProtectedRoute allowedRoles={SA_OM}><OfficeAttendance /></ProtectedRoute>} />

                  {/* SUPER ADMIN ONLY */}
                  <Route path="/audit-logs"         element={<ProtectedRoute allowedRoles={SA}><AuditLogs /></ProtectedRoute>} />
                  <Route path="/admin/users"        element={<ProtectedRoute allowedRoles={SA}><UserManagement /></ProtectedRoute>} />
                  <Route path="/admin/attendance"   element={<ProtectedRoute allowedRoles={SA}><AttendanceManagement /></ProtectedRoute>} />

                  {/* LABOUR ONLY */}
                  <Route path="/labour/dashboard"   element={<ProtectedRoute allowedRoles={LABOR}><LabourDashboard /></ProtectedRoute>} />
                  <Route path="/labour/activities"  element={<ProtectedRoute allowedRoles={LABOR}><LabourActivities /></ProtectedRoute>} />
                  <Route path="/labour/attendance"  element={<ProtectedRoute allowedRoles={LABOR}><LabourAttendance /></ProtectedRoute>} />
                  <Route path="/labour/payslips"    element={<ProtectedRoute allowedRoles={LABOR}><LabourPayslips /></ProtectedRoute>} />

                  {/* MAINTENANCE — role scoped */}
                  <Route path="/maintenance"
                    element={<ProtectedRoute allowedRoles={[...SA_OM]}><MaintenanceManagement /></ProtectedRoute>} />
                  <Route path="/maintenance/farm"
                    element={<ProtectedRoute allowedRoles={['farmer']}><FarmerMaintenance /></ProtectedRoute>} />
                  <Route path="/maintenance/labour"
                    element={<ProtectedRoute allowedRoles={['labor']}><LabourMaintenance /></ProtectedRoute>} />

                  {/* BILLING — role scoped */}
                  <Route path="/billing"
                    element={<ProtectedRoute allowedRoles={SA_OM}><InvoiceManagement /></ProtectedRoute>} />
                  <Route path="/billing/my"
                    element={<ProtectedRoute allowedRoles={['farmer']}><FarmerBilling /></ProtectedRoute>} />

                  {/* INVENTORY — SA + OM */}
                  <Route path="/inventory"
                    element={<ProtectedRoute allowedRoles={SA_OM}><InventoryManagement /></ProtectedRoute>} />

                  {/* LEGACY REDIRECTS */}
                  <Route path="/farms"        element={<Navigate to="/farm-control" replace />} />
                  <Route path="/irrigation"   element={<Navigate to="/farm-control" replace />} />
                  <Route path="/admin/activities" element={<Navigate to="/activities" replace />} />

                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}
