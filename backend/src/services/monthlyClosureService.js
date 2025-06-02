const { Op } = require('sequelize');
const db = require('../models');
const { sequelize } = db;

/**
 * Monthly Closure Service - handles month-end processes and period locking
 */
class MonthlyClosureService {
    /**
     * Close the accounting period for a specific month and year
     * This creates monthly snapshots for all ledger heads
     * and locks the period for future transactions
     * 
     * @param {number} month - Month to close (1-12)
     * @param {number} year - Year to close
     * @param {number} accountId - Optional account ID to close period for (if not provided, closes for all accounts)
     * @returns {Promise<Object>} Results of the closure process
     */
    async closeAccountingPeriod(month, year, accountId = null) {
        return await sequelize.transaction(async (t) => {
            try {
                // Validate month and year
                if (month < 1 || month > 12) {
                    throw new Error('Month must be between 1 and 12');
                }

                if (year < 2000 || year > 2100) {
                    throw new Error('Year must be between 2000 and 2100');
                }

                // Calculate first and last day of month
                const lastDay = new Date(year, month, 0).getDate();
                const closingDate = new Date(year, month - 1, lastDay);
                const periodEndDate = closingDate.toISOString().split('T')[0]; // YYYY-MM-DD format

                // Query builder for accounts
                const whereClause = {};
                if (accountId) {
                    whereClause.id = accountId;
                }

                // Get accounts to process
                const accounts = await db.Account.findAll({
                    where: whereClause,
                    transaction: t
                });

                if (accounts.length === 0) {
                    throw new Error('No accounts found to process');
                }

                const results = {
                    accountsProcessed: 0,
                    ledgerHeadsProcessed: 0,
                    snapshotsCreated: 0,
                    snapshotsUpdated: 0,
                    nextMonthPrepared: 0
                };

                // Process each account
                for (const account of accounts) {
                    console.log(`Processing account ${account.id} - ${account.name} for ${month}/${year}`);

                    // Get all ledger heads for this account
                    const ledgerHeads = await db.LedgerHead.findAll({
                        where: { account_id: account.id },
                        transaction: t
                    });

                    // Process each ledger head
                    for (const ledgerHead of ledgerHeads) {
                        results.ledgerHeadsProcessed++;

                        // Check if a monthly snapshot already exists
                        let monthlySnapshot = await db.MonthlyLedgerBalance.findOne({
                            where: {
                                account_id: account.id,
                                ledger_head_id: ledgerHead.id,
                                month,
                                year
                            },
                            transaction: t
                        });

                        if (!monthlySnapshot) {
                            // If no snapshot exists, we need to create one with proper opening balance
                            let openingBalance = 0;

                            // If not January, check previous month of same year
                            let prevMonth = month > 1 ? month - 1 : 12;
                            let prevYear = month > 1 ? year : year - 1;

                            // Find previous month's record
                            const prevRecord = await db.MonthlyLedgerBalance.findOne({
                                where: {
                                    account_id: account.id,
                                    ledger_head_id: ledgerHead.id,
                                    month: prevMonth,
                                    year: prevYear
                                },
                                transaction: t
                            });

                            if (prevRecord) {
                                openingBalance = parseFloat(prevRecord.closing_balance);
                            } else {
                                // If no previous month record, calculate from all transactions prior to this month
                                const startDate = new Date(year, month - 1, 1);
                                const startDateStr = startDate.toISOString().split('T')[0];

                                const priorTransactions = await db.sequelize.query(`
                  SELECT SUM(CASE WHEN ti.side = '+' THEN ti.amount ELSE -ti.amount END) as balance
                  FROM transaction_items ti
                  JOIN transactions t ON ti.transaction_id = t.id
                  WHERE ti.ledger_head_id = :ledgerHeadId 
                  AND t.tx_date < :startDate
                  AND t.status = 'completed'
                `, {
                                    replacements: {
                                        ledgerHeadId: ledgerHead.id,
                                        startDate: startDateStr
                                    },
                                    type: db.sequelize.QueryTypes.SELECT,
                                    transaction: t
                                });

                                if (priorTransactions && priorTransactions[0] && priorTransactions[0].balance !== null) {
                                    openingBalance = parseFloat(priorTransactions[0].balance || 0);
                                }
                            }

                            // Get all transaction items for this ledger head within current month
                            const monthStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
                            const monthEnd = periodEndDate;

                            // Query for receipts (credits) and payments (debits) in this month
                            const monthlyActivity = await db.sequelize.query(`
                SELECT 
                  SUM(CASE WHEN ti.side = '+' THEN ti.amount ELSE 0 END) as receipts,
                  SUM(CASE WHEN ti.side = '-' THEN ti.amount ELSE 0 END) as payments,
                  SUM(CASE WHEN ti.side = '+' AND t.cash_type = 'cash' THEN ti.amount 
                          WHEN ti.side = '+' AND t.cash_type = 'multiple' THEN t.cash_amount
                          ELSE 0 END) as cash_in,
                  SUM(CASE WHEN ti.side = '-' AND t.cash_type = 'cash' THEN ti.amount
                          WHEN ti.side = '-' AND t.cash_type = 'multiple' THEN t.cash_amount
                          ELSE 0 END) as cash_out,
                  SUM(CASE WHEN ti.side = '+' AND t.cash_type IN ('bank', 'cheque', 'upi', 'card', 'netbank') THEN ti.amount
                          WHEN ti.side = '+' AND t.cash_type = 'multiple' THEN t.bank_amount
                          ELSE 0 END) as bank_in,
                  SUM(CASE WHEN ti.side = '-' AND t.cash_type IN ('bank', 'cheque', 'upi', 'card', 'netbank') THEN ti.amount
                          WHEN ti.side = '-' AND t.cash_type = 'multiple' THEN t.bank_amount
                          ELSE 0 END) as bank_out
                FROM transaction_items ti
                JOIN transactions t ON ti.transaction_id = t.id
                WHERE ti.ledger_head_id = :ledgerHeadId 
                AND t.tx_date BETWEEN :startDate AND :endDate
                AND t.status = 'completed'
              `, {
                                replacements: {
                                    ledgerHeadId: ledgerHead.id,
                                    startDate: monthStart,
                                    endDate: monthEnd
                                },
                                type: db.sequelize.QueryTypes.SELECT,
                                transaction: t
                            });

                            const activity = monthlyActivity[0] || {
                                receipts: 0,
                                payments: 0,
                                cash_in: 0,
                                cash_out: 0,
                                bank_in: 0,
                                bank_out: 0
                            };

                            // Calculate closing balance and net cash/bank changes
                            const receipts = parseFloat(activity.receipts || 0);
                            const payments = parseFloat(activity.payments || 0);
                            const closingBalance = openingBalance + receipts - payments;

                            const cashInHand = parseFloat(activity.cash_in || 0) - parseFloat(activity.cash_out || 0);
                            const cashInBank = parseFloat(activity.bank_in || 0) - parseFloat(activity.bank_out || 0);

                            // Create the snapshot record
                            monthlySnapshot = await db.MonthlyLedgerBalance.create({
                                account_id: account.id,
                                ledger_head_id: ledgerHead.id,
                                month,
                                year,
                                opening_balance: openingBalance,
                                receipts,
                                payments,
                                closing_balance: closingBalance,
                                cash_in_hand: cashInHand,
                                cash_in_bank: cashInBank
                            }, { transaction: t });

                            results.snapshotsCreated++;
                        } else {
                            // If snapshot exists, just update it to ensure accuracy
                            const monthStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
                            const monthEnd = periodEndDate;

                            // Recalculate totals from transactions
                            const monthlyActivity = await db.sequelize.query(`
                SELECT 
                  SUM(CASE WHEN ti.side = '+' THEN ti.amount ELSE 0 END) as receipts,
                  SUM(CASE WHEN ti.side = '-' THEN ti.amount ELSE 0 END) as payments,
                  SUM(CASE WHEN ti.side = '+' AND t.cash_type = 'cash' THEN ti.amount 
                          WHEN ti.side = '+' AND t.cash_type = 'multiple' THEN t.cash_amount
                          ELSE 0 END) as cash_in,
                  SUM(CASE WHEN ti.side = '-' AND t.cash_type = 'cash' THEN ti.amount
                          WHEN ti.side = '-' AND t.cash_type = 'multiple' THEN t.cash_amount
                          ELSE 0 END) as cash_out,
                  SUM(CASE WHEN ti.side = '+' AND t.cash_type IN ('bank', 'cheque', 'upi', 'card', 'netbank') THEN ti.amount
                          WHEN ti.side = '+' AND t.cash_type = 'multiple' THEN t.bank_amount
                          ELSE 0 END) as bank_in,
                  SUM(CASE WHEN ti.side = '-' AND t.cash_type IN ('bank', 'cheque', 'upi', 'card', 'netbank') THEN ti.amount
                          WHEN ti.side = '-' AND t.cash_type = 'multiple' THEN t.bank_amount
                          ELSE 0 END) as bank_out
                FROM transaction_items ti
                JOIN transactions t ON ti.transaction_id = t.id
                WHERE ti.ledger_head_id = :ledgerHeadId 
                AND t.tx_date BETWEEN :startDate AND :endDate
                AND t.status = 'completed'
              `, {
                                replacements: {
                                    ledgerHeadId: ledgerHead.id,
                                    startDate: monthStart,
                                    endDate: monthEnd
                                },
                                type: db.sequelize.QueryTypes.SELECT,
                                transaction: t
                            });

                            const activity = monthlyActivity[0] || {
                                receipts: 0,
                                payments: 0,
                                cash_in: 0,
                                cash_out: 0,
                                bank_in: 0,
                                bank_out: 0
                            };

                            // Update calculated values
                            const receipts = parseFloat(activity.receipts || 0);
                            const payments = parseFloat(activity.payments || 0);
                            const closingBalance = parseFloat(monthlySnapshot.opening_balance) + receipts - payments;

                            const cashInHand = parseFloat(activity.cash_in || 0) - parseFloat(activity.cash_out || 0);
                            const cashInBank = parseFloat(activity.bank_in || 0) - parseFloat(activity.bank_out || 0);

                            await monthlySnapshot.update({
                                receipts,
                                payments,
                                closing_balance: closingBalance,
                                cash_in_hand: cashInHand,
                                cash_in_bank: cashInBank
                            }, { transaction: t });

                            results.snapshotsUpdated++;
                        }

                        // Prepare next month record for this ledger head (if it doesn't exist yet)
                        let nextMonth = month === 12 ? 1 : month + 1;
                        let nextYear = month === 12 ? year + 1 : year;

                        const existingNextMonthRecord = await db.MonthlyLedgerBalance.findOne({
                            where: {
                                account_id: account.id,
                                ledger_head_id: ledgerHead.id,
                                month: nextMonth,
                                year: nextYear
                            },
                            transaction: t
                        });

                        if (!existingNextMonthRecord) {
                            // Create next month's record with opening = this month's closing
                            await db.MonthlyLedgerBalance.create({
                                account_id: account.id,
                                ledger_head_id: ledgerHead.id,
                                month: nextMonth,
                                year: nextYear,
                                opening_balance: monthlySnapshot.closing_balance,
                                receipts: 0,
                                payments: 0,
                                closing_balance: monthlySnapshot.closing_balance,
                                cash_in_hand: 0,
                                cash_in_bank: 0
                            }, { transaction: t });

                            results.nextMonthPrepared++;
                        }
                    }

                    // Prepare for next month by creating opening balance record
                    results.nextMonthPrepared++;
                }

                // Update account's last closed date
                for (const account of accounts) {
                    try {
                        // Try to update last_closed_date
                        await account.update({
                            last_closed_date: periodEndDate
                        }, { transaction: t });
                        console.log(`Updated account ${account.id} last_closed_date to ${periodEndDate}`);
                    } catch (updateError) {
                        // If column doesn't exist, log the error but continue
                        console.warn(`Could not update last_closed_date for account ${account.id}: ${updateError.message}`);
                        console.warn('The migration to add last_closed_date column might not have been applied');
                    }
                }

                results.accountsProcessed = accounts.length;
                return results;
            } catch (error) {
                console.error('Error closing accounting period:', error);
                throw error;
            }
        });
    }

