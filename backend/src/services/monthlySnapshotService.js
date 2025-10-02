/**
 * Monthly Snapshot Service
 *
 * Handles creation and maintenance of monthly balance snapshots
 * Uses exact same calculation logic as immutableTransactionService
 */

const db = require('../models');
const { Op } = require('sequelize');
const immutableTransactionService = require('./immutableTransactionService');

class MonthlySnapshotService {

    /**
     * Calculate cash and bank balances for a specific month using your exact logic
     */
    async calculateMonthlyBalances(accountId, ledgerHeadId, year, month) {
        try {
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0, 23, 59, 59);

            // Get opening balance (all transactions before this month)
            const openingBalance = await this.calculateOpeningBalance(accountId, ledgerHeadId, monthStart);

            // Get month transactions
            const monthTransactions = await db.TransactionLog.findAll({
                where: {
                    account_id: accountId,
                    ledger_head_id: ledgerHeadId,
                    transaction_date: {
                        [Op.between]: [monthStart, monthEnd]
                    }
                },
                order: [['transaction_date', 'ASC']]
            });

            // Calculate monthly totals
            let totalCredits = 0;
            let totalDebits = 0;
            let cashAmount = 0;
            let bankAmount = 0;

            monthTransactions.forEach(tx => {
                const amount = parseFloat(tx.amount || 0);
                const txCash = parseFloat(tx.cash_amount || 0);
                const txBank = parseFloat(tx.bank_amount || 0);

                if (tx.tx_type === 'credit') {
                    totalCredits += amount;
                    cashAmount += txCash;
                    bankAmount += txBank;
                } else {
                    totalDebits += amount;
                    // For debits, track what payment method was used
                    cashAmount -= txCash;
                    bankAmount -= txBank;
                }
            });

            // Get ledger head type to determine balance calculation
            const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId);

            // Calculate closing balance using appropriate logic for head type
            let closingBalance;
            if (ledgerHead.head_type === 'credit') {
                // For credit heads: Credits - Debits (normal balance calculation)
                closingBalance = await immutableTransactionService.calculateCurrentBalance(
                    accountId,
                    ledgerHeadId,
                    monthEnd.toISOString().split('T')[0]
                );
            } else {
                // For debit heads (expenses): Show total debits as positive amount
                closingBalance = totalDebits;
            }

            // For cash/bank breakdown, calculate the actual amounts from transactions
            // For credit heads, this represents the composition of the balance
            let finalCashAmount = 0;
            let finalBankAmount = 0;

            if (closingBalance > 0) {
                // Calculate cash/bank breakdown from all transactions up to month end
                const allTransactions = await db.TransactionLog.findAll({
                    where: {
                        account_id: accountId,
                        ledger_head_id: ledgerHeadId,
                        transaction_date: {
                            [Op.lte]: monthEnd
                        }
                    }
                });

                // CRITICAL FIX: Also get source deductions (when this ledger is used as source for expenses)
                const sourceDeductions = await db.TransactionLog.findAll({
                    where: {
                        account_id: accountId,
                        source_ledger_head_id: ledgerHeadId,
                        tx_type: 'debit',
                        transaction_date: {
                            [Op.lte]: monthEnd
                        }
                    }
                });

                let totalCashFlow = 0;
                let totalBankFlow = 0;

                // Process direct transactions to this ledger
                allTransactions.forEach(tx => {
                    const txCash = parseFloat(tx.cash_amount || 0);
                    const txBank = parseFloat(tx.bank_amount || 0);

                    if (tx.tx_type === 'credit') {
                        totalCashFlow += txCash;
                        totalBankFlow += txBank;
                    } else {
                        totalCashFlow -= txCash;
                        totalBankFlow -= txBank;
                    }
                });

                // Process source deductions (expenses paid from this ledger)
                sourceDeductions.forEach(tx => {
                    const txCash = parseFloat(tx.cash_amount || 0);
                    const txBank = parseFloat(tx.bank_amount || 0);

                    // These are expenses FROM this ledger, so subtract the cash/bank used
                    totalCashFlow -= txCash;
                    totalBankFlow -= txBank;
                });

                finalCashAmount = Math.max(0, totalCashFlow);
                finalBankAmount = Math.max(0, totalBankFlow);
            }

