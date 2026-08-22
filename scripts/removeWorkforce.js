const fs = require('fs');

// 1. Remove from App.jsx
let app = fs.readFileSync('frontend/src/App.jsx', 'utf8');
app = app.replace("const WorkforceAllocation= lazy(() => import('./pages/officemanager/WorkforceAllocation'));\n", "");
app = app.replace(/<Route path="\/office\/workforce".*?\/>\n\s*/g, "");
fs.writeFileSync('frontend/src/App.jsx', app);

// 2. Remove from Layout.jsx
let layout = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');
layout = layout.replace(/\{\s*path:'\/office\/workforce',\s*icon:'👷',\s*label:'Workforce Allocation'\s*\},\n?\s*/g, "");
layout = layout.replace(/\{\s*path:'\/office\/workforce',\s*icon:'👷',\s*label:'የሰው ኃይል ምደባ'\s*\},\n?\s*/g, "");
fs.writeFileSync('frontend/src/components/Layout.jsx', layout);

// 3. Delete the file
if (fs.existsSync('frontend/src/pages/officemanager/WorkforceAllocation.jsx')) {
  fs.unlinkSync('frontend/src/pages/officemanager/WorkforceAllocation.jsx');
}

