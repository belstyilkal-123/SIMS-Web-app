const fs = require('fs');
let c = fs.readFileSync('frontend/src/pages/officemanager/WorkforceAllocation.jsx', 'utf8');

c = c.replace(
  "const pendingUserIds = reqRes.data.map(r => r.targetUserId?._id || r.targetUserId);",
  "const pendingUserIds = reqRes.data.map(r => String(r.targetUserId?._id || r.targetUserId));"
);

c = c.replace(
  "const trulyAvailable = aRes.data.filter(u => !pendingUserIds.includes(u._id));",
  "const trulyAvailable = aRes.data.filter(u => !pendingUserIds.includes(String(u._id)));"
);

c = c.replace(
  "const isPending = pendingRequests.some(r => r.targetUserId?._id === u._id || r.targetUserId === u._id);",
  "const isPending = pendingRequests.some(r => String(r.targetUserId?._id || r.targetUserId) === String(u._id));"
);

c = c.replace(
  "const pendingReq = pendingRequests.find(r => r.targetUserId?._id === u._id || r.targetUserId === u._id);",
  "const pendingReq = pendingRequests.find(r => String(r.targetUserId?._id || r.targetUserId) === String(u._id));"
);

fs.writeFileSync('frontend/src/pages/officemanager/WorkforceAllocation.jsx', c);
