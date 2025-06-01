const express = require('express');
const monthlyClosureController = require('../controllers/monthlyClosureController');
const router = express.Router();

// Close an accounting period
router.post('/close', monthlyClosureController.closeAccountingPeriod);

// Reopen a closed period
router.post('/reopen', monthlyClosureController.reopenPeriod);

// Recalculate snapshots after backdated transaction
router.post('/recalculate', monthlyClosureController.recalculateSnapshots);

// Get account closure status
router.get('/status', monthlyClosureController.getClosureStatus);

module.exports = router; 