const fs = require('fs');
let c = fs.readFileSync('frontend/src/App.jsx', 'utf8');
c = c.replace(/const FarmerMaintenance = lazy.*?;\n/g, '');
c = c.replace(/const LabourMaintenance = lazy.*?;\n/g, '');
c = c.replace(/<Route path="\/maintenance\/farm" .*?\/>\n/g, '');
c = c.replace(/<Route path="\/maintenance\/labour" .*?\/>\n/g, '');
fs.writeFileSync('frontend/src/App.jsx', c);
