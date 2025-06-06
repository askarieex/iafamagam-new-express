const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes - none

// Protected routes for all authenticated users
// Create transactions
router.post('/credit', protect, transactionController.createCredit);
router.post('/debit', protect, transactionController.createDebit);

// Get data
router.get('/balances/date', protect, transactionController.getBalancesForDate);
router.get('/', protect, transactionController.getTransactions);
router.get('/:id', protect, transactionController.getTransactionById);

// Routes that require specific permissions
router.put('/:id', protect, authorize(['admin', 'transactions']), transactionController.updateTransaction);
router.delete('/:id', protect, authorize(['admin', 'transactions']), transactionController.voidTransaction);

module.exports = router; 