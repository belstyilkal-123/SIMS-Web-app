const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

if (!c.includes('id="google_translate_element"')) {
  c = c.replace(
    "<div className=\"si-topbar-right\">",
    "<div className=\"si-topbar-right\">\n          {/* Google Translate Dropdown */}\n          <div id=\"google_translate_element\" style={{ display: 'inline-block', marginTop: '4px', marginRight: '8px' }}></div>"
  );
  fs.writeFileSync('frontend/src/components/Layout.jsx', c);
}
