const fs = require('fs');
let c = fs.readFileSync('frontend/src/pages/owner/OwnerDashboard.jsx', 'utf8');

if (!c.includes('useTranslation')) {
  c = c.replace(
    "import { Link } from 'react-router-dom';",
    "import { Link } from 'react-router-dom';\nimport { useTranslation } from 'react-i18next';"
  );
  
  c = c.replace(
    "const { user } = useContext(AuthContext);",
    "const { user } = useContext(AuthContext);\n  const { t } = useTranslation();"
  );
  
  c = c.replace("<h2>👑 Business Overview</h2>", "<h2>{t('owner_dash.title')}</h2>");
  c = c.replace("<p className=\"ow-subtitle\">Organization-wide performance and workforce summary.</p>", "<p className=\"ow-subtitle\">{t('owner_dash.subtitle')}</p>");
  c = c.replace("<h3>👥 Workforce Summary</h3>", "<h3>{t('owner_dash.workforce_summary')}</h3>");
  c = c.replace("<h3>👤 Active Staff</h3>", "<h3>{t('owner_dash.active_staff')}</h3>");
  c = c.replace("<h3>🔗 Quick Actions</h3>", "<h3>{t('owner_dash.quick_actions')}</h3>");
  
  fs.writeFileSync('frontend/src/pages/owner/OwnerDashboard.jsx', c);
}
