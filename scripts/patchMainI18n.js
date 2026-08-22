const fs = require('fs');
let c = fs.readFileSync('frontend/src/main.jsx', 'utf8');

if (!c.includes('./i18n')) {
  c = c.replace(
    "import App from './App.jsx'",
    "import App from './App.jsx'\nimport './i18n';"
  );
  fs.writeFileSync('frontend/src/main.jsx', c);
}
