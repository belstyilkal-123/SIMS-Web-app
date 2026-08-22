const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

c = c.replace(/import GoogleTranslate from '\.\/GoogleTranslate';/g, '');
c = c.replace(/import GoogleTranslate from "\.\/GoogleTranslate";/g, '');
c = c.replace(/<GoogleTranslate \/>/g, '');

fs.writeFileSync('frontend/src/components/Layout.jsx', c);
