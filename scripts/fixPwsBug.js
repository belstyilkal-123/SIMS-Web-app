const fs = require('fs');
let c = fs.readFileSync('frontend/src/pages/officemanager/WorkforceAllocation.jsx', 'utf8');

c = c.replace(
  "const cfg = { headers: { Authorization: \\Bearer \\\\ } };",
  "const cfg = { headers: { Authorization: \Bearer \\ } };"
);

c = c.replace(
  "axios.get(\\\\API_URL/api/farms\\\\, cfg)",
  "axios.get(\\/api/farms\, cfg)"
);

c = c.replace(
  "axios.get(\\\\API_URL/api/admin/users?role=labor\\\\, cfg)",
  "axios.get(\\/api/admin/users?role=labor\, cfg)"
);

c = c.replace(
  "axios.get(\\\\API_URL/api/farms/available-labor/all\\\\, cfg)",
  "axios.get(\\/api/farms/available-labor/all\, cfg)"
);

c = c.replace(
  "await axios.post(\\\\API_URL/api/farms/\\formData.farmId\\/labor\\\\, { userId: formData.userId }, cfg);",
  "await axios.post(\\/api/farms/\/labor\, { userId: formData.userId }, cfg);"
);

fs.writeFileSync('frontend/src/pages/officemanager/WorkforceAllocation.jsx', c);
