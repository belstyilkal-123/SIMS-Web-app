const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

c = c.replace(
  "{ path:'/expenses',          icon:'💵', label:'Expenses' },\n          { path:'/reports/financial'",
  "{ path:'/expenses',          icon:'✅', label:'Expense Approvals' },\n          { path:'/reports/financial'"
);

c = c.replace(
  "{ path:'/expenses',          icon:'💵', label:'ወጪዎች' },\n            { path:'/reports/financial'",
  "{ path:'/expenses',          icon:'✅', label:'Expense Approvals' },\n            { path:'/reports/financial'"
);

fs.writeFileSync('frontend/src/components/Layout.jsx', c);
