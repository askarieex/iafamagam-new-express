const express = require('express');
const router = express.Router();
const reconciliationController = require('../controllers/reconciliationController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Routes for manual reconciliation (admin only)
router.post('/balances', protect, authorize('admin'), reconciliationController.triggerBalanceReconciliation);

// Get reconciliation history
router.get('/history', protect, authorize('admin'), reconciliationController.getReconciliationHistory);

module.exports = router; 