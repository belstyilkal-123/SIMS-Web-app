const fs = require('fs');
let c = fs.readFileSync('frontend/src/pages/expenses/ExpenseRequests.jsx', 'utf8');

c = c.replace(
  "const canCreate = isOwner || isOM || isFarmer;",
  "const canCreate = isOM || isFarmer;"
);

c = c.replace(
  "<h2>💵 Expense Requests</h2>",
  "<h2>{isOwner ? '✅ Expense Request Approval' : '💵 Expense Requests'}</h2>"
);

fs.writeFileSync('frontend/src/pages/expenses/ExpenseRequests.jsx', c);
