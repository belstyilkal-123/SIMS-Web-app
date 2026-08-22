const fs = require('fs');
let c = fs.readFileSync('frontend/index.html', 'utf8');

if (!c.includes('translate.google.com')) {
  c = c.replace(
    "</body>",
    "  <script type=\"text/javascript\">\n      function googleTranslateElementInit() {\n        new google.translate.TranslateElement({pageLanguage: 'en', includedLanguages: 'am,en', layout: google.translate.TranslateElement.InlineLayout.SIMPLE}, 'google_translate_element');\n      }\n    </script>\n    <script type=\"text/javascript\" src=\"//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit\"></script>\n  </body>"
  );
  fs.writeFileSync('frontend/index.html', c);
}
