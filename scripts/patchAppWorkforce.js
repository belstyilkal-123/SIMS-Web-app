const fs = require('fs');
let c = fs.readFileSync('frontend/src/App.jsx', 'utf8');

c = c.replace(
  "const OfficeAttendance   = lazy(() => import('./pages/officemanager/OfficeAttendance'));",
  "const OfficeAttendance   = lazy(() => import('./pages/officemanager/OfficeAttendance'));\nconst WorkforceAllocation= lazy(() => import('./pages/officemanager/WorkforceAllocation'));"
);

c = c.replace(
  '<Route path="/office/overview"    element={<ProtectedRoute allowedRoles={[\'office_manager\']}><OfficeOverview /></ProtectedRoute>} />',
  '<Route path="/office/overview"    element={<ProtectedRoute allowedRoles={[\'office_manager\']}><OfficeOverview /></ProtectedRoute>} />\n                  <Route path="/office/workforce"   element={<ProtectedRoute allowedRoles={[\'office_manager\']}><WorkforceAllocation /></ProtectedRoute>} />'
);

fs.writeFileSync('frontend/src/App.jsx', c);
