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
import AccessDenied     from './pages/AccessDenied';

// ── Lazy-loaded pages ──────────────────────────────────────────────────────

// All roles
const Notifications = lazy(() => import('./pages/Notifications'));
const Settings      = lazy(() => import('./pages/Settings'));
const About         = lazy(() => import('./pages/About'));
const Contact       = lazy(() => import('./pages/Contact'));

// Owner-specific
const OwnerDashboard = lazy(() => import('./pages/owner/OwnerDashboard'));
const FarmAssignments= lazy(() => import('./pages/owner/FarmAssignments'));
const PendingApprovals= lazy(() => import('./pages/owner/PendingApprovals'));

// Admin-specific
const AdminDashboard         = lazy(() => import('./pages/admin/AdminDashboard'));
const UserManagement         = lazy(() => import('./pages/admin/UserManagement'));
const AttendanceManagement   = lazy(() => import('./pages/admin/AttendanceManagement'));

// Admin + Owner (farm ops view)
const FarmIrrigation    = lazy(() => import('./pages/FarmIrrigation'));
const Devices           = lazy(() => import('./pages/Devices'));
const History           = lazy(() => import('./pages/History'));
const AuditLogs         = lazy(() => import('./pages/AuditLogs'));

// Admin + Owner + Farmer
const FarmerReports     = lazy(() => import('./pages/farmer/FarmerReports'));
const LabourAttachments = lazy(() => import('./pages/farmer/LabourAttachments'));

// Admin + Office Manager
const TaskManagement     = lazy(() => import('./pages/tasks/TaskManagement'));
const PayrollManagement  = lazy(() => import('./pages/officemanager/PayrollManagement'));
const OfficeOverview     = lazy(() => import('./pages/officemanager/OfficeOverview'));
const OfficeAttendance   = lazy(() => import('./pages/officemanager/OfficeAttendance'));
const MaintenanceManagement = lazy(() => import('./pages/maintenance/MaintenanceManagement'));

// Expenses
const ExpenseRequests = lazy(() => import('./pages/expenses/ExpenseRequests'));

// Financial Reports
const FinancialReports = lazy(() => import('./pages/reports/FinancialReports'));

// Farmer-only

// Labour-only
const LabourDashboard  = lazy(() => import('./pages/labour/LabourDashboard'));
const LabourTasks      = lazy(() => import('./pages/tasks/MyTasks'));
const LabourAttendance = lazy(() => import('./pages/labour/LabourAttendance'));
const LabourPayslips   = lazy(() => import('./pages/labour/LabourPayslips'));

// ── Suspense fallback ──────────────────────────────────────────────────────
const Loader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f9fafb' }}>
    <div style={{ fontSize: '1.2rem', color: '#6b7280' }}>Loading view...</div>
  </div>
);

