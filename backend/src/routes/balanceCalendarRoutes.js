/**
 * Balance Calendar Routes
 *
 * Routes for calendar-based balance viewing functionality
 */

const express = require('express');
const router = express.Router();
const balanceCalendarController = require('../controllers/balanceCalendarController');

/**
 * @route GET /api/reports/balance-by-date/:accountId
 * @desc Get credit head balances as of a specific date
 * @access Private
 * @param {number} accountId - Account ID
 * @query {string} date - Target date (YYYY-MM-DD format)
 * @example GET /api/reports/balance-by-date/25?date=2025-08-28
 */
router.get('/balance-by-date/:accountId', balanceCalendarController.getBalanceByDate);

/**
 * @route GET /api/reports/balance-history/:accountId/:ledgerHeadId
 * @desc Get balance history for a specific ledger head over a date range
 * @access Private
 * @param {number} accountId - Account ID
 * @param {number} ledgerHeadId - Ledger Head ID
 * @query {string} start_date - Start date (YYYY-MM-DD format)
 * @query {string} end_date - End date (YYYY-MM-DD format)
 * @example GET /api/reports/balance-history/25/85?start_date=2025-08-01&end_date=2025-08-31
 */
router.get('/balance-history/:accountId/:ledgerHeadId', balanceCalendarController.getBalanceHistory);

/**
 * @route GET /api/reports/ledger-balance/:accountId/:ledgerHeadId
 * @desc Get detailed balance information for a specific ledger head on a specific date
 * @access Private
 * @param {number} accountId - Account ID
 * @param {number} ledgerHeadId - Ledger Head ID
 * @query {string} date - Target date (YYYY-MM-DD format)
 * @example GET /api/reports/ledger-balance/25/85?date=2025-08-28
 */
router.get('/ledger-balance/:accountId/:ledgerHeadId', balanceCalendarController.getLedgerBalance);

module.exports = router;