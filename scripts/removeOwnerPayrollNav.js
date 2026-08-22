const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

c = c.replace(/\{\s*path:'\/owner\/payroll',\s*icon:'💰',\s*label:'Payroll'\s*\},\n?\s*/g, '');
c = c.replace(/\{\s*path:'\/owner\/payroll',\s*icon:'💰',\s*label:'ደሞዝ'\s*\},\n?\s*/g, '');

fs.writeFileSync('frontend/src/components/Layout.jsx', c);