// Helper arrays for cleaner routing
const ADMIN   = ['admin'];
const OWNER   = ['owner'];
const FARMER  = ['farmer'];
const LABOR   = ['labor'];
const OWN_ADM = ['owner', 'admin'];
const ALL_OPS = ['owner', 'admin', 'farmer', 'office_manager', 'labor'];

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
          <ErrorBoundary>
            <Suspense fallback={<Loader />}>
              <Routes>
                {/* ── Public ────────────────────────────────────────────── */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
<Route path="/access-denied" element={<AccessDenied />} />

                {/* ── Protected ─────────────────────────────────────────── */}
                <Route element={<Layout />}>
                  {/* DEFAULT DASHBOARD REDIRECT */}
                  <Route path="/dashboard" element={<ProtectedRoute allowedRoles={ALL_OPS}><Dashboard /></ProtectedRoute>} />

                  {/* SHARED APP PAGES */}
                  <Route path="/notifications" element={<ProtectedRoute allowedRoles={ALL_OPS}><Notifications /></ProtectedRoute>} />
                  <Route path="/settings"      element={<ProtectedRoute allowedRoles={ALL_OPS}><Settings /></ProtectedRoute>} />
                  <Route path="/about"         element={<ProtectedRoute allowedRoles={ALL_OPS}><About /></ProtectedRoute>} />
                  <Route path="/contact"       element={<ProtectedRoute allowedRoles={ALL_OPS}><Contact /></ProtectedRoute>} />

                  {/* OWNER */}
                  <Route path="/owner/dashboard"   element={<ProtectedRoute allowedRoles={OWNER}><OwnerDashboard /></ProtectedRoute>} />
                  <Route path="/owner/farms"       element={<ProtectedRoute allowedRoles={OWNER}><FarmIrrigation /></ProtectedRoute>} />
                  <Route path="/owner/approvals"   element={<ProtectedRoute allowedRoles={OWNER}><PendingApprovals /></ProtectedRoute>} />
                  <Route path="/owner/attendance"  element={<ProtectedRoute allowedRoles={OWNER}><OfficeAttendance /></ProtectedRoute>} />

                  {/* ADMIN */}
                  <Route path="/admin/dashboard"   element={<ProtectedRoute allowedRoles={ADMIN}><AdminDashboard /></ProtectedRoute>} />
                  <Route path="/admin/users"       element={<ProtectedRoute allowedRoles={OWN_ADM}><UserManagement /></ProtectedRoute>} />
                  <Route path="/admin/attendance"  element={<ProtectedRoute allowedRoles={ADMIN}><AttendanceManagement /></ProtectedRoute>} />
                  <Route path="/audit-logs"        element={<ProtectedRoute allowedRoles={OWN_ADM}><AuditLogs /></ProtectedRoute>} />

                  {/* OWNER + ADMIN + FARMER (farm view — admin read-only, owner & farmer full) */}
                  <Route path="/farm-control"      element={<ProtectedRoute allowedRoles={[...OWN_ADM, 'farmer']}><FarmIrrigation /></ProtectedRoute>} />
                  <Route path="/devices"           element={<ProtectedRoute allowedRoles={[...OWN_ADM, 'farmer']}><Devices /></ProtectedRoute>} />
                  <Route path="/history"           element={<ProtectedRoute allowedRoles={[...OWN_ADM, 'farmer']}><History /></ProtectedRoute>} />

                  {/* OFFICE MANAGER */}
                  <Route path="/tasks"             element={<ProtectedRoute allowedRoles={['owner', 'office_manager', 'farmer']}><TaskManagement /></ProtectedRoute>} />
                  <Route path="/farm-assignments"  element={<ProtectedRoute allowedRoles={['owner', 'office_manager']}><FarmAssignments /></ProtectedRoute>} />
                  <Route path="/payroll"           element={<ProtectedRoute allowedRoles={[...OWNER,'office_manager']}><PayrollManagement /></ProtectedRoute>} />
                  <Route path="/office/overview"   element={<ProtectedRoute allowedRoles={['office_manager']}><OfficeOverview /></ProtectedRoute>} />
                  <Route path="/office/attendance" element={<ProtectedRoute allowedRoles={['office_manager']}><OfficeAttendance /></ProtectedRoute>} />
                  <Route path="/maintenance" element={<ProtectedRoute allowedRoles={['owner', 'admin', 'office_manager', 'farmer', 'labor']}><MaintenanceManagement /></ProtectedRoute>} />

                  {/* FARMER-ONLY */}
                  <Route path="/farmer/reports"    element={<ProtectedRoute allowedRoles={FARMER}><FarmerReports /></ProtectedRoute>} />
                  <Route path="/farmer/labour"     element={<ProtectedRoute allowedRoles={FARMER}><LabourAttachments /></ProtectedRoute>} />
                                    <Route path="/farmer/attendance" element={<ProtectedRoute allowedRoles={FARMER}><OfficeAttendance /></ProtectedRoute>} />

                  {/* FINANCE / EXPENSES */}
                  <Route path="/expenses"          element={<ProtectedRoute allowedRoles={['owner', 'office_manager', 'farmer']}><ExpenseRequests /></ProtectedRoute>} />
                  <Route path="/reports/financial" element={<ProtectedRoute allowedRoles={['owner', 'office_manager']}><FinancialReports /></ProtectedRoute>} />

                  {/* LABOUR-ONLY */}
                  <Route path="/labour/dashboard"  element={<ProtectedRoute allowedRoles={LABOR}><LabourDashboard /></ProtectedRoute>} />
                  <Route path="/labour/tasks"      element={<ProtectedRoute allowedRoles={LABOR}><LabourTasks /></ProtectedRoute>} />
                  <Route path="/labour/attendance" element={<ProtectedRoute allowedRoles={LABOR}><LabourAttendance /></ProtectedRoute>} />
                  <Route path="/labour/payslips"   element={<ProtectedRoute allowedRoles={LABOR}><LabourPayslips /></ProtectedRoute>} />
                  
                  {/* WILDCARD REDIRECT */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}


