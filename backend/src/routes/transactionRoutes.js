const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

// Create a credit transaction
router.post('/credit', transactionController.createCredit);

// Create a debit transaction
router.post('/debit', transactionController.createDebit);

// Get balances for a specific date (for debit transaction form)
router.get('/balances/date', transactionController.getBalancesForDate);

// Get all transactions with pagination and filtering
router.get('/', transactionController.getAllTransactions);

// Get transaction by ID
router.get('/:id', transactionController.getTransactionById);

// Update a transaction
router.put('/:id', transactionController.updateTransaction);

// Void (delete) a transaction
router.delete('/:id', transactionController.voidTransaction);

// Get balances for a specific date (for debit transaction form)
router.get('/balances/date', transactionController.getBalancesForDate);

module.exports = router; 