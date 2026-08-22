const fs = require('fs');
let c = fs.readFileSync('frontend/src/App.jsx', 'utf8');

c = c.replace(/const OwnerPayments.*?;\n/g, '');
c = c.replace(/<Route path="\/owner\/payments".*?\/>\n/g, '');

fs.writeFileSync('frontend/src/App.jsx', c);
if (fs.existsSync('frontend/src/pages/owner/OwnerPayments.jsx')) {
  fs.unlinkSync('frontend/src/pages/owner/OwnerPayments.jsx');
}
