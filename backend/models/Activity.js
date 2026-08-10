const mongoose = require('mongoose');

/**
 * Activity — a task assigned by an administrator to one or more labour users.
 * Examples: "Irrigate Field A", "Check pump pressure", "Apply fertilizer"
 */
const ActivitySchema = new mongoose.Schema({
  farmId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  assignedTo:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // labour workers
  assignedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // administrator
  dueDate:     { type: Date },
  priority:    { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  status:      { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
  completedAt: { type: Date },
  notes:       { type: String, default: '' },
}, { timestamps: true });

ActivitySchema.index({ farmId: 1, status: 1 });
ActivitySchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('Activity', ActivitySchema);
