/**
 * Balance Calendar Controller
 *
 * Provides API endpoints for viewing credit head balances by specific dates
 */

const immutableTransactionService = require('../services/immutableTransactionService');
const db = require('../models');

class BalanceCalendarController {

    /**
     * Get credit head balances as of a specific date
     * @route GET /api/reports/balance-by-date/:accountId
     */
    async getBalanceByDate(req, res) {
        try {
            const { accountId } = req.params;
            const { date } = req.query;

            console.log(`🔄 Balance by date request: ${date} for account ${accountId}`);

            // Validate parameters
            if (!accountId || isNaN(parseInt(accountId))) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid account ID is required',
                    error_type: 'VALIDATION_ERROR'
                });
            }

            if (!date) {
                return res.status(400).json({
                    success: false,
                    message: 'Date is required',
                    error_type: 'VALIDATION_ERROR'
                });
            }

            const targetDate = new Date(date);
            if (isNaN(targetDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format',
                    error_type: 'VALIDATION_ERROR'
                });
            }

            const accountIdNum = parseInt(accountId);

            // Get all credit heads for the account
            const creditHeads = await db.LedgerHead.findAll({
                where: {
                    account_id: accountIdNum,
                    head_type: 'credit',
                    is_active: true
                },
                order: [['name', 'ASC']]
            });

            const balanceData = {
                account_id: accountIdNum,
                date: date,
                date_formatted: targetDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                credit_heads: [],
                total_balance: 0
            };

            // Calculate balance for each credit head as of the target date
            for (const creditHead of creditHeads) {
                const balance = await immutableTransactionService.calculateCurrentBalance(
                    accountIdNum,
                    creditHead.id,
                    date
                );

                // Get cash and bank breakdown
                const { cashBalance, bankBalance } = await balanceCalendarController.getCashBankBalanceByDate(
                    accountIdNum,
                    creditHead.id,
                    date
                );

                const headData = {
                    id: creditHead.id,
                    name: creditHead.name,
                    display_name: creditHead.display_name,
                    balance: balance,
                    cash_balance: cashBalance,
                    bank_balance: bankBalance
                };

                balanceData.credit_heads.push(headData);
                balanceData.total_balance += balance;
            }

            console.log(`✅ Balance by date calculated: ${balanceData.credit_heads.length} credit heads`);

            return res.json({
                success: true,
                data: balanceData,
                message: `Credit head balances calculated for ${balanceData.date_formatted}`
            });

        } catch (error) {
            console.error('❌ Error getting balance by date:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get balance by date',
                error: error.message,
                error_type: 'BALANCE_CALCULATION_ERROR'
            });
        }
    }

    /**
     * Get cash and bank balance breakdown for a ledger head as of a specific date
     */
    async getCashBankBalanceByDate(accountId, ledgerHeadId, date) {
        try {
            const transactions = await db.TransactionLog.findAll({
                where: {
                    account_id: accountId,
                    ledger_head_id: ledgerHeadId,
                    transaction_date: {
                        [db.Sequelize.Op.lte]: date
                    }
                }
            });

            let cashBalance = 0;
            let bankBalance = 0;

            transactions.forEach(tx => {
                const cashAmount = parseFloat(tx.cash_amount || 0);
                const bankAmount = parseFloat(tx.bank_amount || 0);

                if (tx.tx_type === 'credit') {
                    cashBalance += cashAmount;
                    bankBalance += bankAmount;
                } else {
                    // For debit transactions, subtract (though rare for credit heads)
                    cashBalance -= cashAmount;
                    bankBalance -= bankAmount;
                }
            });

            return {
                cashBalance: Math.max(0, cashBalance),
                bankBalance: Math.max(0, bankBalance)
            };

        } catch (error) {
            console.error('Error calculating cash/bank balance:', error);
            return { cashBalance: 0, bankBalance: 0 };
        }
    }

    /**
     * Get detailed balance information for a specific ledger head on a specific date
     * @route GET /api/reports/ledger-balance/:accountId/:ledgerHeadId
     */
    async getLedgerBalance(req, res) {
        try {
            const { accountId, ledgerHeadId } = req.params;
            const { date } = req.query;

            console.log(`🔄 Ledger balance request: ledger ${ledgerHeadId} on ${date} for account ${accountId}`);

            // Validate parameters
            if (!accountId || isNaN(parseInt(accountId))) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid account ID is required',
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

            if (!date) {
                return res.status(400).json({
                    success: false,
                    message: 'Date is required',
                    error_type: 'VALIDATION_ERROR'
                });
            }

            const targetDate = new Date(date);
            if (isNaN(targetDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format',
                    error_type: 'VALIDATION_ERROR'
                });
            }

            const accountIdNum = parseInt(accountId);
            const ledgerHeadIdNum = parseInt(ledgerHeadId);

            // Get ledger head details
            const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadIdNum);
            if (!ledgerHead || ledgerHead.account_id !== accountIdNum) {
                return res.status(404).json({
                    success: false,
                    message: 'Ledger head not found or does not belong to the specified account',
                    error_type: 'NOT_FOUND'
                });
            }

            // Get account details
            const account = await db.Account.findByPk(accountIdNum);
            if (!account) {
                return res.status(404).json({
                    success: false,
                    message: 'Account not found',
                    error_type: 'NOT_FOUND'
                });
            }

            // Calculate total balance
            const balance = await immutableTransactionService.calculateCurrentBalance(
                accountIdNum,
                ledgerHeadIdNum,
                date
            );

            // Get cash and bank breakdown
            const { cashBalance, bankBalance } = await balanceCalendarController.getCashBankBalanceByDate(
                accountIdNum,
                ledgerHeadIdNum,
                date
            );

            // Get transaction summary
            const transactionSummary = await balanceCalendarController.getTransactionSummary(
                accountIdNum,
                ledgerHeadIdNum,
                date
            );

            const balanceData = {
                date: date,
                account_name: account.name,
                ledger_head: {
                    id: ledgerHead.id,
                    name: ledgerHead.name,
                    display_name: ledgerHead.display_name,
                    head_type: ledgerHead.head_type
                },
                balance: balance,
                cash_balance: cashBalance,
                bank_balance: bankBalance,
                transaction_summary: transactionSummary
            };

            console.log(`✅ Ledger balance calculated: ${ledgerHead.name} = ${balance}`);

            return res.json({
                success: true,
                data: balanceData,
                message: `Balance information retrieved for ${ledgerHead.name} on ${targetDate.toLocaleDateString()}`
            });

        } catch (error) {
            console.error('❌ Error getting ledger balance:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get ledger balance',
                error: error.message,
                error_type: 'BALANCE_CALCULATION_ERROR'
            });
        }
    }

    /**
     * Get transaction summary for a ledger head up to a specific date
     */
    async getTransactionSummary(accountId, ledgerHeadId, date) {
        try {
            const transactions = await db.TransactionLog.findAll({
                where: {
                    account_id: accountId,
                    ledger_head_id: ledgerHeadId,
                    transaction_date: {
                        [db.Sequelize.Op.lte]: date
                    }
                }
            });

            let totalCredits = 0;
            let totalDebits = 0;
            let transactionCount = transactions.length;

            transactions.forEach(tx => {
                const amount = parseFloat(tx.amount || 0);

                if (tx.tx_type === 'credit') {
                    totalCredits += amount;
                } else {
                    totalDebits += amount;
                }
            });

            const netChange = totalCredits - totalDebits;

            return {
                total_credits: totalCredits,
                total_debits: totalDebits,
                net_change: netChange,
                transaction_count: transactionCount
            };

        } catch (error) {
            console.error('Error calculating transaction summary:', error);
            return {
                total_credits: 0,
                total_debits: 0,
                net_change: 0,
                transaction_count: 0
            };
        }
    }

    /**
     * Get balance history for a credit head over a date range
     * @route GET /api/reports/balance-history/:accountId/:ledgerHeadId
     */
    async getBalanceHistory(req, res) {
        try {
            const { accountId, ledgerHeadId } = req.params;
            const { start_date, end_date } = req.query;

            console.log(`🔄 Balance history request: ledger ${ledgerHeadId}, ${start_date} to ${end_date}`);

            // Validate parameters
            if (!accountId || isNaN(parseInt(accountId))) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid account ID is required'
                });
            }

            if (!ledgerHeadId || isNaN(parseInt(ledgerHeadId))) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid ledger head ID is required'
                });
            }

            if (!start_date || !end_date) {
                return res.status(400).json({
                    success: false,
                    message: 'Start date and end date are required'
                });
            }

            const accountIdNum = parseInt(accountId);
            const ledgerHeadIdNum = parseInt(ledgerHeadId);

            // Get ledger head details
            const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadIdNum);
            if (!ledgerHead) {
                return res.status(404).json({
                    success: false,
                    message: 'Ledger head not found'
                });
            }

            const history = [];
            const startDate = new Date(start_date);
            const endDate = new Date(end_date);
            const currentDate = new Date(startDate);

            // Generate daily balance data
            while (currentDate <= endDate) {
                const dateStr = currentDate.toISOString().split('T')[0];
                const balance = await immutableTransactionService.calculateCurrentBalance(
                    accountIdNum,
                    ledgerHeadIdNum,
                    dateStr
                );

                history.push({
                    date: dateStr,
                    balance: balance
                });

                currentDate.setDate(currentDate.getDate() + 1);
            }

            return res.json({
                success: true,
                data: {
                    ledger_head: {
                        id: ledgerHead.id,
                        name: ledgerHead.name,
                        display_name: ledgerHead.display_name
                    },
                    history: history,
                    period: {
                        start_date: start_date,
                        end_date: end_date,
                        days_count: history.length
                    }
                },
                message: `Balance history generated for ${ledgerHead.name}`
            });

        } catch (error) {
            console.error('❌ Error getting balance history:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get balance history',
                error: error.message
            });
        }
    }
}

const balanceCalendarController = new BalanceCalendarController();
module.exports = balanceCalendarController;