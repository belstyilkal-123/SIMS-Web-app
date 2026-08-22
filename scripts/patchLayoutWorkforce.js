const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

c = c.replace(
  "{ path:'/farm-assignments',  icon:'🧑‍🌾', label:'Farm Assignments' },",
  "{ path:'/farm-assignments',  icon:'🧑‍🌾', label:'Farm Assignments' },\n          { path:'/office/workforce',  icon:'👷', label:'Workforce Allocation' },"
);

c = c.replace(
  "{ path:'/farm-assignments',  icon:'🧑‍🌾', label:'የእርሻ ምደባ' },",
  "{ path:'/farm-assignments',  icon:'🧑‍🌾', label:'የእርሻ ምደባ' },\n          { path:'/office/workforce',  icon:'👷', label:'የሰው ኃይል ምደባ' },"
);

fs.writeFileSync('frontend/src/components/Layout.jsx', c);
