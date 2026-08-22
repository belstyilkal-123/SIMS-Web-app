const fs = require('fs');
let c = fs.readFileSync('frontend/src/pages/officemanager/WorkforceAllocation.jsx', 'utf8');

c = c.replace(/\\\\Bearer \\\\\\\\/g, '\Bearer \\');
c = c.replace(/\\\\API_URL/g, '\\');
c = c.replace(/\\\\/g, '\');
c = c.replace(/\\formData.farmId\\/g, '\');

fs.writeFileSync('frontend/src/pages/officemanager/WorkforceAllocation.jsx', c);
