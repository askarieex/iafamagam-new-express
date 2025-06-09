const express = require('express');
const router = express.Router();
const monthlyClosureController = require('../controllers/monthlyClosureController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Get all accounts with their closure status
router.get('/status', protect, monthlyClosureController.getClosureStatus);

// Close an accounting period
router.post('/close', protect, authorize('admin'), monthlyClosureController.closeAccountingPeriod);

// Open a specific accounting period (will close any currently open periods)
router.post('/open', protect, authorize('admin'), monthlyClosureController.openAccountingPeriod);

// Get the currently open period for an account
router.get('/open-period', protect, monthlyClosureController.getOpenPeriod);

// Force close current month for a specific account
router.post('/force-close-current', protect, authorize('admin'), monthlyClosureController.forceCloseCurrentMonth);

// Reopen a previously closed accounting period by setting a new last_closed_date
router.post('/reopen', protect, authorize('admin'), monthlyClosureController.reopenPeriod);

// Recalculate monthly snapshots after backdated transaction
router.post('/recalculate', protect, authorize('admin'), monthlyClosureController.recalculateSnapshots);

// Get period closure history for an account
router.get('/history', protect, authorize('admin'), monthlyClosureController.getPeriodHistory);

module.exports = router;