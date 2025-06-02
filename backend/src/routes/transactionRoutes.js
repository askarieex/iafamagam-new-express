const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authMiddleware');

// Public routes - none

// Protected routes for all authenticated users
// Create transactions
router.post('/credit', protect, transactionController.createCredit);
router.post('/debit', protect, transactionController.createDebit);

// Get data
router.get('/balances/date', protect, transactionController.getBalancesForDate);
router.get('/', protect, transactionController.getTransactions);
router.get('/:id', protect, transactionController.getTransactionById);

// Admin-only routes for sensitive operations
router.put('/:id', protect, authorize('admin'), transactionController.updateTransaction);
router.delete('/:id', protect, authorize('admin'), transactionController.voidTransaction);

module.exports = router; 