const mongoose = require('mongoose');
const Attendance = require('./backend/models/Attendance');
mongoose.connect('mongodb://127.0.0.1:27017/sims', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const r = await Attendance.find().populate('userId', 'name email').lean().limit(2);
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  });
