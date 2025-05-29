const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');

// Create a new account
router.post('/', accountController.createAccount);

// Get all accounts
router.get('/', accountController.getAllAccounts);

// Get a single account by ID
router.get('/:id', accountController.getAccountById);

// Update an account
router.patch('/:id', accountController.updateAccount);

// Delete an account
router.delete('/:id', accountController.deleteAccount);

module.exports = router; 