    /**
     * Reopens a closed accounting period
     * @param {number} accountId - Account ID
     * @param {string} newClosingDate - New closing date (format YYYY-MM-DD)
     * @returns {Promise<Object>} Result of the reopen operation
     */
    async reopenPeriod(accountId, newClosingDate) {
        return await sequelize.transaction(async (t) => {
            try {
                const account = await db.Account.findByPk(accountId, {
                    transaction: t
                });

                if (!account) {
                    throw new Error(`Account with ID ${accountId} not found`);
                }

                const oldClosingDate = account.last_closed_date;

                if (!oldClosingDate) {
                    throw new Error('No closed periods found for this account');
                }

                if (new Date(newClosingDate) >= new Date(oldClosingDate)) {
                    throw new Error('New closing date must be earlier than the current closing date');
                }

                // Update the account's last_closed_date
                await account.update({
                    last_closed_date: newClosingDate
                }, { transaction: t });

                return {
                    success: true,
                    message: `Successfully reopened period for account ${account.name}`,
                    oldClosingDate,
                    newClosingDate
                };
            } catch (error) {
                console.error('Error reopening period:', error);
                throw error;
            }
        });
    }

    /**
     * Recalculates monthly snapshots after backdated transaction changes
     * @param {number} accountId - Account ID
     * @param {number} ledgerHeadId - Ledger Head ID
     * @param {string} fromDate - Start date for recalculation (YYYY-MM-DD)
     * @returns {Promise<Object>} Results of recalculation
     */
    async recalculateMonthlySnapshots(accountId, ledgerHeadId, fromDate) {
        return await sequelize.transaction(async (t) => {
            try {
                // Parse the start date to get month/year
                const startDate = new Date(fromDate);
                let currentMonth = startDate.getMonth() + 1; // 1-12
                let currentYear = startDate.getFullYear();

                // Get current date to determine end point
                const now = new Date();
                const endMonth = now.getMonth() + 1;
                const endYear = now.getFullYear();

                const results = {
                    snapshotsUpdated: 0,
                    ledgerHead: null,
                    account: null,
                    monthsProcessed: []
                };

                // Get the ledger head
                const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId, { transaction: t });
                if (!ledgerHead) {
                    throw new Error(`Ledger head with ID ${ledgerHeadId} not found`);
                }

                // Get the account
                const account = await db.Account.findByPk(accountId, { transaction: t });
                if (!account) {
                    throw new Error(`Account with ID ${accountId} not found`);
                }

                results.ledgerHead = {
                    id: ledgerHead.id,
                    name: ledgerHead.name
                };

                results.account = {
                    id: account.id,
                    name: account.name
                };

                let lastClosingBalance = null;

                // Loop through each month from start date to now
                while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
                    const monthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

                    // Find the monthly snapshot for this month
                    const snapshot = await db.MonthlyLedgerBalance.findOne({
                        where: {
                            account_id: accountId,
                            ledger_head_id: ledgerHeadId,
                            month: currentMonth,
                            year: currentYear
                        },
                        transaction: t
                    });

                    if (snapshot) {
                        // Get the first day of month
                        const monthStart = new Date(currentYear, currentMonth - 1, 1);
                        // Get the last day of month
                        const monthEnd = new Date(currentYear, currentMonth, 0);

                        const monthStartStr = monthStart.toISOString().split('T')[0];
                        const monthEndStr = monthEnd.toISOString().split('T')[0];

                        // If this is the first month we're processing, we need to respect its opening balance
                        // For subsequent months, we'll use the previous month's closing balance
                        let openingBalance = snapshot.opening_balance;
                        if (lastClosingBalance !== null) {
                            openingBalance = lastClosingBalance;
                        }

                        // Get transaction totals for this month
                        const monthlyActivity = await db.sequelize.query(`
              SELECT 
                SUM(CASE WHEN ti.side = '+' THEN ti.amount ELSE 0 END) as receipts,
                SUM(CASE WHEN ti.side = '-' THEN ti.amount ELSE 0 END) as payments,
                SUM(CASE WHEN ti.side = '+' AND t.cash_type = 'cash' THEN ti.amount 
                        WHEN ti.side = '+' AND t.cash_type = 'multiple' THEN t.cash_amount
                        ELSE 0 END) as cash_in,
                SUM(CASE WHEN ti.side = '-' AND t.cash_type = 'cash' THEN ti.amount
                        WHEN ti.side = '-' AND t.cash_type = 'multiple' THEN t.cash_amount
                        ELSE 0 END) as cash_out,
                SUM(CASE WHEN ti.side = '+' AND t.cash_type IN ('bank', 'cheque', 'upi', 'card', 'netbank') THEN ti.amount
                        WHEN ti.side = '+' AND t.cash_type = 'multiple' THEN t.bank_amount
                        ELSE 0 END) as bank_in,
                SUM(CASE WHEN ti.side = '-' AND t.cash_type IN ('bank', 'cheque', 'upi', 'card', 'netbank') THEN ti.amount
                        WHEN ti.side = '-' AND t.cash_type = 'multiple' THEN t.bank_amount
                        ELSE 0 END) as bank_out
              FROM transaction_items ti
              JOIN transactions t ON ti.transaction_id = t.id
              WHERE ti.ledger_head_id = :ledgerHeadId 
              AND t.tx_date BETWEEN :startDate AND :endDate
              AND t.status = 'completed'
            `, {
                            replacements: {
                                ledgerHeadId: ledgerHeadId,
                                startDate: monthStartStr,
                                endDate: monthEndStr
                            },
                            type: db.sequelize.QueryTypes.SELECT,
                            transaction: t
                        });

                        const activity = monthlyActivity[0] || {
                            receipts: 0,
                            payments: 0,
                            cash_in: 0,
                            cash_out: 0,
                            bank_in: 0,
                            bank_out: 0
                        };

                        // Calculate new values
                        const receipts = parseFloat(activity.receipts || 0);
                        const payments = parseFloat(activity.payments || 0);
                        const closingBalance = parseFloat(openingBalance) + receipts - payments;

                        const cashInHand = parseFloat(activity.cash_in || 0) - parseFloat(activity.cash_out || 0);
                        const cashInBank = parseFloat(activity.bank_in || 0) - parseFloat(activity.bank_out || 0);

                        // Update the snapshot
                        await snapshot.update({
                            opening_balance: openingBalance,
                            receipts,
                            payments,
                            closing_balance: closingBalance,
                            cash_in_hand: cashInHand,
                            cash_in_bank: cashInBank
                        }, { transaction: t });

                        // Store closing balance for next month's opening
                        lastClosingBalance = closingBalance;

                        results.snapshotsUpdated++;
                        results.monthsProcessed.push(monthStr);
                    }

                    // Move to next month
                    if (currentMonth === 12) {
                        currentMonth = 1;
                        currentYear++;
                    } else {
                        currentMonth++;
                    }
                }

                // Now synchronize the ledger head's current balances to match the latest month's closing balance
                if (lastClosingBalance !== null) {
                    await ledgerHead.update({
                        current_balance: lastClosingBalance
                    }, { transaction: t });
                }

                return {
                    success: true,
                    message: `Successfully recalculated monthly snapshots from ${fromDate}`,
                    results
                };
            } catch (error) {
                console.error('Error recalculating monthly snapshots:', error);
                throw error;
            }
        });
    }
}

module.exports = new MonthlyClosureService(); 