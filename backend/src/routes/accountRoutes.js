const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');

// Create a new account
router.post('/', accountController.createAccount);

// Get all accounts
router.get('/', accountController.getAllAccounts);

// Synchronize all account balances with their ledger heads
router.post('/sync-balances', accountController.syncAccountBalances);

// Get account balance summary with ledger head details
router.get('/:id/balance-summary', accountController.getAccountBalanceSummary);

// Get a single account by ID
router.get('/:id', accountController.getAccountById);

// Update an account
router.patch('/:id', accountController.updateAccount);

// Delete an account
router.delete('/:id', accountController.deleteAccount);

module.exports = router; 