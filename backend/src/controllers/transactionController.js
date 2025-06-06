const transactionService = require('../services/transactionService');
const db = require('../models');

/**
 * Validates if a transaction date is in a closed period
 * @param {*} account The account object
 * @param {*} txDate Transaction date string (YYYY-MM-DD)
 * @param {*} adminOverride Whether admin override is specified
 */
const validateClosedPeriod = (account, txDate, adminOverride = false) => {
    // If no last closed date, no validation needed
    if (!account.last_closed_date) {
        return { allowed: true };
    }

    const txDateObj = new Date(txDate);
    const lastClosedDateObj = new Date(account.last_closed_date);

    // Set both dates to start of day for accurate comparison
    txDateObj.setHours(0, 0, 0, 0);
    lastClosedDateObj.setHours(0, 0, 0, 0);

    // Check if transaction is in or before a closed period
    if (txDateObj <= lastClosedDateObj) {
        if (adminOverride) {
            return { allowed: true, requiresRecalculation: true };
        }
        return {
            allowed: false,
            message: `Cannot enter transactions on or before the last closed date (${account.last_closed_date}). The period is closed.`
        };
    }

    // Calculate the maximum allowed transaction date
    // This enforces only one open period at a time (next month after last closed)

    // Get the month after the last closed date
    const maxAllowedDateObj = new Date(lastClosedDateObj);
    maxAllowedDateObj.setMonth(maxAllowedDateObj.getMonth() + 2, 0); // Last day of next month

    // Check if transaction is beyond the allowed open period
    if (txDateObj > maxAllowedDateObj) {
        if (adminOverride) {
            return { allowed: true };
        }

        return {
            allowed: false,
            message: `Cannot enter transactions for future periods. Only one open period is allowed at a time. ` +
                `You can only enter transactions until ${maxAllowedDateObj.toISOString().split('T')[0]}.`
        };
    }

    // Transaction is within allowed open period
    return { allowed: true };
};

/**
 * Transaction Controller
 */
