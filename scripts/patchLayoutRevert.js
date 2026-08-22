const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

c = c.replace(
  "import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';\nimport { useTranslation } from 'react-i18next';",
  "import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';\nimport GoogleTranslate from './GoogleTranslate';"
);

c = c.replace(
  "const [refreshing, setRefreshing]             = useState(false);\n    const { t, i18n } = useTranslation();",
  "const [refreshing, setRefreshing]             = useState(false);"
);

c = c.replace(
  /const handleLangChange = async \(lang\) => \{[\s\S]*?localStorage\.setItem\('preferredLanguage', lang\);\n    \};\n\n/,
  ""
);

c = c.replace(
  /<div className="si-lang-toggle" role="group" aria-label="Language">[\s\S]*?<\/div>\n            \{\/\* Profile dropdown \*\/\}/,
  "{/* Google Translate Widget */}\n            <GoogleTranslate />\n            {/* Profile dropdown */}"
);

fs.writeFileSync('frontend/src/components/Layout.jsx', c);
