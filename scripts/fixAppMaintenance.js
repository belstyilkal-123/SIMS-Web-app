const fs = require('fs');
let c = fs.readFileSync('frontend/src/App.jsx', 'utf8');

c = c.replace(
  /<Route path="\/maintenance"       element=\{<ProtectedRoute allowedRoles=\{\['office_manager'\]\}><MaintenanceManagement \/><\/ProtectedRoute>\} \/>/g,
  '<Route path="/maintenance" element={<ProtectedRoute allowedRoles={[\'owner\', \'admin\', \'office_manager\', \'farmer\', \'labor\']}><MaintenanceManagement /></ProtectedRoute>} />'
);

fs.writeFileSync('frontend/src/App.jsx', c);
