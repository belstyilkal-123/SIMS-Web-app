const mongoose = require('mongoose');

const assignmentRequestSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['farm_farmer', 'farm_labor'],
    required: true
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  farmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('AssignmentRequest', assignmentRequestSchema);
