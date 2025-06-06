const { Op } = require('sequelize');
const db = require('../models');
const { sequelize } = db;
const BalanceCalculator = require('../utils/balanceCalculator');

/**
 * Monthly Closure Service - handles month-end processes and period locking
 */
class MonthlyClosureService {
    /**
     * Closes an accounting period for a specific account or all accounts
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {number|null} accountId - Account ID (null for all accounts)
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} Results of the closure
     */
    async closeAccountingPeriod(month, year, accountId = null, transaction = null) {
        try {
            // Determine if we're using an existing transaction or creating our own
            let useTransaction = !!transaction;
            if (!transaction) {
                transaction = await sequelize.transaction();
            }

            // Calculate the last day of the month
            const lastDayOfMonth = new Date(year, month, 0).getDate();
            const endOfMonthDate = new Date(year, month - 1, lastDayOfMonth);

            // Date formatted as string YYYY-MM-DD for DB storage
            const endOfMonthStr = endOfMonthDate.toISOString().split('T')[0];

            // Set up where clause based on whether accountId was provided
            const where = accountId ? { id: accountId } : {};

            // Get the accounts to process
            const accounts = await db.Account.findAll({
                where,
                transaction
            });

            let results = [];

            // For each account, update the monthly snapshots and set the last_closed_date
            for (const account of accounts) {
                // Get all ledger heads for this account
                const ledgerHeads = await db.LedgerHead.findAll({
                    where: {
                        account_id: account.id
                    },
                    transaction
                });

                // For each ledger head, calculate and update the monthly snapshot
                for (const ledgerHead of ledgerHeads) {
                    // Calculate opening balance, receipts, payments, closing balance
                    const openingBalance = await BalanceCalculator.calculateOpeningBalance(
                        ledgerHead.id,
                        account.id,
                        month,
                        year,
                        transaction
                    );

                    const { receipts, payments } = await BalanceCalculator.calculateMonthlyActivity(
                        ledgerHead.id,
                        account.id,
                        month,
                        year,
                        transaction
                    );

                    const closingBalance = parseFloat(openingBalance) + parseFloat(receipts) - parseFloat(payments);

                    // Find or create monthly snapshot
                    const [monthlySnapshot, created] = await db.MonthlyLedgerBalance.findOrCreate({
                        where: {
                            ledger_head_id: ledgerHead.id,
                            account_id: account.id,
                            month,
                            year
                        },
                        defaults: {
                            opening_balance: openingBalance,
                            receipts,
                            payments,
                            closing_balance: closingBalance
                        },
                        transaction
                    });

                    // If it already exists, update it
                    if (!created) {
                        await monthlySnapshot.update({
                            opening_balance: openingBalance,
                            receipts,
                            payments,
                            closing_balance: closingBalance
                        }, { transaction });
                    }

                    // Update ledger head's current balance to match the latest calculation
                    await ledgerHead.update({
                        current_balance: closingBalance
                    }, { transaction });

                    // Prepare next month's snapshot with opening balance from this month's closing
                    let nextMonth = month === 12 ? 1 : month + 1;
                    let nextYear = month === 12 ? year + 1 : year;

                    const [nextMonthSnapshot] = await db.MonthlyLedgerBalance.findOrCreate({
                        where: {
                            ledger_head_id: ledgerHead.id,
                            account_id: account.id,
                            month: nextMonth,
                            year: nextYear
                        },
                        defaults: {
                            opening_balance: closingBalance,
                            receipts: 0,
                            payments: 0,
                            closing_balance: closingBalance
                        },
                        transaction
                    });

                    // If next month snapshot exists, only update opening balance if needed
                    if (!nextMonthSnapshot.isNewRecord &&
                        parseFloat(nextMonthSnapshot.opening_balance) !== parseFloat(closingBalance)) {
                        const newClosingBalance = parseFloat(closingBalance) +
                            parseFloat(nextMonthSnapshot.receipts) -
                            parseFloat(nextMonthSnapshot.payments);

                        await nextMonthSnapshot.update({
                            opening_balance: closingBalance,
                            closing_balance: newClosingBalance
                        }, { transaction });
                    }

                    results.push({
                        account_id: account.id,
                        ledger_head_id: ledgerHead.id,
                        month,
                        year,
                        opening_balance: openingBalance,
                        receipts,
                        payments,
                        closing_balance: closingBalance
                    });
                }

                // Update the account's last_closed_date
                await account.update({
                    last_closed_date: endOfMonthStr
                }, { transaction });
            }

            // Commit transaction if we created it
            if (!useTransaction) {
                await transaction.commit();
            }

            return {
                success: true,
                month,
                year,
                accountId,
                closedAt: new Date(),
                results
            };
        } catch (error) {
            // Rollback transaction if we created it
            if (transaction && !transaction.finished && !useTransaction) {
                await transaction.rollback();
            }

            console.error('Error in closeAccountingPeriod:', error);
            throw error;
        }
    }

    /**
     * Recalculates monthly snapshots after backdated transaction changes
     * @param {number} accountId - Account ID
     * @param {number} ledgerHeadId - Ledger Head ID
     * @param {string} fromDate - Start date for recalculation (YYYY-MM-DD)
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} Results of recalculation
     */
    async recalculateMonthlySnapshots(accountId, ledgerHeadId, fromDate, transaction = null) {
        try {
            // Determine if we're using an existing transaction or creating our own
            let useTransaction = !!transaction;
            if (!transaction) {
                transaction = await sequelize.transaction();
            }

            // Use the BalanceCalculator utility to recalculate all monthly snapshots
            const results = await BalanceCalculator.recalculateMonthlySnapshots(
                accountId,
                ledgerHeadId,
                fromDate,
                transaction
            );

            // Commit transaction if we created it
            if (!useTransaction) {
                await transaction.commit();
            }

            return results;
        } catch (error) {
            // Rollback transaction if we created it
            if (transaction && !transaction.finished && !useTransaction) {
                await transaction.rollback();
            }

            console.error('Error in recalculateMonthlySnapshots:', error);
            throw error;
        }
    }
}

module.exports = new MonthlyClosureService();