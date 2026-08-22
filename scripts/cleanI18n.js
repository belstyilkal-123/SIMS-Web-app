const fs = require('fs');

let cDash = fs.readFileSync('frontend/src/pages/owner/OwnerDashboard.jsx', 'utf8');
cDash = cDash.replace("import { useTranslation } from 'react-i18next';\n", "");
cDash = cDash.replace("const { t } = useTranslation();\n", "");
cDash = cDash.replace("{t('owner_dash.title')}", "👑 Business Overview");
cDash = cDash.replace("{t('owner_dash.subtitle')}", "Organization-wide performance and workforce summary.");
cDash = cDash.replace("{t('owner_dash.workforce_summary')}", "👥 Workforce Summary");
cDash = cDash.replace("{t('owner_dash.active_staff')}", "👤 Active Staff");
cDash = cDash.replace("{t('owner_dash.quick_actions')}", "🔗 Quick Actions");
fs.writeFileSync('frontend/src/pages/owner/OwnerDashboard.jsx', cDash);

let cMain = fs.readFileSync('frontend/src/main.jsx', 'utf8');
cMain = cMain.replace("import './i18n';\n", "");
fs.writeFileSync('frontend/src/main.jsx', cMain);

