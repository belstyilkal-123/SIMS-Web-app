const fs = require('fs');
let c = fs.readFileSync('frontend/src/App.jsx', 'utf8');

if (!c.includes('PendingApprovals')) {
  c = c.replace(
    "const FarmAssignments   = lazy(() => import('./pages/owner/FarmAssignments'));",
    "const FarmAssignments   = lazy(() => import('./pages/owner/FarmAssignments'));\nconst PendingApprovals  = lazy(() => import('./pages/owner/PendingApprovals'));"
  );

  c = c.replace(
    '<Route path="/owner/payments"    element={<ProtectedRoute allowedRoles={OWNER}><OwnerPayments /></ProtectedRoute>} />',
    '<Route path="/owner/payments"    element={<ProtectedRoute allowedRoles={OWNER}><OwnerPayments /></ProtectedRoute>} />\n                  <Route path="/owner/approvals"   element={<ProtectedRoute allowedRoles={OWNER}><PendingApprovals /></ProtectedRoute>} />'
  );
  
  fs.writeFileSync('frontend/src/App.jsx', c);
}
