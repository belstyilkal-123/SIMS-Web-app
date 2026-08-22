const fs = require('fs');
let lines = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("roles: ['owner']")) {
    if (lines[i+2].includes("path:'/expenses'")) {
      lines[i+2] = lines[i+2].replace("'💵'", "'✅'").replace("'Expenses'", "'Expense Approvals'").replace("'ወጪዎች'", "'Expense Approvals'");
    }
  }
}

fs.writeFileSync('frontend/src/components/Layout.jsx', lines.join('\n'));
