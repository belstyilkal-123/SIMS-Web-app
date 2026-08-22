const fs = require('fs');
let c = fs.readFileSync('backend/controllers/farmAssignmentController.js', 'utf8');

c = c.replace(
  "const assignFarmer = async (req, res) => {",
  "const AssignmentRequest = require('../models/AssignmentRequest');\nconst assignFarmer = async (req, res) => {"
);

c = c.replace(
  "const updated = await User.findByIdAndUpdate(",
  "const role = req.user.assignedRole || req.user.role;\n    if (role === 'office_manager') {\n      await AssignmentRequest.create({ type: 'farm_farmer', targetUserId: farmerId, farmId, requestedBy: req.user._id });\n      return res.json({ message: 'Assignment request submitted for owner approval' });\n    }\n    const updated = await User.findByIdAndUpdate("
);

fs.writeFileSync('backend/controllers/farmAssignmentController.js', c);
