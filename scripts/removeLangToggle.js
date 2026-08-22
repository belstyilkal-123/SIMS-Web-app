const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

c = c.replace(/<div className="si-lang-toggle".*?<\/div>\s*/s, '');
fs.writeFileSync('frontend/src/components/Layout.jsx', c);