            return {
                opening_balance: openingBalance,
                closing_balance: closingBalance,
                total_credits: totalCredits,
                total_debits: totalDebits,
                cash_amount: finalCashAmount,
                bank_amount: finalBankAmount,
                transaction_count: monthTransactions.length
            };

        } catch (error) {
            console.error('Error calculating monthly balances:', error);
            throw error;
        }
    }

    /**
     * Calculate opening balance (all transactions before given date)
     */
    async calculateOpeningBalance(accountId, ledgerHeadId, beforeDate) {
        try {
            const result = await db.TransactionLog.findAll({
                where: {
                    account_id: accountId,
                    ledger_head_id: ledgerHeadId,
                    transaction_date: { [Op.lt]: beforeDate }
                },
                attributes: [
                    'tx_type',
                    [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'total_amount']
                ],
                group: ['tx_type'],
                raw: true
            });

            let credits = 0;
            let debits = 0;

            result.forEach(row => {
                const amount = parseFloat(row.total_amount || 0);
                if (row.tx_type === 'credit') {
                    credits = amount;
                } else {
                    debits = amount;
                }
            });

            return credits - debits;
        } catch (error) {
            console.error('Error calculating opening balance:', error);
            return 0;
        }
    }

    /**
     * Create or update monthly snapshot for a specific month
     * Uses upsert to prevent race conditions and duplicates
     */
    async createMonthlySnapshot(accountId, ledgerHeadId, year, month) {
        try {
            console.log(`📸 Creating snapshot for account ${accountId}, ledger ${ledgerHeadId}, ${year}-${month}`);

            const monthYear = `${year}-${month.toString().padStart(2, '0')}-01`;

            // Calculate balances using your exact logic
            const balances = await this.calculateMonthlyBalances(accountId, ledgerHeadId, year, month);

            const snapshotData = {
                ledger_head_id: ledgerHeadId,
                account_id: accountId,
                month_year: monthYear,
                opening_balance: balances.opening_balance,
                closing_balance: balances.closing_balance,
                total_credits: balances.total_credits,
                total_debits: balances.total_debits,
                cash_amount: balances.cash_amount,
                bank_amount: balances.bank_amount,
                transaction_count: balances.transaction_count,
                is_finalized: false,
                last_calculated_at: new Date()
            };

            // Use upsert to prevent race conditions and duplicates
            // This will either update an existing record or create a new one atomically
            const [snapshot, created] = await db.MonthlyBalanceSummary.upsert(snapshotData, {
                where: {
                    ledger_head_id: ledgerHeadId,
                    account_id: accountId,
                    month_year: monthYear
                },
                returning: true
            });

            if (created) {
                console.log(`✅ Created new snapshot for ${year}-${month}`);
            } else {
                console.log(`✅ Updated existing snapshot for ${year}-${month}`);
            }

            return snapshot;

        } catch (error) {
            console.error('Error creating monthly snapshot:', error);
            throw error;
        }
    }

    /**
     * Generate snapshots for all existing data
     */
    async generateHistoricalSnapshots() {
        try {
            console.log('🔄 Generating historical snapshots for all existing data...');

            // Get all ledger heads that have transactions
            const ledgerHeadsWithTransactions = await db.sequelize.query(
                `SELECT DISTINCT ledger_head_id as id, account_id
                 FROM transaction_log
                 ORDER BY account_id, ledger_head_id`,
                { type: db.sequelize.QueryTypes.SELECT }
            );

            const ledgerHeads = await db.LedgerHead.findAll({
                where: {
                    id: ledgerHeadsWithTransactions.map(lh => lh.id)
                },
                attributes: ['id', 'account_id']
            });

            // Get all unique year-month combinations from transaction log
            const monthsResult = await db.TransactionLog.findAll({
                attributes: [
                    [db.sequelize.fn('EXTRACT', db.sequelize.literal('YEAR FROM transaction_date')), 'year'],
                    [db.sequelize.fn('EXTRACT', db.sequelize.literal('MONTH FROM transaction_date')), 'month']
                ],
                group: [
                    db.sequelize.fn('EXTRACT', db.sequelize.literal('YEAR FROM transaction_date')),
                    db.sequelize.fn('EXTRACT', db.sequelize.literal('MONTH FROM transaction_date'))
                ],
                order: [
                    [db.sequelize.fn('EXTRACT', db.sequelize.literal('YEAR FROM transaction_date')), 'ASC'],
                    [db.sequelize.fn('EXTRACT', db.sequelize.literal('MONTH FROM transaction_date')), 'ASC']
                ],
                raw: true
            });

            let snapshotsCreated = 0;

            // Create snapshots for each ledger head for each month
            for (const ledgerHead of ledgerHeads) {
                for (const monthData of monthsResult) {
                    const year = parseInt(monthData.year);
                    const month = parseInt(monthData.month);

                    await this.createMonthlySnapshot(
                        ledgerHead.account_id,
                        ledgerHead.id,
                        year,
                        month
                    );
                    snapshotsCreated++;
                }
            }

            console.log(`✅ Generated ${snapshotsCreated} historical snapshots`);
            return snapshotsCreated;

        } catch (error) {
            console.error('Error generating historical snapshots:', error);
            throw error;
        }
    }

    /**
     * Update snapshots when a transaction is created (handles backdated transactions)
     */
    async updateSnapshotsAfterTransaction(transactionLogEntry) {
        try {
            const transactionDate = new Date(transactionLogEntry.transaction_date);
            const year = transactionDate.getFullYear();
            const month = transactionDate.getMonth() + 1;

            console.log(`🔄 Updating snapshots after transaction for ${year}-${month}`);

            // Update snapshot for the transaction's month
            await this.createMonthlySnapshot(
                transactionLogEntry.account_id,
                transactionLogEntry.ledger_head_id,
                year,
                month
            );

            // If this is a backdated transaction, update all subsequent months
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth() + 1;

            if (year < currentYear || (year === currentYear && month < currentMonth)) {
                console.log('🔄 Backdated transaction detected, updating subsequent months...');

                // Update all months from transaction month to current month
                let updateYear = year;
                let updateMonth = month + 1;

                while (updateYear < currentYear || (updateYear === currentYear && updateMonth <= currentMonth)) {
                    if (updateMonth > 12) {
                        updateMonth = 1;
                        updateYear++;
                    }

                    await this.createMonthlySnapshot(
                        transactionLogEntry.account_id,
                        transactionLogEntry.ledger_head_id,
                        updateYear,
                        updateMonth
                    );

                    updateMonth++;
                }
            }

            console.log('✅ Snapshots updated successfully');

        } catch (error) {
            console.error('Error updating snapshots after transaction:', error);
            throw error;
        }
    }

    /**
     * Finalize a month (lock it from further changes)
     */
    async finalizeMonth(accountId, year, month) {
        try {
            const monthYear = `${year}-${month.toString().padStart(2, '0')}-01`;

            const result = await db.MonthlyBalanceSummary.update(
                {
                    is_finalized: true,
                    last_calculated_at: new Date()
                },
                {
                    where: {
                        account_id: accountId,
                        month_year: monthYear
                    }
                }
            );

            console.log(`🔒 Finalized ${result[0]} snapshots for ${year}-${month}`);
            return result[0];

        } catch (error) {
            console.error('Error finalizing month:', error);
            throw error;
        }
    }
}

module.exports = new MonthlySnapshotService();