const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const immutableTransactionController = require('../controllers/immutableTransactionController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes - none

// ===== NEW IMMUTABLE TRANSACTION SYSTEM =====
// Create transactions (Immutable - No edits allowed)
router.post('/credit', protect, immutableTransactionController.createCredit);
router.post('/debit', protect, immutableTransactionController.createDebit);

// Enhanced transaction queries
router.get('/history', protect, immutableTransactionController.getTransactionHistory);
router.get('/balance', protect, immutableTransactionController.getBalanceSummary);
router.get('/balance/live', protect, immutableTransactionController.getLiveBalanceSummary);
router.get('/integrity/verify', protect, authorize(['admin']), immutableTransactionController.verifySystemIntegrity);
router.post('/validate-date', protect, immutableTransactionController.validateTransactionDate);

// Monthly report endpoints (temporary placement)
const simpleMonthlyController = require('../controllers/simpleMonthlyReportController');
router.get('/monthly-report/:year/:month/:accountId', protect, simpleMonthlyController.generateMonthlyReport);
router.get('/available-months/:accountId', protect, simpleMonthlyController.getAvailableMonths);

// ===== LEGACY SYSTEM (Gradually being replaced) =====
// OLD Create transactions (Will be deprecated)
// router.post('/credit', protect, transactionController.createCredit);
// router.post('/debit', protect, transactionController.createDebit);

// Get data
router.get('/balances/date', protect, transactionController.getBalancesForDate);
router.get('/snapshot', protect, transactionController.getSnapshotForDate);
router.get('/snapshot/ledger', protect, transactionController.getLedgerSnapshotForDate);
router.get('/', protect, transactionController.getTransactions);
router.get('/:id', protect, transactionController.getTransactionById);

// ===== BLOCKED DANGEROUS ROUTES (Security Protection) =====
// These routes are BLOCKED to prevent security risks
router.put('/:id', protect, immutableTransactionController.blockedUpdateTransaction);
router.delete('/:id', protect, immutableTransactionController.blockedDeleteTransaction);

// ❌ OLD DANGEROUS ROUTES EXPLANATION:
// ❌ router.put('/:id') - UPDATE/EDIT transactions (SECURITY RISK - CAN HIDE OVERDRAFTS)
// ❌ router.delete('/:id') - DELETE/VOID transactions (SECURITY RISK - DESTROYS AUDIT TRAIL)
// ✅ NEW APPROACH: Use correction workflow instead (maintains complete audit trail)

module.exports = router; 