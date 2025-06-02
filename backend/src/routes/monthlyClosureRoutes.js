const express = require('express');
const monthlyClosureController = require('../controllers/monthlyClosureController');
const router = express.Router();

// Close an accounting period
router.post('/close', monthlyClosureController.closeAccountingPeriod);

// Reopen a previously closed accounting period
router.post('/reopen', monthlyClosureController.reopenPeriod);

// Recalculate monthly snapshots after a backdated transaction
router.post('/recalculate', monthlyClosureController.recalculateSnapshots);

// Force close the current month immediately
router.post('/force-close-current', monthlyClosureController.forceCloseCurrentMonth);

// Get closure status
router.get('/status', monthlyClosureController.getClosureStatus);

module.exports = router; 