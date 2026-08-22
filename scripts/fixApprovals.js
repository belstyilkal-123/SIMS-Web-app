const fs = require('fs');
let c = fs.readFileSync('frontend/src/pages/owner/PendingApprovals.jsx', 'utf8');

c = c.replace(
  "{req.type === 'farm_farmer' ? 'FARM ASSIGNMENT' : 'LABOUR ASSIGNMENT'}",
  "FARM ASSIGNMENT"
);

fs.writeFileSync('frontend/src/pages/owner/PendingApprovals.jsx', c);
