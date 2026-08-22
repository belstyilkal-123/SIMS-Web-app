const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

c = c.replace(
  "roles: ['owner'],\n        items: [\n          { path:'/expenses',          icon:'💵', label:'Expenses' },",
  "roles: ['owner'],\n        items: [\n          { path:'/expenses',          icon:'✅', label:'Expense Approvals' },"
);

c = c.replace(
  "roles: ['owner'],\n          items: [\n            { path:'/expenses',          icon:'💵', label:'ወጪዎች' },",
  "roles: ['owner'],\n          items: [\n            { path:'/expenses',          icon:'✅', label:'ወጪ ማረጋገጫዎች' },"
);

fs.writeFileSync('frontend/src/components/Layout.jsx', c);
