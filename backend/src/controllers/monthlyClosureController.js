const monthlyClosureService = require('../services/monthlyClosureService');

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

        // Call service to close period
        const result = await monthlyClosureService.closeAccountingPeriod(
            parseInt(month),
            parseInt(year),
            account_id ? parseInt(account_id) : null
        );

        return res.status(200).json({
            success: true,
            message: 'Accounting period closed successfully',
            data: result
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

        // For now, return a simplified version without using last_closed_date
        // until migrations are fixed
        try {
            const accounts = await Account.findAll({
                attributes: ['id', 'name']
            });

            const accountStatus = accounts.map(account => {
                return {
                    id: account.id,
                    name: account.name,
                    last_closed_date: null,
                    status: 'never_closed',
                };
            });

            return res.status(200).json({
                success: true,
                data: accountStatus
            });
        } catch (innerError) {
            console.error('Error in simplified getClosureStatus:', innerError);
            return res.status(500).json({
                success: false,
                message: 'Unable to fetch accounts',
                error: innerError.message
            });
        }

        /* Commented out original implementation until migration is fixed
        const accounts = await Account.findAll({
            attributes: ['id', 'name', 'last_closed_date']
        });

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
                last_closed_date: account.last_closed_date,
                status,
            };
        });

        return res.status(200).json({
            success: true,
            data: accountStatus
        });
        */
    } catch (error) {
        console.error('Error fetching closure status:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch closure status',
            error: error.message
        });
    }
}; 