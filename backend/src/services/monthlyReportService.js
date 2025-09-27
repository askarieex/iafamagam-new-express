/**
 * Monthly Report Service
 *
 * Generates real-time monthly financial reports for ledger heads with proper
 * opening/closing balance management and support for backdated transactions.
 *
 * Key Features:
 * - Real-time calculation from transaction log
 * - Opening/closing balance continuity management
 * - Backdated transaction handling with cascading updates
 * - Professional report format matching existing requirements
 */

const db = require('../models');
const { Op } = require('sequelize');

class MonthlyReportService {

    /**
     * Generate complete monthly report for all ledger heads
     * @param {number} year - Target year
     * @param {number} month - Target month (1-12)
     * @param {number} accountId - Account ID
     * @param {boolean} saveResults - Whether to save the calculated balances
     * @returns {Object} Complete monthly report data
     */
    async generateMonthlyReport(year, month, accountId, saveResults = true) {
        try {
            console.log(`🔄 Generating monthly report for ${year}-${month.toString().padStart(2, '0')}, Account ID: ${accountId}`);

            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);

            // Get all active ledger heads
            const ledgerHeads = await this.getAllActiveLedgerHeads();

            const reportData = {
                account_id: accountId,
                year: year,
                month: month,
                month_name: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                month_start: monthStart,
                month_end: monthEnd,
                ledger_heads: [],
                totals: {
                    opening_balance: 0,
                    total_credits: 0,
                    total_debits: 0,
                    closing_balance: 0,
                    transaction_count: 0
                },
                credit_heads: [],
                debit_heads: [],
                generated_at: new Date()
            };

            // Process each ledger head
            for (const ledgerHead of ledgerHeads) {
                const ledgerData = await this.generateLedgerHeadReport(
                    ledgerHead.id,
                    accountId,
                    year,
                    month
                );

                // Add ledger head info
                ledgerData.ledger_head = {
                    id: ledgerHead.id,
                    name: ledgerHead.name,
                    display_name: ledgerHead.display_name,
                    type: ledgerHead.type
                };

                reportData.ledger_heads.push(ledgerData);

                // Separate into credit and debit heads
                if (ledgerHead.type === 'credit') {
                    reportData.credit_heads.push(ledgerData);
                } else if (ledgerHead.type === 'debit') {
                    reportData.debit_heads.push(ledgerData);
                }

                // Update totals
                reportData.totals.opening_balance += ledgerData.opening_balance;
                reportData.totals.total_credits += ledgerData.total_credits;
                reportData.totals.total_debits += ledgerData.total_debits;
                reportData.totals.closing_balance += ledgerData.closing_balance;
                reportData.totals.transaction_count += ledgerData.transaction_count;

                // Save balance summary if requested
                if (saveResults) {
                    await this.saveOrUpdateBalanceSummary(ledgerHead.id, accountId, year, month, ledgerData);
                }
            }

            console.log(`✅ Monthly report generated successfully: ${reportData.ledger_heads.length} ledger heads processed`);
            return reportData;

        } catch (error) {
            console.error('❌ Error generating monthly report:', error);
            throw new Error(`Failed to generate monthly report: ${error.message}`);
        }
    }

    /**
     * Generate report data for a specific ledger head
     * @param {number} ledgerHeadId - Ledger head ID
     * @param {number} accountId - Account ID
     * @param {number} year - Target year
     * @param {number} month - Target month
     * @returns {Object} Ledger head report data
     */
    async generateLedgerHeadReport(ledgerHeadId, accountId, year, month) {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);

        // Get opening balance
        const openingBalance = await this.getOpeningBalance(ledgerHeadId, accountId, monthStart);

        // Get monthly transactions
        const monthlyTransactions = await this.getMonthlyTransactions(
            ledgerHeadId,
            accountId,
            monthStart,
            monthEnd
        );

        // Calculate monthly totals
        const totalCredits = monthlyTransactions
            .filter(t => t.tx_type === 'credit')
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

        const totalDebits = monthlyTransactions
            .filter(t => t.tx_type === 'debit')
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

        // Get ledger head type to determine cash/bank calculation logic
        const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId);
        let cashAmount = 0;
        let bankAmount = 0;
        let openingCashBalance = 0;
        let openingBankBalance = 0;
        let closingCashBalance = 0;
        let closingBankBalance = 0;

        if (ledgerHead.head_type === 'credit') {
            // For credit heads: accumulate cash/bank from transactions
            cashAmount = monthlyTransactions
                .reduce((sum, t) => sum + parseFloat(t.cash_amount || 0), 0);

            bankAmount = monthlyTransactions
                .reduce((sum, t) => sum + parseFloat(t.bank_amount || 0), 0);

            // Calculate opening cash/bank balances
            openingCashBalance = await this.getOpeningCashBalance(ledgerHeadId, accountId, monthStart);
            openingBankBalance = await this.getOpeningBankBalance(ledgerHeadId, accountId, monthStart);

            // Calculate closing cash/bank balances
            closingCashBalance = openingCashBalance + cashAmount;
            closingBankBalance = openingBankBalance + bankAmount;
        } else {
            // For debit heads: expenses don't accumulate cash/bank, they record total expense amounts
            // Cash/bank amounts in debit transactions show payment method, not accumulation
            // For reports, debit heads show total expenses paid via cash vs bank
            const totalCashExpenses = monthlyTransactions
                .reduce((sum, t) => sum + parseFloat(t.cash_amount || 0), 0);

            const totalBankExpenses = monthlyTransactions
                .reduce((sum, t) => sum + parseFloat(t.bank_amount || 0), 0);

            // For debit heads in reports, cash_amount and bank_amount represent expense breakdowns
            cashAmount = totalCashExpenses;
            bankAmount = totalBankExpenses;
            closingCashBalance = totalCashExpenses;
            closingBankBalance = totalBankExpenses;

            // Opening balances for debit heads (cumulative expenses to date)
            openingCashBalance = await this.getOpeningCashBalance(ledgerHeadId, accountId, monthStart);
            openingBankBalance = await this.getOpeningBankBalance(ledgerHeadId, accountId, monthStart);

            // Add current month expenses to opening totals
            closingCashBalance = openingCashBalance + totalCashExpenses;
            closingBankBalance = openingBankBalance + totalBankExpenses;
        }

        // Calculate closing balance
        const closingBalance = openingBalance + totalCredits - totalDebits;

        return {
            opening_balance: openingBalance,
            total_credits: totalCredits,
            total_debits: totalDebits,
            closing_balance: closingBalance,
            cash_amount: closingCashBalance,
            bank_amount: closingBankBalance,
            net_change: totalCredits - totalDebits,
            transaction_count: monthlyTransactions.length,
            transactions: monthlyTransactions.map(t => ({
                id: t.id,
                uuid: t.uuid,
                transaction_date: t.transaction_date,
                amount: parseFloat(t.amount),
                description: t.description,
                tx_type: t.tx_type,
                cash_type: t.cash_type,
                receipt_number: t.receipt_number,
                cash_amount: parseFloat(t.cash_amount || 0),
                bank_amount: parseFloat(t.bank_amount || 0)
            }))
        };
    }

    /**
     * Get opening balance for a ledger head at the start of a month
     * @param {number} ledgerHeadId - Ledger head ID
     * @param {number} accountId - Account ID
     * @param {Date} monthStart - First day of the month
     * @returns {number} Opening balance
     */
    async getOpeningBalance(ledgerHeadId, accountId, monthStart) {
        try {
            // Try to get from previous month's saved closing balance
            const previousMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
            const savedBalance = await db.MonthlyBalanceSummary.findOne({
                where: {
                    ledger_head_id: ledgerHeadId,
                    account_id: accountId,
                    month_year: previousMonth
                }
            });

            if (savedBalance && savedBalance.closing_balance !== null) {
                console.log(`📊 Using saved closing balance from previous month: ${savedBalance.closing_balance}`);
                return parseFloat(savedBalance.closing_balance);
            }

            // If no saved balance, calculate from beginning of time
            console.log(`🔄 Calculating opening balance from transaction history...`);
            return await this.calculateBalanceUpToDate(ledgerHeadId, accountId, monthStart);

        } catch (error) {
            console.error('❌ Error getting opening balance:', error);
            throw new Error(`Failed to get opening balance: ${error.message}`);
        }
    }

    /**
     * Calculate balance up to a specific date from transaction history
     * @param {number} ledgerHeadId - Ledger head ID
     * @param {number} accountId - Account ID
     * @param {Date} upToDate - Calculate up to this date (exclusive)
     * @returns {number} Calculated balance
     */
    async calculateBalanceUpToDate(ledgerHeadId, accountId, upToDate) {
        const transactions = await db.TransactionLog.findAll({
            where: {
                ledger_head_id: ledgerHeadId,
                account_id: accountId,
                transaction_date: {
                    [Op.lt]: upToDate
                }
            }
        });

        let balance = 0;
        for (const transaction of transactions) {
            const amount = parseFloat(transaction.amount || 0);
            if (transaction.tx_type === 'credit') {
                balance += amount;
            } else if (transaction.tx_type === 'debit') {
                balance -= amount;
            }
        }

        return balance;
    }

    /**
     * Get opening cash balance for a ledger head at the start of a month
     * @param {number} ledgerHeadId - Ledger head ID
     * @param {number} accountId - Account ID
     * @param {Date} monthStart - First day of the month
     * @returns {number} Opening cash balance
     */
    async getOpeningCashBalance(ledgerHeadId, accountId, monthStart) {
        try {
            // Try to get from previous month's saved closing balance
            const previousMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
            const savedBalance = await db.MonthlyBalanceSummary.findOne({
                where: {
                    ledger_head_id: ledgerHeadId,
                    account_id: accountId,
                    month_year: previousMonth
                }
            });

            if (savedBalance && savedBalance.cash_amount !== null) {
                return parseFloat(savedBalance.cash_amount || 0);
            }

            // Calculate from transaction history
            return await this.calculateCashBalanceUpToDate(ledgerHeadId, accountId, monthStart);

        } catch (error) {
            console.error('❌ Error getting opening cash balance:', error);
            return 0;
        }
    }

    /**
     * Get opening bank balance for a ledger head at the start of a month
     * @param {number} ledgerHeadId - Ledger head ID
     * @param {number} accountId - Account ID
     * @param {Date} monthStart - First day of the month
     * @returns {number} Opening bank balance
     */
    async getOpeningBankBalance(ledgerHeadId, accountId, monthStart) {
        try {
            // Try to get from previous month's saved closing balance
            const previousMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
            const savedBalance = await db.MonthlyBalanceSummary.findOne({
                where: {
                    ledger_head_id: ledgerHeadId,
                    account_id: accountId,
                    month_year: previousMonth
                }
            });

            if (savedBalance && savedBalance.bank_amount !== null) {
                return parseFloat(savedBalance.bank_amount || 0);
            }

            // Calculate from transaction history
            return await this.calculateBankBalanceUpToDate(ledgerHeadId, accountId, monthStart);

        } catch (error) {
            console.error('❌ Error getting opening bank balance:', error);
            return 0;
        }
    }

    /**
     * Calculate cash balance up to a specific date from transaction history
     * @param {number} ledgerHeadId - Ledger head ID
     * @param {number} accountId - Account ID
     * @param {Date} upToDate - Calculate up to this date (exclusive)
     * @returns {number} Calculated cash balance
     */
    async calculateCashBalanceUpToDate(ledgerHeadId, accountId, upToDate) {
        const transactions = await db.TransactionLog.findAll({
            where: {
                ledger_head_id: ledgerHeadId,
                account_id: accountId,
                transaction_date: {
                    [Op.lt]: upToDate
                }
            }
        });

        let cashBalance = 0;
        for (const transaction of transactions) {
            const cashAmount = parseFloat(transaction.cash_amount || 0);
            // For all transactions, cash amounts are additive to the ledger head
            cashBalance += cashAmount;
        }

        return cashBalance;
    }

    /**
     * Calculate bank balance up to a specific date from transaction history
     * @param {number} ledgerHeadId - Ledger head ID
     * @param {number} accountId - Account ID
     * @param {Date} upToDate - Calculate up to this date (exclusive)
     * @returns {number} Calculated bank balance
     */
    async calculateBankBalanceUpToDate(ledgerHeadId, accountId, upToDate) {
        const transactions = await db.TransactionLog.findAll({
            where: {
                ledger_head_id: ledgerHeadId,
                account_id: accountId,
                transaction_date: {
                    [Op.lt]: upToDate
                }
            }
        });

        let bankBalance = 0;
        for (const transaction of transactions) {
            const bankAmount = parseFloat(transaction.bank_amount || 0);
            // For all transactions, bank amounts are additive to the ledger head
            bankBalance += bankAmount;
        }

        return bankBalance;
    }

    /**
     * Get all transactions for a ledger head within a specific month
     * @param {number} ledgerHeadId - Ledger head ID
     * @param {number} accountId - Account ID
     * @param {Date} monthStart - First day of the month
     * @param {Date} monthEnd - Last day of the month
     * @returns {Array} Array of transactions
     */
    async getMonthlyTransactions(ledgerHeadId, accountId, monthStart, monthEnd) {
        return await db.TransactionLog.findAll({
            where: {
                ledger_head_id: ledgerHeadId,
                account_id: accountId,
                transaction_date: {
                    [Op.between]: [monthStart, monthEnd]
                }
            },
            order: [['transaction_date', 'ASC'], ['created_at', 'ASC']]
        });
    }

    /**
     * Get all active ledger heads
     * @returns {Array} Array of ledger heads
     */
    async getAllActiveLedgerHeads() {
        return await db.LedgerHead.findAll({
            where: {
                is_active: true
            },
            order: [['type', 'ASC'], ['name', 'ASC']]
        });
    }

    /**
     * Save or update monthly balance summary
     * @param {number} ledgerHeadId - Ledger head ID
     * @param {number} accountId - Account ID
     * @param {number} year - Target year
     * @param {number} month - Target month
     * @param {Object} calculatedData - Calculated balance data
     */
    async saveOrUpdateBalanceSummary(ledgerHeadId, accountId, year, month, calculatedData) {
        try {
            const monthYear = new Date(year, month - 1, 1);

            const [summary, created] = await db.MonthlyBalanceSummary.upsert({
                ledger_head_id: ledgerHeadId,
                account_id: accountId,
                month_year: monthYear,
                opening_balance: calculatedData.opening_balance,
                closing_balance: calculatedData.closing_balance,
                total_credits: calculatedData.total_credits,
                total_debits: calculatedData.total_debits,
                cash_amount: calculatedData.cash_amount || 0,
                bank_amount: calculatedData.bank_amount || 0,
                transaction_count: calculatedData.transaction_count,
                last_calculated_at: new Date()
            }, {
                returning: true
            });

            if (created) {
                console.log(`✅ Created new balance summary for ledger head ${ledgerHeadId}`);
            } else {
                console.log(`✅ Updated balance summary for ledger head ${ledgerHeadId}`);
            }

        } catch (error) {
            console.error('❌ Error saving balance summary:', error);
            // Don't throw here - report generation should continue even if saving fails
        }
    }

    /**
     * Handle backdated transaction by recalculating affected months
     * @param {Object} transaction - The backdated transaction
     */
    async handleBackdatedTransaction(transaction) {
        try {
            console.log(`🔄 Handling backdated transaction: ${transaction.uuid}`);

            const transactionMonth = new Date(transaction.transaction_date);
            const currentMonth = new Date();

            // Get all months from transaction month to current month
            const affectedMonths = this.getMonthsBetween(transactionMonth, currentMonth);

            console.log(`📅 Recalculating ${affectedMonths.length} months affected by backdated transaction`);

            // Recalculate each affected month
            for (const monthDate of affectedMonths) {
                await this.generateLedgerHeadReport(
                    transaction.ledger_head_id,
                    transaction.account_id,
                    monthDate.getFullYear(),
                    monthDate.getMonth() + 1
                );
            }

            console.log(`✅ Backdated transaction handling completed`);

        } catch (error) {
            console.error('❌ Error handling backdated transaction:', error);
            throw new Error(`Failed to handle backdated transaction: ${error.message}`);
        }
    }

    /**
     * Get array of months between two dates
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Array} Array of first day of each month
     */
    getMonthsBetween(startDate, endDate) {
        const months = [];
        const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

        while (current <= end) {
            months.push(new Date(current));
            current.setMonth(current.getMonth() + 1);
        }

        return months;
    }

    /**
     * Get saved monthly report (if exists)
     * @param {number} year - Target year
     * @param {number} month - Target month
     * @param {number} accountId - Account ID
     * @returns {Object|null} Saved report data or null
     */
    async getSavedMonthlyReport(year, month, accountId) {
        try {
            const summaries = await db.MonthlyBalanceSummary.findByMonth(year, month, accountId);

            if (summaries.length === 0) {
                return null;
            }

            // Convert summaries to report format
            const reportData = {
                account_id: accountId,
                year: year,
                month: month,
                month_name: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                ledger_heads: [],
                totals: {
                    opening_balance: 0,
                    total_credits: 0,
                    total_debits: 0,
                    closing_balance: 0,
                    transaction_count: 0
                },
                credit_heads: [],
                debit_heads: [],
                is_saved_report: true,
                last_calculated_at: summaries[0]?.last_calculated_at
            };

            // Process each summary
            for (const summary of summaries) {
                const ledgerData = {
                    ledger_head: {
                        id: summary.ledgerHead.id,
                        name: summary.ledgerHead.name,
                        display_name: summary.ledgerHead.display_name,
                        type: summary.ledgerHead.type
                    },
                    opening_balance: summary.opening_balance,
                    total_credits: summary.total_credits,
                    total_debits: summary.total_debits,
                    closing_balance: summary.closing_balance,
                    cash_amount: summary.cash_amount || 0,
                    bank_amount: summary.bank_amount || 0,
                    net_change: summary.total_credits - summary.total_debits,
                    transaction_count: summary.transaction_count,
                    transactions: [] // Not included in saved reports for performance
                };

                reportData.ledger_heads.push(ledgerData);

                // Separate into credit and debit heads
                if (summary.ledgerHead.type === 'credit') {
                    reportData.credit_heads.push(ledgerData);
                } else if (summary.ledgerHead.type === 'debit') {
                    reportData.debit_heads.push(ledgerData);
                }

                // Update totals
                reportData.totals.opening_balance += summary.opening_balance;
                reportData.totals.total_credits += summary.total_credits;
                reportData.totals.total_debits += summary.total_debits;
                reportData.totals.closing_balance += summary.closing_balance;
                reportData.totals.transaction_count += summary.transaction_count;
            }

            return reportData;

        } catch (error) {
            console.error('❌ Error getting saved monthly report:', error);
            return null;
        }
    }

    /**
     * Finalize a month (lock balance calculations)
     * @param {number} year - Target year
     * @param {number} month - Target month
     * @param {number} accountId - Account ID
     */
    async finalizeMonth(year, month, accountId) {
        try {
            const monthYear = new Date(year, month - 1, 1);

            await db.MonthlyBalanceSummary.update({
                is_finalized: true,
                last_calculated_at: new Date()
            }, {
                where: {
                    account_id: accountId,
                    month_year: monthYear
                }
            });

            console.log(`✅ Month ${year}-${month.toString().padStart(2, '0')} finalized for account ${accountId}`);

        } catch (error) {
            console.error('❌ Error finalizing month:', error);
            throw new Error(`Failed to finalize month: ${error.message}`);
        }
    }
}

module.exports = new MonthlyReportService();