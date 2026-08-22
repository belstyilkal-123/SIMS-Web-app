const fs = require('fs');
let c = fs.readFileSync('frontend/src/pages/maintenance/MaintenanceManagement.jsx', 'utf8');

c = c.replace(/Repair Cost \(\$\)/g, "Maintenance Cost ($)");
c = c.replace(/Repair Cost/g, "Maintenance Cost");

fs.writeFileSync('frontend/src/pages/maintenance/MaintenanceManagement.jsx', c);
