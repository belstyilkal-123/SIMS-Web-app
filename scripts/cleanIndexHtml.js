const fs = require('fs');
let c = fs.readFileSync('frontend/index.html', 'utf8');

c = c.replace(/<script type="text\/javascript">\s*function googleTranslateElementInit\(\) \{[\s\S]*?<\/script>\s*<script type="text\/javascript" src="\/\/translate.google.com\/translate_a\/element.js\?cb=googleTranslateElementInit"><\/script>/, '');

fs.writeFileSync('frontend/index.html', c);
