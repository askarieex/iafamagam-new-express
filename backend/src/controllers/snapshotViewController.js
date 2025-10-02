/**
 * Snapshot View Controller
 *
 * Provides API endpoints for viewing monthly balance snapshots
 */

const db = require('../models');

class SnapshotViewController {

    /**
     * Get monthly balance snapshots for a specific account and month
     * @route GET /api/reports/monthly-snapshots/:accountId/:year/:month
     */
    async getMonthlySnapshots(req, res) {
        try {
            const { accountId, year, month } = req.params;

            console.log(`🔄 Fetching monthly snapshots for account ${accountId}, ${year}-${month}`);

            // Validate parameters
            if (!accountId || isNaN(parseInt(accountId))) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid account ID is required',
                    error_type: 'VALIDATION_ERROR'
                });
            }

            if (!year || isNaN(parseInt(year))) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid year is required',
                    error_type: 'VALIDATION_ERROR'
                });
            }

            if (!month || isNaN(parseInt(month))) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid month is required',
                    error_type: 'VALIDATION_ERROR'
                });
            }

            const accountIdNum = parseInt(accountId);
            const yearNum = parseInt(year);
            const monthNum = parseInt(month);

            // Validate month range
            if (monthNum < 1 || monthNum > 12) {
                return res.status(400).json({
                    success: false,
                    message: 'Month must be between 1 and 12',
                    error_type: 'VALIDATION_ERROR'
                });
            }

            // Create month key to match database format (YYYY-MM-01)
            const monthKey = `${yearNum}-${monthNum.toString().padStart(2, '0')}-01`;

            console.log(`📊 Looking for snapshots with monthKey: ${monthKey}`);
            console.log(`📊 Include config:`, JSON.stringify([{
                model: db.LedgerHead,
                as: 'ledgerHead',
                attributes: ['id', 'name', 'head_type']
            }]));

            // Fetch monthly balance snapshots
            const snapshots = await db.MonthlyBalanceSummary.findAll({
                where: {
                    account_id: accountIdNum,
                    month_year: monthKey
                },
                include: [
                    {
                        model: db.LedgerHead,
                        as: 'ledgerHead',
                        attributes: ['id', 'name', 'head_type']
                    }
                ],
                order: [['ledger_head_id', 'ASC']]
            });

            console.log(`✅ Found ${snapshots.length} snapshots for ${monthKey}`);

            return res.json({
                success: true,
                data: snapshots,
                meta: {
                    account_id: accountIdNum,
                    year: yearNum,
                    month: monthNum,
                    month_year: monthKey,
                    count: snapshots.length
                },
                message: `Monthly snapshots retrieved for ${monthKey}`
            });

        } catch (error) {
            console.error('❌ Error getting monthly snapshots:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get monthly snapshots',
                error: error.message,
                error_type: 'SERVER_ERROR'
            });
        }
    }

    /**
     * Get all available months for an account (for dropdown population)
     * @route GET /api/reports/available-months/:accountId
     */
    async getAvailableMonths(req, res) {
        try {
            const { accountId } = req.params;

            // Validate parameters
            if (!accountId || isNaN(parseInt(accountId))) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid account ID is required'
                });
            }

            const accountIdNum = parseInt(accountId);

            // Get distinct month_year values for this account
            const availableMonths = await db.MonthlyBalanceSummary.findAll({
                where: {
                    account_id: accountIdNum
                },
                attributes: ['month_year'],
                group: ['month_year'],
                order: [['month_year', 'DESC']]
            });

            const months = availableMonths.map(item => {
                const [year, month] = item.month_year.split('-');
                return {
                    month_year: item.month_year,
                    year: parseInt(year),
                    month: parseInt(month),
                    display_name: `${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' })} ${year}`
                };
            });

            return res.json({
                success: true,
                data: months,
                message: `Available months retrieved for account ${accountId}`
            });

        } catch (error) {
            console.error('❌ Error getting available months:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get available months',
                error: error.message
            });
        }
    }

    /**
     * Force regenerate snapshots for a specific month
     * @route POST /api/reports/regenerate-snapshots/:accountId/:year/:month
     */
    async regenerateSnapshots(req, res) {
        try {
            const { accountId, year, month } = req.params;

            console.log(`🔄 Regenerating snapshots for account ${accountId}, ${year}-${month}`);

            // Validate parameters
            if (!accountId || isNaN(parseInt(accountId))) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid account ID is required'
                });
            }

            const accountIdNum = parseInt(accountId);
            const yearNum = parseInt(year);
            const monthNum = parseInt(month);

            // Import monthly snapshot service
            const monthlySnapshotService = require('../services/monthlySnapshotService');

            // Regenerate snapshots for the specified month
            await monthlySnapshotService.generateMonthlySnapshots(accountIdNum, yearNum, monthNum);

            console.log(`✅ Snapshots regenerated for ${year}-${month.toString().padStart(2, '0')}`);

            return res.json({
                success: true,
                message: `Snapshots regenerated for ${year}-${month.toString().padStart(2, '0')}`,
                data: {
                    account_id: accountIdNum,
                    year: yearNum,
                    month: monthNum
                }
            });

        } catch (error) {
            console.error('❌ Error regenerating snapshots:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to regenerate snapshots',
                error: error.message
            });
        }
    }
}

const snapshotViewController = new SnapshotViewController();
module.exports = snapshotViewController;