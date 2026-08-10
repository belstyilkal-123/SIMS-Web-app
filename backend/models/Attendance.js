const mongoose = require('mongoose');

/**
 * Attendance — daily check-in / check-out record for a labour worker.
 * Created automatically on check-in; check-out updates the same record.
 */
const AttendanceSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  farmId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  date:        { type: String, required: true }, // YYYY-MM-DD — one record per user per day
  checkIn:     { type: Date },
  checkOut:    { type: Date },
  hoursWorked: { type: Number, default: 0 },     // computed on check-out
  status:      { type: String, enum: ['present', 'absent', 'late', 'half_day'], default: 'present' },
  markedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // admin who overrode
  notes:       { type: String, default: '' },
}, { timestamps: true });

// Enforce one record per user per day
AttendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ farmId: 1, date: 1 });

module.exports = mongoose.model('Attendance', AttendanceSchema);
