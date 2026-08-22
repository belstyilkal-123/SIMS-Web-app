const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

if (!c.includes('/owner/approvals')) {
  c = c.replace(
    "{ path:'/owner/attendance',  icon:'🗓️', label:'Attendance' },",
    "{ path:'/owner/approvals',   icon:'✅', label:'Approvals' },\n          { path:'/owner/attendance',  icon:'🗓️', label:'Attendance' },"
  );

  c = c.replace(
    "{ path:'/owner/attendance',  icon:'🗓️', label:'መገኘት' },",
    "{ path:'/owner/approvals',   icon:'✅', label:'ማረጋገጫዎች' },\n            { path:'/owner/attendance',  icon:'🗓️', label:'መገኘት' },"
  );

  fs.writeFileSync('frontend/src/components/Layout.jsx', c);
}
