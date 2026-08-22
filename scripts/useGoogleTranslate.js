const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

c = c.replace(
  "import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';",
  "import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';\nimport GoogleTranslate from './GoogleTranslate';"
);

c = c.replace(
  "<div id=\"google_translate_element\" style={{ display: 'inline-block', marginTop: '4px', marginRight: '8px' }}></div>",
  "<GoogleTranslate />"
);

fs.writeFileSync('frontend/src/components/Layout.jsx', c);
