const transactionService = require('../services/transactionService');
const snapshotService = require('../services/snapshotService');
const db = require('../models');


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

            // Basic date validation - only prevent future dates
            const txDate = new Date(creditData.tx_date);
            const today = new Date();
            today.setHours(23, 59, 59, 999); // End of today

            if (txDate > today) {
                await t.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Future transaction dates are not allowed'
                });
            }

            const transaction = await transactionService.createCredit(creditData);


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

            // Basic date validation - only prevent future dates
            const txDate = new Date(debitData.tx_date);
            const today = new Date();
            today.setHours(23, 59, 59, 999); // End of today

            if (txDate > today) {
                await t.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Future transaction dates are not allowed'
                });
            }

            const transaction = await transactionService.createDebit(debitData);


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


            await transactionService.voidTransaction(id);


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

    /**
     * Get historical snapshot of all ledger heads as of a specific date
     * This is the core endpoint for the period-based accounting system
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getSnapshotForDate(req, res) {
        try {
            const { account_id, date } = req.query;

            // Validate required parameters
            if (!account_id || !date) {
                return res.status(400).json({
                    success: false,
                    message: 'account_id and date parameters are required'
                });
            }

            // Validate account exists
            const account = await db.Account.findByPk(account_id);
            if (!account) {
                return res.status(404).json({
                    success: false,
                    message: 'Account not found'
                });
            }

            // Validate date format
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                return res.status(400).json({
                    success: false,
                    message: 'Date must be in YYYY-MM-DD format'
                });
            }

            // Get snapshot data using the snapshot service
            const snapshotData = await snapshotService.snapshotForDate(account_id, date);

            return res.status(200).json({
                success: true,
                data: snapshotData,
                metadata: {
                    account_id: parseInt(account_id),
                    snapshot_date: date,
                    account_name: account.name,
                    total_ledgers: snapshotData.length
                }
            });
        } catch (error) {
            console.error('Error getting snapshot for date:', error);
            return res.status(500).json({
                success: false,
                message: 'Error retrieving historical snapshot',
                error: error.message
            });
        }
    }

    /**
     * Get historical snapshot for a specific ledger head as of a specific date
     * @param {Object} req - Express request object  
     * @param {Object} res - Express response object
     */
    async getLedgerSnapshotForDate(req, res) {
        try {
            const { account_id, ledger_head_id, date } = req.query;

            // Validate required parameters
            if (!account_id || !ledger_head_id || !date) {
                return res.status(400).json({
                    success: false,
                    message: 'account_id, ledger_head_id and date parameters are required'
                });
            }

            // Validate date format
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                return res.status(400).json({
                    success: false,
                    message: 'Date must be in YYYY-MM-DD format'
                });
            }

            // Get single ledger snapshot
            const snapshot = await snapshotService.snapshotForLedgerAtDate(account_id, ledger_head_id, date);

            if (!snapshot) {
                return res.status(404).json({
                    success: false,
                    message: 'Ledger head not found or no balance data available for the specified date'
                });
            }

            return res.status(200).json({
                success: true,
                data: snapshot,
                metadata: {
                    account_id: parseInt(account_id),
                    ledger_head_id: parseInt(ledger_head_id),
                    snapshot_date: date
                }
            });
        } catch (error) {
            console.error('Error getting ledger snapshot for date:', error);
            return res.status(500).json({
                success: false,
                message: 'Error retrieving historical ledger snapshot',
                error: error.message
            });
        }
    }
}

module.exports = new TransactionController(); 