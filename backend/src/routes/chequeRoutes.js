const express = require('express');
const router = express.Router();
const chequeController = require('../controllers/chequeController');

// GET /api/cheques - List all cheques with filtering
router.get('/', chequeController.getAllCheques);

// GET /api/cheques/balance/available - Get available bank balance for a ledger head
router.get('/balance/available', chequeController.getAvailableBankBalance);

// GET /api/cheques/:id - Get a single cheque by ID
router.get('/:id', chequeController.getChequeById);

// PUT /api/cheques/:id/clear - Mark a cheque as cleared
router.put('/:id/clear', chequeController.clearCheque);

// PUT /api/cheques/:id/cancel - Cancel a cheque
router.put('/:id/cancel', chequeController.cancelCheque);

// POST /api/cheques/fix-missing - Fix missing cheque records
router.post('/fix-missing', chequeController.fixMissingChequeRecords);

module.exports = router; 