class TransactionController {
    /**
     * Create a credit transaction
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async createCredit(req, res) {
        const t = await db.sequelize.transaction();

        try {
            const creditData = req.body;

            // Validate required fields
            if (!creditData.account_id || !creditData.ledger_head_id || !creditData.booklet_id ||
                !creditData.amount || !creditData.cash_type || !creditData.tx_date) {
                await t.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }

            // Fetch the account
            const account = await db.Account.findByPk(creditData.account_id);
            if (!account) {
                await t.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Account not found'
                });
            }

            // Validate against closed period
            const closedPeriodCheck = validateClosedPeriod(
                account,
                creditData.tx_date,
                creditData.admin_override
            );

            if (!closedPeriodCheck.allowed) {
                await t.rollback();
                return res.status(403).json({
                    success: false,
                    message: closedPeriodCheck.message
                });
            }

            // If there's a warning, log it but allow the transaction
            if (closedPeriodCheck.warning) {
                console.warn(`Admin override for closed period: ${closedPeriodCheck.warning}`);
            }

            const transaction = await transactionService.createCredit(creditData);

            // Store transaction date info to determine if recalculation is needed
            const txDateObj = new Date(creditData.tx_date);
            const today = new Date();
            const isBackdated = txDateObj < today;

            // Recalculate monthly snapshots if the transaction is backdated
            // This ensures all periods maintain balance consistency
            if (isBackdated) {
                try {
                    const monthlyClosureService = require('../services/monthlyClosureService');

                    await monthlyClosureService.recalculateMonthlySnapshots(
                        creditData.account_id,
                        creditData.ledger_head_id,
                        creditData.tx_date
                    );

                    console.log(`Recalculated monthly snapshots after backdated credit transaction: ${creditData.tx_date}`);
                } catch (recalcError) {
                    console.error('Failed to recalculate monthly snapshots:', recalcError);
                }
            }

            await t.commit();
            return res.status(201).json({
                success: true,
                data: transaction,
                message: 'Credit transaction created successfully'
            });
        } catch (error) {
            await t.rollback();
            console.error('Error creating credit transaction:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error creating credit transaction'
            });
        }
    }

    /**
     * Create a debit transaction
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async createDebit(req, res) {
        const t = await db.sequelize.transaction();

        try {
            const debitData = req.body;

            // Validate required fields
            if (!debitData.account_id || !debitData.ledger_head_id ||
                !debitData.amount || !debitData.cash_type || !debitData.tx_date ||
                !debitData.sources || !debitData.sources.length) {
                await t.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }

            // Fetch the account
            const account = await db.Account.findByPk(debitData.account_id);
            if (!account) {
                await t.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Account not found'
                });
            }

            // Validate against closed period
            const closedPeriodCheck = validateClosedPeriod(
                account,
                debitData.tx_date,
                debitData.admin_override
            );

            if (!closedPeriodCheck.allowed) {
                await t.rollback();
                return res.status(403).json({
                    success: false,
                    message: closedPeriodCheck.message
                });
            }

            // If there's a warning, log it but allow the transaction
            if (closedPeriodCheck.warning) {
                console.warn(`Admin override for closed period: ${closedPeriodCheck.warning}`);
            }

            const transaction = await transactionService.createDebit(debitData);

            // Store transaction date info to determine if recalculation is needed
            const txDateObj = new Date(debitData.tx_date);
            const today = new Date();
            const isBackdated = txDateObj < today;

            // Recalculate monthly snapshots if the transaction is backdated 
            // This ensures all periods maintain balance consistency
            if (isBackdated) {
                try {
                    const monthlyClosureService = require('../services/monthlyClosureService');

                    // Recalculate for the target ledger head
                    await monthlyClosureService.recalculateMonthlySnapshots(
                        debitData.account_id,
                        debitData.ledger_head_id,
                        debitData.tx_date
                    );

                    // Also recalculate for each source ledger head
                    for (const source of debitData.sources) {
                        await monthlyClosureService.recalculateMonthlySnapshots(
                            debitData.account_id,
                            source.ledger_head_id,
                            debitData.tx_date
                        );
                    }

                    console.log(`Recalculated monthly snapshots after backdated debit transaction: ${debitData.tx_date}`);
                } catch (recalcError) {
                    console.error('Failed to recalculate monthly snapshots:', recalcError);
                }
            }

            await t.commit();
            return res.status(201).json({
                success: true,
                data: transaction,
                message: 'Debit transaction created successfully'
            });
        } catch (error) {
            await t.rollback();
            console.error('Error creating debit transaction:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error creating debit transaction'
            });
        }
    }

    /**
     * Get all transactions with optional filtering and pagination
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getTransactions(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;

            // Extract filter parameters
            const filters = {
                account_id: req.query.account_id,
                ledger_head_id: req.query.ledger_head_id,
                donor_id: req.query.donor_id,
                tx_type: req.query.tx_type,
                cash_type: req.query.cash_type,
                status: req.query.status,
                start_date: req.query.start_date,
                end_date: req.query.end_date
            };

            console.log('Transaction request filters:', filters);

            const result = await transactionService.getAllTransactions(page, limit, filters);

            return res.status(200).json({
                success: true,
                transactions: result.transactions,
                total: result.total,
                page,
                limit,
                totalPages: result.totalPages,
                pendingCount: result.pendingCount,
                pendingTotal: result.pendingTotal,
                cancelledCount: result.cancelledCount,
                cancelledTotal: result.cancelledTotal,
                pendingDebitCount: result.pendingDebitCount,
                pendingCreditCount: result.pendingCreditCount,
                cancelledDebitCount: result.cancelledDebitCount,
                cancelledCreditCount: result.cancelledCreditCount
            });
        } catch (error) {
            console.error('Error getting transactions:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error getting transactions'
            });
        }
    }

    /**
     * Get transaction by ID
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getTransactionById(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction ID is required'
                });
            }

            const transaction = await transactionService.getTransactionById(id);

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message: 'Transaction not found'
                });
            }

            return res.status(200).json({
                success: true,
                data: transaction
            });
        } catch (error) {
            console.error('Error getting transaction:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error getting transaction'
            });
        }
    }

    /**
     * Void (delete) a transaction
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async voidTransaction(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction ID is required'
                });
            }

            // Get the transaction to check its date
            const transaction = await db.Transaction.findByPk(id);
            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message: 'Transaction not found'
                });
            }

            // Check if transaction is in a closed period
            const account = await db.Account.findByPk(transaction.account_id);
            if (account && account.last_closed_date &&
                new Date(transaction.tx_date) <= new Date(account.last_closed_date)) {
                // Allow admin override if specified
                if (!req.body.admin_override) {
                    return res.status(403).json({
                        success: false,
                        message: `The transaction date falls in a closed accounting period (${account.last_closed_date}). Only administrators can make changes to closed periods.`
                    });
                }

                // If we get here, the user is an admin and has confirmed the override
                console.log(`Admin override used for voiding transaction in closed period: ${transaction.tx_date}`);
            }

            // Store the date and ledger head info for recalculation if needed
            const txDate = transaction.tx_date;
            const accountId = transaction.account_id;
            const ledgerHeadId = transaction.ledger_head_id;

            // Get transaction items to know which ledgers were affected
            const transactionItems = await db.TransactionItem.findAll({
                where: { transaction_id: id }
            });

            // Create a set of affected ledger head IDs
            const affectedLedgerHeadIds = new Set();
            affectedLedgerHeadIds.add(ledgerHeadId);
            transactionItems.forEach(item => {
                affectedLedgerHeadIds.add(item.ledger_head_id);
            });

            const result = await transactionService.voidTransaction(id);

            // If this was an admin override for a closed period, recalculate the monthly snapshots
            if (req.body.admin_override && account.last_closed_date &&
                new Date(txDate) <= new Date(account.last_closed_date)) {
                try {
                    // Import the service here to avoid circular dependencies
                    const monthlyClosureService = require('../services/monthlyClosureService');

                    // Recalculate snapshots for all affected ledger heads
                    for (const ledgerId of affectedLedgerHeadIds) {
                        await monthlyClosureService.recalculateMonthlySnapshots(
                            accountId,
                            ledgerId,
                            txDate
                        );
                    }

                    console.log(`Recalculated monthly snapshots after voiding transaction in closed period: ${txDate}`);
                } catch (recalcError) {
                    console.error('Failed to recalculate monthly snapshots:', recalcError);
                    // Don't fail the request, just log the error
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Transaction voided successfully'
            });
        } catch (error) {
            console.error('Error voiding transaction:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error voiding transaction'
            });
        }
    }

    /**
     * Get balances for a date (for debit transaction form)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getBalancesForDate(req, res) {
        try {
            const { date, account_id } = req.query;

            if (!date || !account_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Date and account ID are required'
                });
            }

            // Parse date for monthly snapshot
            const txDate = new Date(date);
            const month = txDate.getMonth() + 1; // 1-12
            const year = txDate.getFullYear();

            // Get all ledger heads for the account with their monthly balances
            const ledgerHeads = await db.LedgerHead.findAll({
                where: { account_id },
                include: [{
                    model: db.MonthlyLedgerBalance,
                    as: 'monthlyBalances',
                    where: { month, year },
                    required: false
                }]
            });

            return res.status(200).json({
                success: true,
                data: ledgerHeads
            });
        } catch (error) {
            console.error('Error getting balances for date:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error getting balances for date'
            });
        }
    }

    /**
     * Update a transaction
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async updateTransaction(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction ID is required'
                });
            }

            // Validate required fields
            if (!updateData.account_id || !updateData.ledger_head_id ||
                !updateData.amount || !updateData.tx_date || !updateData.cash_type) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }

            const transaction = await transactionService.updateTransaction(id, updateData);

            return res.status(200).json({
                success: true,
                transaction,
                message: 'Transaction updated successfully'
            });
        } catch (error) {
            console.error('Error updating transaction:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error updating transaction'
            });
        }
    }
}

module.exports = new TransactionController(); 