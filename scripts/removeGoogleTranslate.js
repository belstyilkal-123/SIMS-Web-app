const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

c = c.replace(/import GoogleTranslate from '.\/GoogleTranslate';\n/g, '');
c = c.replace(/<GoogleTranslate \/>\n/g, '');

fs.writeFileSync('frontend/src/components/Layout.jsx', c);
if (fs.existsSync('frontend/src/components/GoogleTranslate.jsx')) {
  fs.unlinkSync('frontend/src/components/GoogleTranslate.jsx');
}
