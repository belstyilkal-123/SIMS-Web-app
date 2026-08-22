const express = require('express');
const router = express.Router();
const {
  getAssignments,
  assignFarmer,
  unassignFarmer,
  getFarmFarmers,
  getAvailableFarmers
} = require('../controllers/farmAssignmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication and Owner role
router.use(protect);
router.use(authorize('owner', 'office_manager'));

// ── GET /api/farm-assignments — Get all assignments ──────────────────────────
router.get('/', getAssignments);

// ── GET /api/farm-assignments/available-farmers — Get unassigned farmers ─────
router.get('/available-farmers', getAvailableFarmers);

// ── GET /api/farm-assignments/farm/:farmId/farmers — Farmers on a farm ───────
router.get('/farm/:farmId/farmers', getFarmFarmers);

// ── POST /api/farm-assignments — Assign farmer to farm ───────────────────────
router.post('/', assignFarmer);

// ── DELETE /api/farm-assignments/:farmerId — Unassign farmer ─────────────────
router.delete('/:farmerId', unassignFarmer);

module.exports = router;

