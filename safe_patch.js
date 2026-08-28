const fs = require('fs');
let content = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

// Replace in profile info
content = content.replace(
  /\{meta\.icon\}\s*\{roleLabel\}/,
  "{role === 'admin' ? <img src=\"/admin-icon.png\" alt=\"admin\" style={{width: '1em', height: '1em', verticalAlign: 'middle'}}/> : meta.icon} {roleLabel}"
);

// Replace in role banner
content = content.replace(
  /<span style=\{\{ fontSize: '1.1rem' \}\}>\{meta\.icon\}<\/span>/,
  "<span style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center' }}>{role === 'admin' ? <img src=\"/admin-icon.png\" alt=\"admin\" style={{width: '1.2em', height: '1.2em'}}/> : meta.icon}</span>"
);

// Replace in sidebar nav items
content = content.replace(
  /<span className="si-nav-icon">\{item\.icon\}<\/span>/g,
  "<span className=\"si-nav-icon\">{item.icon === '🛡️' ? <img src=\"/admin-icon.png\" alt=\"admin\" style={{width: '1.2em', height: '1.2em', verticalAlign: 'middle'}}/> : item.icon}</span>"
);

// Replace in pageTitle template literal (if present)
content = content.replace(
  /const pageTitle = active \? `\$\{active\.icon\} \$\{active\.label\}` : '📊 Dashboard';/,
  "const pageTitle = active ? ( <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}> {active.icon === '🛡️' ? <img src=\"/admin-icon.png\" alt=\"admin\" style={{width: '1.2em', height: '1.2em', verticalAlign: 'middle'}}/> : active.icon} {active.label} </span> ) : '📊 Dashboard';"
);

fs.writeFileSync('frontend/src/components/Layout.jsx', content, 'utf8');
