/**
 * Monthly Report Controller
 *
 * Handles HTTP requests for monthly financial reporting, providing endpoints
 * for report generation, balance summaries, and historical data access.
 */

const monthlyReportService = require('../services/monthlyReportService');

class MonthlyReportController {

    /**
     * Generate monthly report for all ledger heads
     * @route GET /api/reports/monthly/:year/:month/:accountId
     */
    async generateMonthlyReport(req, res) {
        try {
            const { year, month, accountId } = req.params;
            const { regenerate = false, save_results = true, include_transactions = false } = req.query;

            console.log(`🔄 Monthly report request: ${year}-${month} for account ${accountId}`);

            // Validate parameters
            const validation = this.validateReportParams(year, month, accountId);
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: validation.message,
                    error_type: 'VALIDATION_ERROR'
                });
            }

            const yearNum = parseInt(year);
            const monthNum = parseInt(month);
            const accountIdNum = parseInt(accountId);

            let reportData;

            // Try to get saved report first (unless regenerate is requested)
            if (!regenerate) {
                reportData = await monthlyReportService.getSavedMonthlyReport(yearNum, monthNum, accountIdNum);

                if (reportData) {
                    console.log(`✅ Returning saved monthly report`);

                    // Remove transactions if not requested
                    if (!include_transactions) {
                        reportData.ledger_heads.forEach(lh => delete lh.transactions);
                    }

                    return res.json({
                        success: true,
                        data: reportData,
                        message: `Monthly report for ${reportData.month_name} retrieved from saved data`,
                        is_saved_report: true,
                        generated_at: reportData.last_calculated_at
                    });
                }
            }

            // Generate new report
            reportData = await monthlyReportService.generateMonthlyReport(
                yearNum,
                monthNum,
                accountIdNum,
                save_results === 'true'
            );

            // Remove transactions if not requested (for performance)
            if (!include_transactions) {
                reportData.ledger_heads.forEach(lh => delete lh.transactions);
            }

            return res.json({
                success: true,
                data: reportData,
                message: `Monthly report for ${reportData.month_name} generated successfully`,
                is_saved_report: false,
                generated_at: reportData.generated_at,
                performance_info: {
                    ledger_heads_processed: reportData.ledger_heads.length,
                    total_transactions: reportData.totals.transaction_count
                }
            });

        } catch (error) {
            console.error('❌ Error generating monthly report:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate monthly report',
                error: error.message,
                error_type: 'REPORT_GENERATION_ERROR'
            });
        }
    }

    /**
     * Get monthly report for specific ledger head
     * @route GET /api/reports/monthly/:year/:month/:accountId/ledger/:ledgerHeadId
     */
    async getLedgerHeadMonthlyReport(req, res) {
        try {
            const { year, month, accountId, ledgerHeadId } = req.params;
            const { include_transactions = true } = req.query;

            console.log(`🔄 Ledger head report request: ${year}-${month}, ledger ${ledgerHeadId}`);

            // Validate parameters
            const validation = this.validateReportParams(year, month, accountId);
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: validation.message,
                    error_type: 'VALIDATION_ERROR'
                });
            }

            if (!ledgerHeadId || isNaN(parseInt(ledgerHeadId))) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid ledger head ID is required',
                    error_type: 'VALIDATION_ERROR'
                });
            }

            const yearNum = parseInt(year);
            const monthNum = parseInt(month);
            const accountIdNum = parseInt(accountId);
            const ledgerHeadIdNum = parseInt(ledgerHeadId);

            // Generate report for specific ledger head
            const ledgerData = await monthlyReportService.generateLedgerHeadReport(
                ledgerHeadIdNum,
                accountIdNum,
                yearNum,
                monthNum
            );

            // Get ledger head details
            const ledgerHead = await this.getLedgerHeadDetails(ledgerHeadIdNum);
            if (!ledgerHead) {
                return res.status(404).json({
                    success: false,
                    message: 'Ledger head not found',
                    error_type: 'NOT_FOUND'
                });
            }

            ledgerData.ledger_head = ledgerHead;

            // Remove transactions if not requested
            if (include_transactions !== 'true') {
                delete ledgerData.transactions;
            }

            const monthName = new Date(yearNum, monthNum - 1, 1).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
            });

            return res.json({
                success: true,
                data: ledgerData,
                message: `${ledgerHead.name} report for ${monthName} generated successfully`,
                month_info: {
                    year: yearNum,
                    month: monthNum,
                    month_name: monthName,
                    account_id: accountIdNum
                }
            });

        } catch (error) {
            console.error('❌ Error generating ledger head report:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate ledger head report',
                error: error.message,
                error_type: 'REPORT_GENERATION_ERROR'
            });
        }
    }

    /**
     * Get balance summary for multiple months
     * @route GET /api/reports/balance-summary/:accountId
     */
    async getBalanceSummary(req, res) {
        try {
            const { accountId } = req.params;
            const { start_year, start_month, end_year, end_month, ledger_head_id } = req.query;

            console.log(`🔄 Balance summary request for account ${accountId}`);

            // Validate account ID
            if (!accountId || isNaN(parseInt(accountId))) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid account ID is required',
                    error_type: 'VALIDATION_ERROR'
                });
            }

            // Default to last 12 months if not specified
            const endDate = end_year && end_month
                ? new Date(parseInt(end_year), parseInt(end_month) - 1, 1)
                : new Date();

            const startDate = start_year && start_month
                ? new Date(parseInt(start_year), parseInt(start_month) - 1, 1)
                : new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);

            const accountIdNum = parseInt(accountId);
            const ledgerHeadIdNum = ledger_head_id ? parseInt(ledger_head_id) : null;

            // Get balance summaries
            const summaries = await this.getBalanceSummaryData(
                accountIdNum,
                startDate,
                endDate,
                ledgerHeadIdNum
            );

            return res.json({
                success: true,
                data: summaries,
                message: `Balance summary retrieved successfully`,
                period: {
                    start: startDate.toISOString().split('T')[0],
                    end: endDate.toISOString().split('T')[0],
                    months_included: summaries.length
                }
            });

        } catch (error) {
            console.error('❌ Error getting balance summary:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get balance summary',
                error: error.message,
                error_type: 'BALANCE_SUMMARY_ERROR'
            });
        }
    }

    /**
     * Finalize monthly report (lock calculations)
     * @route POST /api/reports/monthly/:year/:month/:accountId/finalize
     */
    async finalizeMonthlyReport(req, res) {
        try {
            const { year, month, accountId } = req.params;
            const { confirmation = false } = req.body;

            console.log(`🔄 Finalize month request: ${year}-${month} for account ${accountId}`);

            // Validate parameters
            const validation = this.validateReportParams(year, month, accountId);
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: validation.message,
                    error_type: 'VALIDATION_ERROR'
                });
            }

            if (!confirmation) {
                return res.status(400).json({
                    success: false,
                    message: 'Confirmation required to finalize month',
                    error_type: 'CONFIRMATION_REQUIRED'
                });
            }

            const yearNum = parseInt(year);
            const monthNum = parseInt(month);
            const accountIdNum = parseInt(accountId);

            // Check if month is in the future
            const targetMonth = new Date(yearNum, monthNum - 1, 1);
            const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

            if (targetMonth >= currentMonth) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot finalize current or future months',
                    error_type: 'INVALID_MONTH'
                });
            }

            // Finalize the month
            await monthlyReportService.finalizeMonth(yearNum, monthNum, accountIdNum);

            const monthName = targetMonth.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
            });

            return res.json({
                success: true,
                message: `${monthName} has been finalized successfully`,
                finalized_at: new Date(),
                month_info: {
                    year: yearNum,
                    month: monthNum,
                    month_name: monthName,
                    account_id: accountIdNum
                }
            });

        } catch (error) {
            console.error('❌ Error finalizing monthly report:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to finalize monthly report',
                error: error.message,
                error_type: 'FINALIZATION_ERROR'
            });
        }
    }

    /**
     * Get available months for reporting
     * @route GET /api/reports/available-months/:accountId
     */
    async getAvailableMonths(req, res) {
        try {
            const { accountId } = req.params;

            console.log(`🔄 Available months request for account ${accountId}`);

            if (!accountId || isNaN(parseInt(accountId))) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid account ID is required',
                    error_type: 'VALIDATION_ERROR'
                });
            }

            const accountIdNum = parseInt(accountId);
            const availableMonths = await this.getAvailableMonthsData(accountIdNum);

            return res.json({
                success: true,
                data: availableMonths,
                message: `Available months retrieved successfully`,
                count: availableMonths.length
            });

        } catch (error) {
            console.error('❌ Error getting available months:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get available months',
                error: error.message,
                error_type: 'AVAILABLE_MONTHS_ERROR'
            });
        }
    }

    // ===== HELPER METHODS =====

    /**
     * Validate report parameters
     */
    validateReportParams(year, month, accountId) {
        if (!year || !month || !accountId) {
            return {
                isValid: false,
                message: 'Year, month, and account ID are required'
            };
        }

        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        const accountIdNum = parseInt(accountId);

        if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
            return {
                isValid: false,
                message: 'Invalid year. Must be between 2000 and 2100'
            };
        }

        if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
            return {
                isValid: false,
                message: 'Invalid month. Must be between 1 and 12'
            };
        }

        if (isNaN(accountIdNum) || accountIdNum <= 0) {
            return {
                isValid: false,
                message: 'Invalid account ID'
            };
        }

        return { isValid: true };
    }

    /**
     * Get ledger head details
     */
    async getLedgerHeadDetails(ledgerHeadId) {
        try {
            const db = require('../models');
            const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId);

            if (!ledgerHead) return null;

            return {
                id: ledgerHead.id,
                name: ledgerHead.name,
                display_name: ledgerHead.display_name,
                type: ledgerHead.type
            };
        } catch (error) {
            console.error('Error getting ledger head details:', error);
            return null;
        }
    }

    /**
     * Get balance summary data
     */
    async getBalanceSummaryData(accountId, startDate, endDate, ledgerHeadId) {
        const db = require('../models');

        const where = {
            account_id: accountId,
            month_year: {
                [db.Sequelize.Op.between]: [startDate, endDate]
            }
        };

        if (ledgerHeadId) {
            where.ledger_head_id = ledgerHeadId;
        }

        return await db.MonthlyBalanceSummary.findAll({
            where,
            include: [{
                model: db.LedgerHead,
                as: 'ledgerHead',
                attributes: ['id', 'name', 'display_name', 'type']
            }],
            order: [['month_year', 'ASC']]
        });
    }

    /**
     * Get available months with transaction data
     */
    async getAvailableMonthsData(accountId) {
        const db = require('../models');

        // Get distinct months from transaction log
        const months = await db.TransactionLog.findAll({
            where: {
                account_id: accountId
            },
            attributes: [
                [db.Sequelize.fn('YEAR', db.Sequelize.col('transaction_date')), 'year'],
                [db.Sequelize.fn('MONTH', db.Sequelize.col('transaction_date')), 'month'],
                [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'transaction_count']
            ],
            group: [
                db.Sequelize.fn('YEAR', db.Sequelize.col('transaction_date')),
                db.Sequelize.fn('MONTH', db.Sequelize.col('transaction_date'))
            ],
            order: [
                [db.Sequelize.fn('YEAR', db.Sequelize.col('transaction_date')), 'DESC'],
                [db.Sequelize.fn('MONTH', db.Sequelize.col('transaction_date')), 'DESC']
            ]
        });

        return months.map(m => ({
            year: parseInt(m.dataValues.year),
            month: parseInt(m.dataValues.month),
            month_name: new Date(m.dataValues.year, m.dataValues.month - 1, 1)
                .toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            transaction_count: parseInt(m.dataValues.transaction_count)
        }));
    }
}

module.exports = new MonthlyReportController();