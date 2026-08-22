const fs = require('fs');
let c = fs.readFileSync('backend/server.js', 'utf8');

if (!c.includes('/api/assignment-requests')) {
  c = c.replace(
    "app.use('/api/farm-assignments', require('./routes/farmAssignments'));",
    "app.use('/api/farm-assignments', require('./routes/farmAssignments'));\napp.use('/api/assignment-requests', require('./routes/assignmentRequests'));"
  );
  fs.writeFileSync('backend/server.js', c);
}
