const fs = require('fs');
let c = fs.readFileSync('frontend/src/i18n.js', 'utf8');

c = c.replace(
  '"business": "Business",\n        "operations": "Operations"\n      }',
  '"business": "Business",\n        "operations": "Operations"\n      },\n      "owner_dash": {\n        "title": "👑 Business Overview",\n        "subtitle": "Organization-wide performance and workforce summary.",\n        "workforce_summary": "👥 Workforce Summary",\n        "active_staff": "👤 Active Staff",\n        "quick_actions": "🔗 Quick Actions"\n      }'
);

c = c.replace(
  '"business": "ንግድ",\n        "operations": "ስራዎች"\n      }',
  '"business": "ንግድ",\n        "operations": "ስራዎች"\n      },\n      "owner_dash": {\n        "title": "👑 የንግድ አጠቃላይ እይታ",\n        "subtitle": "የድርጅቱ አጠቃላይ አፈፃፀም እና የሰው ሀይል ማጠቃለያ።",\n        "workforce_summary": "👥 የሰው ሀይል ማጠቃለያ",\n        "active_staff": "👤 ንቁ ሠራተኞች",\n        "quick_actions": "🔗 ፈጣን እርምጃዎች"\n      }'
);

fs.writeFileSync('frontend/src/i18n.js', c);
