const express = require('express');
const monthlyClosureController = require('../controllers/monthlyClosureController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authMiddleware');
const router = express.Router();

// All users can view closure status
router.get('/status', protect, monthlyClosureController.getClosureStatus);

// Admin-only routes for sensitive operations
router.post('/close', protect, authorize('admin'), monthlyClosureController.closeAccountingPeriod);
router.post('/reopen', protect, authorize('admin'), monthlyClosureController.reopenPeriod);
router.post('/recalculate', protect, authorize('admin'), monthlyClosureController.recalculateSnapshots);
router.post('/force-close-current', protect, authorize('admin'), monthlyClosureController.forceCloseCurrentMonth);

module.exports = router; 