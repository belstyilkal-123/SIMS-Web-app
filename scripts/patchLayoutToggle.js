const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

if (!c.includes('useTranslation')) {
  c = c.replace(
    "import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';",
    "import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';\nimport { useTranslation } from 'react-i18next';"
  );
  
  c = c.replace(
    "const [refreshing, setRefreshing]             = useState(false);",
    "const [refreshing, setRefreshing]             = useState(false);\n    const { t, i18n } = useTranslation();"
  );
  
  c = c.replace(
    "const handleRefresh = () => {",
    "const handleLangChange = (lang) => {\n      setLanguage(lang);\n      i18n.changeLanguage(lang);\n      localStorage.setItem('preferredLanguage', lang);\n      axios.put('" + "/api/auth/profile" + "', { language: lang }, { headers: { Authorization: 'Bearer ' + user.token } }).catch(e=>console.log(e));\n    };\n\n    const handleRefresh = () => {"
  );
  
  const toggleCode = "<div className=\"si-lang-toggle\" role=\"group\" aria-label=\"Language\">\n              <button className={language === 'en' ? 'active' : ''} onClick={() => handleLangChange('en')} aria-pressed={language === 'en'}>EN</button>\n              <button className={language === 'am' ? 'active' : ''} onClick={() => handleLangChange('am')} aria-pressed={language === 'am'}>አማ</button>\n            </div>\n            {/* Profile dropdown */}\n            <div className=\"si-profile-wrap\"";
  
  c = c.replace(
    "<div className=\"si-profile-wrap\"",
    toggleCode
  );
}
fs.writeFileSync('frontend/src/components/Layout.jsx', c);
