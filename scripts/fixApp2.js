const fs = require('fs');
let c = fs.readFileSync('frontend/src/App.jsx', 'utf8');

c = c.replace(
  "const ActivityAssignment = lazy(() => import('./pages/admin/ActivityAssignment'));",
  "const TaskManagement = lazy(() => import('./pages/tasks/TaskManagement'));"
);

c = c.replace(
  "const LabourActivities = lazy(() => import('./pages/labour/LabourActivities'));",
  "const MyTasks          = lazy(() => import('./pages/tasks/MyTasks'));"
);

c = c.replace(
  '<Route path="/activities"         element={<ProtectedRoute allowedRoles={[\'office_manager\']}><ActivityAssignment /></ProtectedRoute>} />',
  '<Route path="/tasks"              element={<ProtectedRoute allowedRoles={[\'owner\', \'office_manager\', \'farmer\']}><TaskManagement /></ProtectedRoute>} />'
);

c = c.replace(
  '<Route path="/labour/activities"  element={<ProtectedRoute allowedRoles={LABOR}><LabourActivities /></ProtectedRoute>} />',
  '<Route path="/labour/tasks"       element={<ProtectedRoute allowedRoles={LABOR}><MyTasks /></ProtectedRoute>} />'
);

fs.writeFileSync('frontend/src/App.jsx', c);
