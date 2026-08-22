const fs = require('fs');
let c = fs.readFileSync('frontend/src/App.jsx', 'utf8');

c = c.replace(
  "const AuditLogs         = lazy(() => import('./pages/AuditLogs'));",
  "const AuditLogs         = lazy(() => import('./pages/AuditLogs'));\nconst FarmAssignments   = lazy(() => import('./pages/owner/FarmAssignments'));"
);

c = c.replace(
  '<Route path="/audit-logs"        element={<ProtectedRoute allowedRoles={OWN_ADM}><AuditLogs /></ProtectedRoute>} />',
  '<Route path="/audit-logs"        element={<ProtectedRoute allowedRoles={OWN_ADM}><AuditLogs /></ProtectedRoute>} />\n                  <Route path="/farm-assignments"  element={<ProtectedRoute allowedRoles={[\'owner\', \'office_manager\']}><FarmAssignments /></ProtectedRoute>} />'
);

c = c.split('\n').filter(l => 
  !l.includes('InventoryManagement') && 
  !l.includes('InvoiceManagement') && 
  !l.includes('FarmerBilling') && 
  !l.includes('/admin/inventory') && 
  !l.includes('/admin/billing') && 
  !l.includes('/farmer/billing')
).join('\n');

fs.writeFileSync('frontend/src/App.jsx', c);
