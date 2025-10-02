/**
 * Monthly Report Routes
 *
 * API routes for monthly financial reporting functionality
 */

const express = require('express');
const router = express.Router();
const monthlyReportController = require('../controllers/simpleMonthlyReportController');
const snapshotViewController = require('../controllers/snapshotViewController');

// Auth middleware is applied at the app level in app.js, so not needed here

// Core monthly report routes
router.get('/monthly/:year/:month/:accountId', monthlyReportController.generateMonthlyReport.bind(monthlyReportController));
router.get('/available-months/:accountId', monthlyReportController.getAvailableMonths.bind(monthlyReportController));

// Snapshot management routes
router.get('/monthly-snapshots/:accountId/:year/:month', snapshotViewController.getMonthlySnapshots);
router.get('/snapshot-months/:accountId', snapshotViewController.getAvailableMonths);
router.post('/regenerate-snapshots/:accountId/:year/:month', snapshotViewController.regenerateSnapshots);

// Backfill routes
router.post('/backfill-snapshots/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { startYear, startMonth, endYear, endMonth } = req.body;

        // Validate parameters
        if (!accountId || isNaN(parseInt(accountId))) {
            return res.status(400).json({
                success: false,
                message: 'Valid account ID is required'
            });
        }

        if (!startYear || !startMonth || !endYear || !endMonth) {
            return res.status(400).json({
                success: false,
                message: 'Start year, start month, end year, and end month are required'
            });
        }

        const accountIdNum = parseInt(accountId);
        const startYearNum = parseInt(startYear);
        const startMonthNum = parseInt(startMonth);
        const endYearNum = parseInt(endYear);
        const endMonthNum = parseInt(endMonth);

        if (startMonthNum < 1 || startMonthNum > 12 || endMonthNum < 1 || endMonthNum > 12) {
            return res.status(400).json({
                success: false,
                message: 'Month values must be between 1 and 12'
            });
        }

        console.log(`🔄 Starting backfill for account ${accountId}: ${startYear}-${startMonth} to ${endYear}-${endMonth}`);

        // Import backfill function
        const { backfillSnapshots } = require('../../scripts/backfillSnapshots');

        // Execute backfill
        const result = await backfillSnapshots(accountIdNum, startYearNum, startMonthNum, endYearNum, endMonthNum);

        console.log(`✅ Backfill completed for account ${accountId}`);

        return res.json({
            success: true,
            message: 'Snapshot backfill completed successfully',
            data: result
        });

    } catch (error) {
        console.error('❌ Error during snapshot backfill:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to backfill snapshots',
            error: error.message
        });
    }
});

router.post('/backfill-all-accounts', async (req, res) => {
    try {
        const { startYear, startMonth, endYear, endMonth } = req.body;

        if (!startYear || !startMonth || !endYear || !endMonth) {
            return res.status(400).json({
                success: false,
                message: 'Start year, start month, end year, and end month are required'
            });
        }

        const startYearNum = parseInt(startYear);
        const startMonthNum = parseInt(startMonth);
        const endYearNum = parseInt(endYear);
        const endMonthNum = parseInt(endMonth);

        if (startMonthNum < 1 || startMonthNum > 12 || endMonthNum < 1 || endMonthNum > 12) {
            return res.status(400).json({
                success: false,
                message: 'Month values must be between 1 and 12'
            });
        }

        console.log(`🔄 Starting backfill for ALL ACCOUNTS: ${startYear}-${startMonth} to ${endYear}-${endMonth}`);

        // Import backfill function
        const { backfillAllAccounts } = require('../../scripts/backfillSnapshots');

        // Execute backfill for all accounts
        const result = await backfillAllAccounts(startYearNum, startMonthNum, endYearNum, endMonthNum);

        console.log(`✅ Backfill completed for all accounts`);

        return res.json({
            success: true,
            message: 'Snapshot backfill completed for all accounts',
            data: result
        });

    } catch (error) {
        console.error('❌ Error during all-accounts snapshot backfill:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to backfill snapshots for all accounts',
            error: error.message
        });
    }
});

// Export router
module.exports = router;