/**
 * Snapshot View Routes
 *
 * Routes for viewing monthly balance snapshots
 */

const express = require('express');
const router = express.Router();
const snapshotViewController = require('../controllers/snapshotViewController');

/**
 * @route GET /api/reports/monthly-snapshots/:accountId/:year/:month
 * @desc Get monthly balance snapshots for a specific account and month
 * @access Private
 * @param {number} accountId - Account ID
 * @param {number} year - Year (e.g., 2025)
 * @param {number} month - Month (1-12)
 * @example GET /api/reports/monthly-snapshots/25/2025/9
 */
router.get('/monthly-snapshots/:accountId/:year/:month', snapshotViewController.getMonthlySnapshots);

/**
 * @route GET /api/reports/available-months/:accountId
 * @desc Get all available months for an account (for dropdown population)
 * @access Private
 * @param {number} accountId - Account ID
 * @example GET /api/reports/available-months/25
 */
router.get('/available-months/:accountId', snapshotViewController.getAvailableMonths);

/**
 * @route POST /api/reports/regenerate-snapshots/:accountId/:year/:month
 * @desc Force regenerate snapshots for a specific month
 * @access Private
 * @param {number} accountId - Account ID
 * @param {number} year - Year (e.g., 2025)
 * @param {number} month - Month (1-12)
 * @example POST /api/reports/regenerate-snapshots/25/2025/9
 */
router.post('/regenerate-snapshots/:accountId/:year/:month', snapshotViewController.regenerateSnapshots);

module.exports = router;