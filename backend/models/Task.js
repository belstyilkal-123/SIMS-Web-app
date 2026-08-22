const mongoose = require('mongoose');

/**
 * Task — Hierarchical assignment system
 *
 * Assignment rules (enforced in controller):
 *   owner          → office_manager, farmer
 *   office_manager → farmer, labor
 *   farmer         → labor (on their assigned farm only)
 *   labor          → nobody
 *
 * Farm-level authorization is enforced in the controller.
 */
const TaskSchema = new mongoose.Schema(
  {
    title:        { type: String, required: true, trim: true },
    description:  { type: String, default: '' },

    /* who assigned & who receives */
    created_by:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    /* farm context */
    farmId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' },

    /* lifecycle */
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled', 'overdue'],
      default: 'pending',
    },

    /* priority — now includes 'urgent' */
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },

    /* dates */
    deadline:    { type: Date },
    startedAt:   { type: Date },           // when assignee clicked Start
    completedAt: { type: Date },

    /* completion */
    completedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    completionNotes: { type: String, default: '' },  // assignee adds on completion

    /* progress 0-100 */
    progress: { type: Number, default: 0, min: 0, max: 100 },

    /* general notes added by creator */
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

/* ── Indexes ──────────────────────────────────────────────────────────────── */
TaskSchema.index({ assignedTo: 1, status: 1 });
TaskSchema.index({ created_by: 1, status: 1 });
TaskSchema.index({ farmId: 1,    status: 1 });
TaskSchema.index({ deadline: 1 });

module.exports = mongoose.model('Task', TaskSchema);
