const monthlyClosureService = require('../services/monthlyClosureService');
const { Op } = require('sequelize');

/**
 * Close an accounting period
 * @route POST /api/monthly-closure/close
 */
exports.closeAccountingPeriod = async (req, res) => {
    try {
        const { month, year, account_id } = req.body;

        // Validate required fields
        if (!month || !year) {
            return res.status(400).json({
                success: false,
                message: 'Month and year are required'
            });
        }

        // Validate month range
        if (month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                message: 'Month must be between 1 and 12'
            });
        }

        // Validate year
        if (year < 2000 || year > 2100) {
            return res.status(400).json({
                success: false,
                message: 'Year must be between 2000 and 2100'
            });
        }

        // If specific account ID provided
        if (account_id) {
            const { Account, Transaction } = require('../models');
            const account = await Account.findByPk(account_id);
            
            if (!account) {
                return res.status(404).json({
                    success: false,
                    message: 'Account not found'
                });
            }

            // Calculate the last day of the month being closed
            const lastDay = new Date(year, month, 0).getDate();
            const closingDate = new Date(year, month - 1, lastDay);
            
            // Check if this month is sequential with the last closed period
            if (account.last_closed_date) {
                const lastClosedDate = new Date(account.last_closed_date);
                
                // Check if this period is already closed
                if (
                    lastClosedDate.getFullYear() === year &&
                    lastClosedDate.getMonth() + 1 === month &&
                    lastClosedDate.getDate() >= lastDay
                ) {
                    return res.status(400).json({
                        success: false,
                        message: 'This period is already closed'
                    });
                }

                // Check for gaps in period closure
                const expectedPrevMonth = new Date(closingDate);
                expectedPrevMonth.setMonth(expectedPrevMonth.getMonth() - 1);
                
                // Format both dates to YYYY-MM format for comparison
                const expectedPrevMonthFormatted = `${expectedPrevMonth.getFullYear()}-${String(expectedPrevMonth.getMonth() + 1).padStart(2, '0')}`;
                const lastClosedFormatted = `${lastClosedDate.getFullYear()}-${String(lastClosedDate.getMonth() + 1).padStart(2, '0')}`;

                if (expectedPrevMonthFormatted !== lastClosedFormatted) {
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot close this period. Please close previous periods first to maintain sequential closure.'
                    });
                }
            }

            // Check for future transactions that would be affected
            const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];
            
            const futureTransactionCount = await Transaction.count({
                where: {
                    account_id: account_id,
                    tx_date: {
                        [Op.gt]: endOfMonth
                    },
                    status: 'completed'
                }
            });

            if (futureTransactionCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot close this period. There are ${futureTransactionCount} transactions with dates after this period that would be affected.`
                });
            }
        }

        // Call service to close period
        const result = await monthlyClosureService.closeAccountingPeriod(
            parseInt(month),
            parseInt(year),
            account_id ? parseInt(account_id) : null
        );

        // Get the updated account to return the last_closed_date
        let updatedAccount = null;
        if (account_id) {
            const { Account } = require('../models');
            updatedAccount = await Account.findByPk(account_id);
        }

        return res.status(200).json({
            success: true,
            message: 'Accounting period closed successfully',
            data: result,
            account: updatedAccount ? {
                id: updatedAccount.id,
                name: updatedAccount.name,
                last_closed_date: updatedAccount.last_closed_date
            } : null
        });
    } catch (error) {
        console.error('Error closing accounting period:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to close accounting period',
            error: error.message
        });
    }
};

/**
 * Force close the current month for a specific account
 * @route POST /api/monthly-closure/force-close-current
 */
exports.forceCloseCurrentMonth = async (req, res) => {
    try {
        const { account_id } = req.body;

        // Validate required fields
        if (!account_id) {
            return res.status(400).json({
                success: false,
                message: 'Account ID is required'
            });
        }

        // Get current date
        const today = new Date();
        const currentMonth = today.getMonth() + 1; // Convert from 0-based to 1-based
        const currentYear = today.getFullYear();

        // Use the existing close accounting period function
        const result = await monthlyClosureService.closeAccountingPeriod(
            currentMonth,
            currentYear,
            parseInt(account_id)
        );

        // Get the updated account
        const { Account } = require('../models');
        const updatedAccount = await Account.findByPk(account_id);

        return res.status(200).json({
            success: true,
            message: `Current month (${currentMonth}/${currentYear}) closed successfully`,
            data: result,
            account: updatedAccount ? {
                id: updatedAccount.id,
                name: updatedAccount.name,
                last_closed_date: updatedAccount.last_closed_date
            } : null
        });
    } catch (error) {
        console.error('Error force closing current month:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to force close current month',
            error: error.message
        });
    }
};

/**
 * Reopen a previously closed accounting period
 * @route POST /api/monthly-closure/reopen
 */
exports.reopenPeriod = async (req, res) => {
    try {
        const { account_id, new_closing_date } = req.body;

        // Validate required fields
        if (!account_id || !new_closing_date) {
            return res.status(400).json({
                success: false,
                message: 'Account ID and new closing date are required'
            });
        }

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(new_closing_date)) {
            return res.status(400).json({
                success: false,
                message: 'New closing date must be in YYYY-MM-DD format'
            });
        }

        // Call service to reopen period
        const result = await monthlyClosureService.reopenPeriod(
            parseInt(account_id),
            new_closing_date
        );

        return res.status(200).json({
            success: true,
            message: 'Accounting period reopened successfully',
            data: result
        });
    } catch (error) {
        console.error('Error reopening accounting period:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to reopen accounting period',
            error: error.message
        });
    }
};

/**
 * Recalculate monthly snapshots after a backdated transaction
 * @route POST /api/monthly-closure/recalculate
 */
exports.recalculateSnapshots = async (req, res) => {
    try {
        const { account_id, ledger_head_id, from_date } = req.body;

        // Validate required fields
        if (!account_id || !ledger_head_id || !from_date) {
            return res.status(400).json({
                success: false,
                message: 'Account ID, ledger head ID, and from date are required'
            });
        }

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(from_date)) {
            return res.status(400).json({
                success: false,
                message: 'From date must be in YYYY-MM-DD format'
            });
        }

        // Call service to recalculate snapshots
        const result = await monthlyClosureService.recalculateMonthlySnapshots(
            parseInt(account_id),
            parseInt(ledger_head_id),
            from_date
        );

        return res.status(200).json({
            success: true,
            message: 'Monthly snapshots recalculated successfully',
            data: result
        });
    } catch (error) {
        console.error('Error recalculating monthly snapshots:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to recalculate monthly snapshots',
            error: error.message
        });
    }
};

/**
 * Get list of accounts with their closure status
 * @route GET /api/monthly-closure/status
 */
exports.getClosureStatus = async (req, res) => {
    try {
        const { Account } = require('../models');

        // Try to get accounts with their closure status
        let accounts;
        try {
            accounts = await Account.findAll({
                attributes: ['id', 'name', 'last_closed_date']
            });
        } catch (dbError) {
            // If the column doesn't exist, get accounts without last_closed_date
            console.warn('last_closed_date column may not exist, falling back to basic account info');
            accounts = await Account.findAll({
                attributes: ['id', 'name']
            });
        }

        const currentDate = new Date();
        const accountStatus = accounts.map(account => {
            let status = 'never_closed';
            let lastClosedDate = null;

            if (account.last_closed_date) {
                lastClosedDate = account.last_closed_date;

                // Calculate months difference between now and last closed date
                const lastClosed = new Date(account.last_closed_date);
                const monthsDiff = (currentDate.getFullYear() - lastClosed.getFullYear()) * 12 +
                    currentDate.getMonth() - lastClosed.getMonth();

                if (monthsDiff <= 1) {
                    status = 'current';
                } else if (monthsDiff <= 3) {
                    status = 'recent';
                } else {
                    status = 'outdated';
                }
            }

            return {
                id: account.id,
                name: account.name,
                last_closed_date: lastClosedDate,
                status,
            };
        });

        return res.status(200).json({
            success: true,
            data: accountStatus
        });
    } catch (error) {
        console.error('Error fetching closure status:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch closure status',
            error: error.message
        });
    }
};

/**
 * Get period closure history for an account
 * @route GET /api/monthly-closure/history
 */
exports.getPeriodHistory = async (req, res) => {
    try {
        const { account_id } = req.query;
        
        if (!account_id) {
            return res.status(400).json({
                success: false,
                message: 'Account ID is required'
            });
        }
        
        const { AuditLog } = require('../models');
        
        const history = await AuditLog.findAll({
            where: {
                entity_type: 'Account',
                entity_id: account_id,
                action: {
                    [Op.in]: ['periodClosed', 'periodReopened']
                }
            },
            order: [['created_at', 'DESC']],
            limit: 100
        });
        
        return res.status(200).json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('Error getting period history:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get period closure history',
            error: error.message
        });
    }
}; 