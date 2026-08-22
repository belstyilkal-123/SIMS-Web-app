const fs = require('fs');
let c = fs.readFileSync('backend/routes/farms.js', 'utf8');

if (!c.includes('AssignmentRequest')) {
  c = "const AssignmentRequest = require('../models/AssignmentRequest');\n" + c;
}

c = c.replace(
  "await User.findByIdAndUpdate(userId, { farmId: farm._id }, { runValidators: false });",
  "if (role === OM) {\n      await AssignmentRequest.create({ type: 'farm_labor', targetUserId: userId, farmId: farm._id, requestedBy: req.user._id });\n      return res.json({ message: 'Labor assignment request submitted for owner approval' });\n    }\n    await User.findByIdAndUpdate(userId, { farmId: farm._id }, { runValidators: false });"
);

fs.writeFileSync('backend/routes/farms.js', c);
