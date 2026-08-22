const express = require('express');
const router  = express.Router();
const {
  getAssignableUsers,
  getTaskStats,
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  updateStatus,
  deleteTask,
} = require('../controllers/taskController');
const { protect, authorize } = require('../middleware/authMiddleware');

const ALL = ['owner', 'admin', 'office_manager', 'farmer', 'labor'];
const CAN_ASSIGN = ['owner', 'office_manager', 'farmer'];   // labor cannot create

router.use(protect);

// ── Utility ──────────────────────────────────────────────────────────────────
// GET /api/tasks/assignable-users  — list users current user can assign to
router.get('/assignable-users', authorize(...CAN_ASSIGN), getAssignableUsers);

// GET /api/tasks/stats
router.get('/stats', authorize(...ALL), getTaskStats);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get('/',    authorize(...ALL),        getTasks);
router.get('/:id', authorize(...ALL),        getTaskById);
router.post('/',   authorize(...CAN_ASSIGN), createTask);
router.put('/:id', authorize(...CAN_ASSIGN), updateTask);

// ── Status transition (assignee or creator) ───────────────────────────────────
// PATCH /api/tasks/:id/status  { status, completionNotes? }
router.patch('/:id/status', authorize(...ALL), updateStatus);

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id', authorize(...CAN_ASSIGN), deleteTask);

module.exports = router;
