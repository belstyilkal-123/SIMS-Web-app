const fs = require('fs');
let c = fs.readFileSync('frontend/src/App.jsx', 'utf8');

c = c.replace(
  "<Route path="/office/attendance"  element={<ProtectedRoute allowedRoles={['office_manager']}><OfficeAttendance /></ProtectedRoute>} />",
  "<Route path="/office/attendance"  element={<ProtectedRoute allowedRoles={['office_manager']}><OfficeAttendance /></ProtectedRoute>} />\n                  <Route path="/owner/attendance"   element={<ProtectedRoute allowedRoles={OWNER}><OfficeAttendance /></ProtectedRoute>} />\n                  <Route path="/farmer/attendance"  element={<ProtectedRoute allowedRoles={FARMER}><OfficeAttendance /></ProtectedRoute>} />"
);

fs.writeFileSync('frontend/src/App.jsx', c);
