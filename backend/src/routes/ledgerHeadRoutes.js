const express = require('express');
const router = express.Router();
const ledgerHeadController = require('../controllers/ledgerHeadController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authMiddleware');

// Protected routes for all authenticated users - read operations
router.get('/', protect, ledgerHeadController.getAllLedgerHeads);
router.get('/:id', protect, ledgerHeadController.getLedgerHeadById);

// Admin-only routes - write operations
router.post('/', protect, authorize('admin'), ledgerHeadController.createLedgerHead);
router.patch('/:id', protect, authorize('admin'), ledgerHeadController.updateLedgerHead);
router.delete('/:id', protect, authorize('admin'), ledgerHeadController.deleteLedgerHead);

module.exports = router; 