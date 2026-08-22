const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

// Remove the SECOND handleLangChange that I injected
c = c.replace(/const handleLangChange = \(lang\) => \{[\s\S]*?console\.log\(e\)\);\n    \};\n\n/g, '');

// Modify the ORIGINAL handleLangChange to use i18n
c = c.replace(
  "const handleLangChange = async (lang) => {\n      setLanguage(lang);\n      localStorage.setItem('preferredLanguage', lang);",
  "const handleLangChange = async (lang) => {\n      setLanguage(lang);\n      i18n.changeLanguage(lang);\n      localStorage.setItem('preferredLanguage', lang);"
);

fs.writeFileSync('frontend/src/components/Layout.jsx', c);
