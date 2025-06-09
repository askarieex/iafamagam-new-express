const monthlyClosureService = require('../services/monthlyClosureService');
const db = require('../models');
const { sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Get list of accounts with their closure status
 * @route GET /api/monthly-closure/status
 */
exports.getClosureStatus = async (req, res) => {
    try {
        // Use the service to get all accounts with their period status
        const accountStatus = await monthlyClosureService.getAllAccountsPeriodStatus();

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
 * Open a specific accounting period
 * @route POST /api/monthly-closure/open
 */
exports.openAccountingPeriod = async (req, res) => {
    try {
        const { month, year, account_id } = req.body;

        // Validate required fields
        if (!month || !year || !account_id) {
            return res.status(400).json({
                success: false,
                message: 'Month, year, and account ID are required'
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

        // Check if account exists
        const { Account } = require('../models');
        const account = await Account.findByPk(account_id);

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }

        try {
            console.log(`Attempting direct SQL approach to open period ${month}/${year} for account ${account_id}`);

            // First, close any currently open periods for this account to maintain integrity
            await db.sequelize.query(
                "UPDATE monthly_ledger_balances SET is_open = false WHERE account_id = ? AND is_open = true",
                { replacements: [account_id] }
            );

            // Get ledger heads for this account
            const ledgerHeads = await db.LedgerHead.findAll({
                where: { account_id },
                attributes: ['id', 'current_balance']
            });

            if (!ledgerHeads || ledgerHeads.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot open period: No ledger heads found for this account'
                });
            }

            // Process each ledger head
            // We'll use the first ledger head to determine which one gets is_open=true
            let isFirstLedger = true;

            for (const ledger of ledgerHeads) {
                // Check if a record already exists for this month/year/ledger
                const existingRecord = await db.sequelize.query(
                    "SELECT id FROM monthly_ledger_balances WHERE account_id = ? AND ledger_head_id = ? AND month = ? AND year = ?",
                    {
                        replacements: [account_id, ledger.id, month, year],
                        type: db.sequelize.QueryTypes.SELECT
                    }
                );

                // Only the first ledger gets is_open=true
                const isOpen = isFirstLedger;

                if (existingRecord && existingRecord.length > 0) {
                    // Update existing record - only set is_open=true for the first ledger
                    await db.sequelize.query(
                        "UPDATE monthly_ledger_balances SET is_open = ?, updated_at = NOW() WHERE id = ?",
                        { replacements: [isOpen, existingRecord[0].id] }
                    );
                } else {
                    // Create new record - only set is_open=true for the first ledger
                    await db.sequelize.query(
                        `INSERT INTO monthly_ledger_balances (
                                account_id, 
                                ledger_head_id, 
                                month, 
                                year, 
                                opening_balance, 
                                receipts, 
                                payments, 
                                closing_balance, 
                                cash_in_hand, 
                                cash_in_bank, 
                                is_open, 
                                created_at, 
                                updated_at
                            ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, 0, 0, ?, NOW(), NOW())`,
                        {
                            replacements: [
                                account_id,
                                ledger.id,
                                month,
                                year,
                                ledger.current_balance || 0,
                                ledger.current_balance || 0,
                                isOpen
                            ]
                        }
                    );
                }

                // After processing the first ledger, set this to false for the rest
                isFirstLedger = false;
            }

            // Log the period action
            await db.sequelize.query(
                `INSERT INTO audit_logs (
                    entity_type, 
                    entity_id, 
                    action, 
                    details, 
                    created_at, 
                    updated_at
                ) VALUES ('Account', ?, 'periodOpened', ?, NOW(), NOW())`,
                { replacements: [account_id, `Opened accounting period for ${month}/${year}`] }
            );

            // Return success
            return res.status(200).json({
                success: true,
                message: 'Accounting period opened successfully',
                data: {
                    accountId: parseInt(account_id),
                    month: parseInt(month),
                    year: parseInt(year),
                    openedAt: new Date()
                }
            });
        } catch (error) {
            console.error('Error opening accounting period with direct SQL:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to open accounting period',
                error: error.message
            });
        }
    } catch (error) {
        console.error('Error opening accounting period:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to open accounting period',
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
 * Get the currently open period for an account
 * @route GET /api/monthly-closure/open-period
 */
exports.getOpenPeriod = async (req, res) => {
    try {
        const { account_id } = req.query;

        // Validate required fields
        if (!account_id) {
            return res.status(400).json({
                success: false,
                message: 'Account ID is required'
            });
        }

        // Get the open period from service
        const openPeriod = await monthlyClosureService.getOpenPeriodForAccount(parseInt(account_id));

        // Check if a period is open
        if (!openPeriod) {
            // Auto-open the current month
            const autoOpenResult = await exports.ensureCurrentPeriodOpen(parseInt(account_id));

            if (autoOpenResult.success && autoOpenResult.autoOpened) {
                // Successfully auto-opened the current month
                return res.status(200).json({
                    success: true,
                    message: 'Current month auto-opened',
                    data: autoOpenResult.openPeriod
                });
            } else {
                // Failed to auto-open
                return res.status(404).json({
                    success: false,
                    message: 'No open period found for this account and auto-open failed',
                    data: { account_id: parseInt(account_id) }
                });
            }
        }

        return res.status(200).json({
            success: true,
            data: {
                account_id: parseInt(account_id),
                month: openPeriod.month,
                year: openPeriod.year
            }
        });
    } catch (error) {
        console.error('Error getting open period:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get open period',
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
                    [Op.in]: ['periodClosed', 'periodReopened', 'periodOpened']
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

/**
 * Auto-open the current month if no period is open
 * @param {number} accountId - Account ID to check/open period for
 * @returns {Promise<Object>} Result of auto-opening current period
 */
exports.ensureCurrentPeriodOpen = async (accountId) => {
    try {
        // First verify the account exists
        const account = await db.Account.findByPk(accountId);
        if (!account) {
            return {
                success: false,
                message: `Account ID ${accountId} not found`,
                autoOpened: false
            };
        }

        // Check for ledger heads
        const ledgerHeads = await db.LedgerHead.findAll({
            where: { account_id: accountId }
        });

        if (ledgerHeads.length === 0) {
            console.log(`No ledger heads found for account ${accountId}. Cannot open period without ledger heads.`);
            return {
                success: false,
                message: `Cannot open period: No ledger heads found for account ${accountId}`,
                autoOpened: false
            };
        }

        // Check if any period is already open
        const openPeriod = await monthlyClosureService.getOpenPeriodForAccount(accountId);
        console.log('Open period check result:', openPeriod);

        if (openPeriod) {
            console.log(`Found existing open period: Month ${openPeriod.month}, Year ${openPeriod.year}`);
            return {
                success: true,
                message: 'Period already open',
                autoOpened: false,
                openPeriod
            };
        }

        // No period is open, so open the current month
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // 1-12
        const currentYear = currentDate.getFullYear();

        console.log(`Auto-opening current period (${currentMonth}/${currentYear}) for account ${accountId}`);

        try {
            // Open the current month
            const result = await monthlyClosureService.openAccountingPeriod(
                currentMonth,
                currentYear,
                accountId
            );

            // Verify that the period was actually opened
            const verifyOpenPeriod = await monthlyClosureService.getOpenPeriodForAccount(accountId);

            if (!verifyOpenPeriod) {
                console.error(`Failed to verify open period after opening it. Opening failed silently.`);

                // Try one more time with a manual approach
                try {
                    console.log(`Using manuallyOpenPeriod as fallback for account ${accountId}`);
                    await manuallyOpenPeriod(accountId, currentMonth, currentYear);
                    console.log(`Manual period opening completed for account ${accountId}`);

                    // Check again
                    const secondVerify = await monthlyClosureService.getOpenPeriodForAccount(accountId);
                    if (!secondVerify) {
                        console.error(`Manual period opening did not work for account ${accountId}`);
                        return {
                            success: false,
                            message: `Failed to auto-open current period: Could not verify it was opened`,
                            autoOpened: false
                        };
                    } else {
                        console.log(`✅ Successfully opened period using manual approach for account ${accountId}`);
                    }
                } catch (manualOpenError) {
                    console.error(`Error in manual period opening for account ${accountId}:`, manualOpenError);
                    return {
                        success: false,
                        message: `Failed to auto-open current period: ${manualOpenError.message}`,
                        autoOpened: false
                    };
                }
            }

            return {
                success: true,
                message: `Auto-opened current period (${currentMonth}/${currentYear})`,
                autoOpened: true,
                openPeriod: {
                    account_id: accountId,
                    month: currentMonth,
                    year: currentYear
                }
            };
        } catch (error) {
            console.error('Error in openAccountingPeriod:', error);
            return {
                success: false,
                message: `Failed to auto-open current period: ${error.message}`,
                autoOpened: false
            };
        }
    } catch (error) {
        console.error('Error ensuring current period is open:', error);
        return {
            success: false,
            message: `Failed to auto-open current period: ${error.message}`,
            autoOpened: false
        };
    }
};

/**
 * Manual fallback to open a period directly with raw SQL if the ORM method fails
 */
async function manuallyOpenPeriod(accountId, month, year) {
    try {
        console.log(`Attempting manual period open for ${month}/${year}, account ${accountId}`);

        // Close any existing open periods first
        await db.sequelize.query(
            `UPDATE monthly_ledger_balances SET is_open = false WHERE account_id = ? AND is_open = true`,
            { replacements: [accountId] }
        );

        // Get ledger heads for this account
        const ledgerHeads = await db.LedgerHead.findAll({
            where: { account_id: accountId },
            raw: true
        });

        // For each ledger head, create or update the monthly snapshot
        let isFirstLedger = true;

        for (const ledger of ledgerHeads) {
            // Only the first ledger gets is_open=true
            const isOpen = isFirstLedger;

            // Check if period exists
            const existingPeriod = await db.MonthlyLedgerBalance.findOne({
                where: {
                    account_id: accountId,
                    ledger_head_id: ledger.id,
                    month: month,
                    year: year
                }
            });

            if (existingPeriod) {
                // Update existing period - only set is_open=true for first ledger
                await db.sequelize.query(
                    `UPDATE monthly_ledger_balances SET is_open = ? 
                     WHERE account_id = ? AND ledger_head_id = ? AND month = ? AND year = ?`,
                    { replacements: [isOpen, accountId, ledger.id, month, year] }
                );
            } else {
                // Create new period with opening = closing = current balance
                await db.sequelize.query(
                    `INSERT INTO monthly_ledger_balances 
                     (account_id, ledger_head_id, month, year, opening_balance, receipts, payments, closing_balance, is_open, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, NOW(), NOW())`,
                    {
                        replacements: [
                            accountId,
                            ledger.id,
                            month,
                            year,
                            ledger.current_balance || 0,
                            ledger.current_balance || 0,
                            isOpen
                        ]
                    }
                );
            }

            // After processing the first ledger, set this to false for the rest
            isFirstLedger = false;
        }

        console.log('Manual period open completed');
    } catch (error) {
        console.error('Error in manual period open:', error);
        throw error;
    }
} 