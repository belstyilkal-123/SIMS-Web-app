const fs = require('fs');
let content = fs.readFileSync('backend/routes/auth.js', 'utf8');

// Replace the response in forgot-password to securely log the link instead of returning it
content = content.replace(
  /return res\.json\(\{ message: 'Reset link generated \(dev\)', resetUrl \}\);/,
  "console.log(`[DEV MODE] Password Reset Link for ${user.email}: ${resetUrl}`);\n    return res.json({ message: 'If that email is in our system, a reset link has been sent.' });"
);

fs.writeFileSync('backend/routes/auth.js', content, 'utf8');
