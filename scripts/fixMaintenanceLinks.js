const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

c = c.replace(/path:'\/maintenance\/farm'/g, "path:'/maintenance'");
c = c.replace(/path:'\/maintenance\/labour'/g, "path:'/maintenance'");

fs.writeFileSync('frontend/src/components/Layout.jsx', c);
