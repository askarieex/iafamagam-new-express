/**
 * Real-Time Balance Service
 *
 * This service provides automatic real-time balance calculations and updates.
 * It ensures that balances are always current and that month-to-month balance
 * continuity is maintained automatically without manual intervention.
 *
 * Key Features:
 * - Automatic balance updates when transactions are added
 * - Real-time opening/closing balance calculations
 * - Month-to-month balance continuity
 * - Backdated transaction handling with cascade updates
 * - Performance optimization through smart caching
 */

const { Op } = require('sequelize');
const { sequelize } = require('../models');
const TransactionLog = require('../models/transactionLog')(sequelize);
const MonthlyBalanceSummary = require('../models/monthlyBalanceSummary')(sequelize);
const LedgerHead = require('../models/ledgerHead')(sequelize);

class RealTimeBalanceService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Update balances when a new transaction is added
     */
    async onTransactionAdded(transaction) {
        try {
            console.log(`🔄 Processing real-time balance update for transaction ${transaction.id}`);

            const transactionDate = new Date(transaction.tx_date);
            const affectedMonths = await this.getAffectedMonths(transactionDate, transaction.account_id);

            // Update all affected months in chronological order
            for (const monthData of affectedMonths) {
                await this.updateMonthlyBalances(
                    monthData.year,
                    monthData.month,
                    transaction.account_id
                );
            }

            // Clear relevant cache entries
            this.clearCacheForAccount(transaction.account_id);

            console.log(`✅ Real-time balance update completed for transaction ${transaction.id}`);

        } catch (error) {
            console.error(`❌ Error updating real-time balances:`, error);
            throw error;
        }
    }

    /**
     * Get all months that need balance updates from transaction date onwards
     */
    async getAffectedMonths(transactionDate, accountId) {
        const startMonth = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), 1);
        const currentDate = new Date();
        const months = [];

        let currentMonth = new Date(startMonth);

        // Get all months from transaction date to current month
        while (currentMonth <= currentDate) {
            months.push({
                year: currentMonth.getFullYear(),
                month: currentMonth.getMonth() + 1,
                monthStart: new Date(currentMonth)
            });

            // Move to next month
            currentMonth.setMonth(currentMonth.getMonth() + 1);
        }

        return months;
    }

    /**
     * Update monthly balances for a specific month in real-time
     */
    async updateMonthlyBalances(year, month, accountId) {
        try {
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0, 23, 59, 59);

            console.log(`🔄 Updating balances for ${year}-${month}, Account: ${accountId}`);

            // Get all ledger heads for this account
            const ledgerHeads = await LedgerHead.findAll({
                where: { account_id: accountId }
            });

            // Process each ledger head
            for (const ledgerHead of ledgerHeads) {
                await this.updateLedgerHeadBalance(
                    ledgerHead.id,
                    accountId,
                    year,
                    month,
                    monthStart,
                    monthEnd
                );
            }

            console.log(`✅ Monthly balances updated for ${year}-${month}, Account: ${accountId}`);

        } catch (error) {
            console.error(`❌ Error updating monthly balances for ${year}-${month}:`, error);
            throw error;
        }
    }

    /**
     * Update balance for a specific ledger head in a specific month
     */
    async updateLedgerHeadBalance(ledgerHeadId, accountId, year, month, monthStart, monthEnd) {
        try {
            // Calculate opening balance (previous month's closing balance)
            const openingBalance = await this.getOpeningBalance(ledgerHeadId, accountId, monthStart);

            // Get monthly transactions
            const monthlyTransactions = await TransactionLog.findAll({
                where: {
                    ledger_head_id: ledgerHeadId,
                    account_id: accountId,
                    tx_date: {
                        [Op.between]: [monthStart, monthEnd]
                    }
                }
            });

            // Calculate monthly totals
            const totals = monthlyTransactions.reduce((acc, tx) => {
                if (tx.entry_type === 'credit') {
                    acc.totalCredits += parseFloat(tx.amount);
                } else {
                    acc.totalDebits += parseFloat(tx.amount);
                }
                acc.transactionCount++;
                return acc;
            }, {
                totalCredits: 0,
                totalDebits: 0,
                transactionCount: 0
            });

            // Calculate closing balance
            const closingBalance = openingBalance + totals.totalCredits - totals.totalDebits;

            // Update or create monthly balance summary
            const monthYear = `${year}-${month.toString().padStart(2, '0')}-01`;

            await MonthlyBalanceSummary.upsert({
                ledger_head_id: ledgerHeadId,
                account_id: accountId,
                month_year: monthYear,
                opening_balance: openingBalance,
                closing_balance: closingBalance,
                total_credits: totals.totalCredits,
                total_debits: totals.totalDebits,
                transaction_count: totals.transactionCount,
                last_calculated_at: new Date()
            });

            console.log(`✅ Updated ledger ${ledgerHeadId} for ${year}-${month}: OB=${openingBalance}, CB=${closingBalance}`);

        } catch (error) {
            console.error(`❌ Error updating ledger head balance:`, error);
            throw error;
        }
    }

    /**
     * Get opening balance for a ledger head at the start of a month
     */
    async getOpeningBalance(ledgerHeadId, accountId, monthStart) {
        // Check cache first
        const cacheKey = `opening-${ledgerHeadId}-${accountId}-${monthStart.getTime()}`;
        const cached = this.getFromCache(cacheKey);
        if (cached !== null) {
            return cached;
        }

        try {
            // Try to get from previous month's closing balance
            const previousMonth = new Date(monthStart);
            previousMonth.setMonth(previousMonth.getMonth() - 1);
            const previousMonthYear = `${previousMonth.getFullYear()}-${(previousMonth.getMonth() + 1).toString().padStart(2, '0')}-01`;

            const previousMonthSummary = await MonthlyBalanceSummary.findOne({
                where: {
                    ledger_head_id: ledgerHeadId,
                    account_id: accountId,
                    month_year: previousMonthYear
                }
            });

            let openingBalance;

            if (previousMonthSummary) {
                // Use previous month's closing balance
                openingBalance = parseFloat(previousMonthSummary.closing_balance);
            } else {
                // Calculate from all transactions before this month
                const allPreviousTransactions = await TransactionLog.findAll({
                    where: {
                        ledger_head_id: ledgerHeadId,
                        account_id: accountId,
                        tx_date: {
                            [Op.lt]: monthStart
                        }
                    }
                });

                openingBalance = allPreviousTransactions.reduce((balance, tx) => {
                    if (tx.entry_type === 'credit') {
                        return balance + parseFloat(tx.amount);
                    } else {
                        return balance - parseFloat(tx.amount);
                    }
                }, 0);
            }

            // Cache the result
            this.setCache(cacheKey, openingBalance);
            return openingBalance;

        } catch (error) {
            console.error(`❌ Error calculating opening balance:`, error);
            return 0;
        }
    }

    /**
     * Get current real-time balance for a ledger head
     */
    async getCurrentBalance(ledgerHeadId, accountId) {
        try {
            // Calculate balance from all transactions
            const allTransactions = await TransactionLog.findAll({
                where: {
                    ledger_head_id: ledgerHeadId,
                    account_id: accountId
                }
            });

            const currentBalance = allTransactions.reduce((balance, tx) => {
                if (tx.entry_type === 'credit') {
                    return balance + parseFloat(tx.amount);
                } else {
                    return balance - parseFloat(tx.amount);
                }
            }, 0);

            return currentBalance;

        } catch (error) {
            console.error(`❌ Error calculating current balance:`, error);
            return 0;
        }
    }

    /**
     * Get live balance summary for an account
     */
    async getLiveBalanceSummary(accountId) {
        try {
            const ledgerHeads = await LedgerHead.findAll({
                where: { account_id: accountId }
            });

            const balanceSummary = [];

            for (const ledgerHead of ledgerHeads) {
                const currentBalance = await this.getCurrentBalance(ledgerHead.id, accountId);

                // Get total credits and debits for this ledger head
                const transactions = await TransactionLog.findAll({
                    where: {
                        ledger_head_id: ledgerHead.id,
                        account_id: accountId
                    }
                });

                let totalCredits = 0;
                let totalDebits = 0;

                transactions.forEach(tx => {
                    const amount = parseFloat(tx.amount || 0);
                    if (tx.tx_type === 'credit') {
                        totalCredits += amount;
                    } else {
                        totalDebits += amount;
                    }
                });

                balanceSummary.push({
                    ledger_head_id: ledgerHead.id,
                    ledger_head: ledgerHead,
                    current_balance: currentBalance,
                    total_credits: totalCredits,
                    total_debits: totalDebits,
                    transaction_count: transactions.length,
                    last_updated: new Date()
                });
            }

            return {
                account_id: accountId,
                balance_summary: balanceSummary,
                generated_at: new Date()
            };

        } catch (error) {
            console.error(`❌ Error generating live balance summary:`, error);
            throw error;
        }
    }

    /**
     * Trigger balance updates for backdated transactions
     */
    async handleBackdatedTransaction(transaction) {
        console.log(`🔄 Handling backdated transaction: ${transaction.id}`);

        // This will automatically update all affected months
        await this.onTransactionAdded(transaction);

        console.log(`✅ Backdated transaction processed: ${transaction.id}`);
    }

    /**
     * Cache management methods
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.value;
        }
        this.cache.delete(key);
        return null;
    }

    setCache(key, value) {
        this.cache.set(key, {
            value: value,
            timestamp: Date.now()
        });
    }

    clearCacheForAccount(accountId) {
        for (const [key] of this.cache) {
            if (key.includes(`-${accountId}-`)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Initialize service - ensure all current month balances are up to date
     */
    async initialize() {
        try {
            console.log('🚀 Initializing Real-Time Balance Service...');

            // This could be extended to update current month balances on startup
            // For now, balances will be calculated on-demand

            console.log('✅ Real-Time Balance Service initialized');

        } catch (error) {
            console.error('❌ Error initializing Real-Time Balance Service:', error);
            throw error;
        }
    }
}

// Export singleton instance
const realTimeBalanceService = new RealTimeBalanceService();

module.exports = realTimeBalanceService;