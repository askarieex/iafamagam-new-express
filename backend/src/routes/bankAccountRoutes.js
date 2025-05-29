const express = require('express');
const router = express.Router();
const bankAccountController = require('../controllers/bankAccountController');

// GET all bank accounts
router.get('/', bankAccountController.getAllBankAccounts);

// GET single bank account by ID
router.get('/:id', bankAccountController.getBankAccountById);

// POST create new bank account
router.post('/', bankAccountController.createBankAccount);

// PATCH update existing bank account
router.patch('/:id', bankAccountController.updateBankAccount);

// DELETE bank account
router.delete('/:id', bankAccountController.deleteBankAccount);

module.exports = router; 