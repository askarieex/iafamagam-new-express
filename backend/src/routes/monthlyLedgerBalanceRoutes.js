const express = require('express');
const router = express.Router();
const monthlyLedgerBalanceController = require('../controllers/monthlyLedgerBalanceController');

// GET all monthly ledger balances (with optional filtering)
router.get('/', monthlyLedgerBalanceController.getAllMonthlyBalances);

// GET single monthly balance by ID
router.get('/:id', monthlyLedgerBalanceController.getMonthlyBalanceById);

// POST create new monthly balance
router.post('/', monthlyLedgerBalanceController.createMonthlyBalance);

// POST generate monthly balances for all ledger heads for a specific month
router.post('/generate', monthlyLedgerBalanceController.generateMonthlyBalances);

// PATCH update existing monthly balance
router.patch('/:id', monthlyLedgerBalanceController.updateMonthlyBalance);

// DELETE monthly balance
router.delete('/:id', monthlyLedgerBalanceController.deleteMonthlyBalance);

module.exports = router; 