const express = require('express');
const router = express.Router();
const ledgerHeadController = require('../controllers/ledgerHeadController');

// GET all ledger heads (with optional filtering by account_id)
router.get('/', ledgerHeadController.getAllLedgerHeads);

// GET single ledger head by ID
router.get('/:id', ledgerHeadController.getLedgerHeadById);

// POST create new ledger head
router.post('/', ledgerHeadController.createLedgerHead);

// PATCH update existing ledger head
router.patch('/:id', ledgerHeadController.updateLedgerHead);

// DELETE ledger head
router.delete('/:id', ledgerHeadController.deleteLedgerHead);

module.exports = router; 