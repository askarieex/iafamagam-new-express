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
            const useOwnTransaction = !transaction;
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
                            closing_balance: closingBalance,
                            is_open: false // Ensure closing this period sets is_open to false
                        },
                        transaction
                    });

                    // If it already exists, update it
                    if (!created) {
                        await monthlySnapshot.update({
                            opening_balance: openingBalance,
                            receipts,
                            payments,
                            closing_balance: closingBalance,
                            is_open: false // Set is_open to false when closing period
                        }, { transaction });
                    }

                    // Update ledger head's current balance to match the latest calculation
                    await ledgerHead.update({
                        current_balance: closingBalance
                    }, { transaction });

                    // Prepare next month's snapshot with opening balance from this month's closing
                    let nextMonth = month === 12 ? 1 : month + 1;
                    let nextYear = month === 12 ? year + 1 : year;

                    const [nextMonthSnapshot, nextMonthCreated] = await db.MonthlyLedgerBalance.findOrCreate({
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
                            closing_balance: closingBalance,
                            is_open: true // Set the next month as open
                        },
                        transaction
                    });

                    // If next month snapshot exists, only update opening balance if needed
                    if (!nextMonthCreated) {
                        const newClosingBalance = parseFloat(closingBalance) +
                            parseFloat(nextMonthSnapshot.receipts) -
                            parseFloat(nextMonthSnapshot.payments);

                        await nextMonthSnapshot.update({
                            opening_balance: closingBalance,
                            closing_balance: newClosingBalance,
                            is_open: true // Ensure next month is open
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

                // Before updating, make sure any currently open periods for this account are closed
                await db.MonthlyLedgerBalance.update(
                    { is_open: false },
                    {
                        where: {
                            account_id: account.id,
                            is_open: true,
                            [Op.or]: [
                                { year: { [Op.lt]: nextYear } },
                                {
                                    year: nextYear,
                                    month: { [Op.lt]: nextMonth }
                                }
                            ]
                        },
                        transaction
                    }
                );

                // Update the account's last_closed_date
                await account.update({
                    last_closed_date: endOfMonthStr
                }, { transaction });

                // Log the period closure
                await this.logPeriodAction(account.id, month, year, 'periodClosed',
                    `Closed accounting period for ${month}/${year}`, transaction);
            }

            // Commit transaction if we created it
            if (useOwnTransaction) {
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
            if (transaction && !transaction.finished && useOwnTransaction) {
                await transaction.rollback();
            }
            console.error('Error in closeAccountingPeriod:', error);
            throw error;
        }
    }

    /**
     * Opens an accounting period for a specific account
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {number} accountId - Account ID
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} Results of the opening
     */
    async openAccountingPeriod(month, year, accountId, transaction = null) {
        try {
            // Ensure all parameters are valid numbers
            month = parseInt(month);
            year = parseInt(year);
            accountId = parseInt(accountId);

            if (isNaN(month) || month < 1 || month > 12) {
                throw new Error(`Invalid month value: ${month}`);
            }

            if (isNaN(year) || year < 2000 || year > 2100) {
                throw new Error(`Invalid year value: ${year}`);
            }

            if (isNaN(accountId) || accountId <= 0) {
                throw new Error(`Invalid account ID: ${accountId}`);
            }

            console.log(`Opening period: ${month}/${year} for account ${accountId}`);

            // Determine if we're using an existing transaction or creating our own
            const useOwnTransaction = !transaction;
            if (!transaction) {
                transaction = await sequelize.transaction();
            }

            // First, close any currently open periods for this account
            const updateResult = await db.MonthlyLedgerBalance.update(
                { is_open: false },
                {
                    where: {
                        account_id: accountId,
                        is_open: true
                    },
                    transaction
                }
            );
            console.log('Closed currently open periods:', updateResult);

            // Get all ledger heads for this account
            const ledgerHeads = await db.LedgerHead.findAll({
                where: { account_id: accountId },
                transaction
            });
            console.log(`Found ${ledgerHeads.length} ledger heads for the account`);

            const results = [];

            // For each ledger, find or create the period and mark it as open
            for (const ledgerHead of ledgerHeads) {
                if (!ledgerHead || !ledgerHead.id) {
                    console.error('Invalid ledger head found:', ledgerHead);
                    continue; // Skip this ledger head
                }

                try {
                    // Calculate opening balance if this period doesn't exist
                    let openingBalance = 0;
                    try {
                        openingBalance = await BalanceCalculator.calculateOpeningBalance(
                            ledgerHead.id,
                            accountId,
                            month,
                            year,
                            transaction
                        );

                        // Ensure we have a valid number for opening balance
                        openingBalance = parseFloat(openingBalance || 0);
                        if (isNaN(openingBalance)) openingBalance = 0;

                    } catch (calcError) {
                        console.error(`Error calculating opening balance: ${calcError.message}`);
                        openingBalance = 0;
                    }

                    console.log(`Creating/finding period for ledger ${ledgerHead.id} with opening balance ${openingBalance}`);

                    // Find or create the period
                    const [periodSnapshot, created] = await db.MonthlyLedgerBalance.findOrCreate({
                        where: {
                            ledger_head_id: ledgerHead.id,
                            account_id: accountId,
                            month: month,
                            year: year
                        },
                        defaults: {
                            opening_balance: openingBalance,
                            receipts: 0,
                            payments: 0,
                            closing_balance: openingBalance,
                            cash_in_hand: 0,
                            cash_in_bank: 0,
                            is_open: true
                        },
                        transaction
                    });
                    console.log(`Ledger ${ledgerHead.id}: Period ${created ? 'created' : 'found'} with is_open=${periodSnapshot.is_open}`);

                    // If period exists, just update the is_open flag
                    if (!created) {
                        const updateResult = await periodSnapshot.update({ is_open: true }, { transaction });
                        console.log('Update result:', updateResult ? 'successful' : 'failed');
                    }

                    results.push({
                        account_id: accountId,
                        ledger_head_id: ledgerHead.id,
                        month,
                        year,
                        opening_balance: parseFloat(periodSnapshot.opening_balance || 0),
                        is_open: true
                    });
                } catch (ledgerError) {
                    console.error(`Error processing ledger ${ledgerHead?.id}: ${ledgerError.message}`);
                    // Continue with other ledger heads
                }
            }

            // If this is a backdated period (before the last_closed_date), update the last_closed_date
            const account = await db.Account.findByPk(accountId, { transaction });
            if (account && account.last_closed_date) {
                const targetDate = new Date(year, month - 1, 1);
                const lastClosedDate = new Date(account.last_closed_date);

                if (targetDate < lastClosedDate) {
                    // Calculate the last day of the previous month
                    const prevMonth = month === 1 ? 12 : month - 1;
                    const prevYear = month === 1 ? year - 1 : year;
                    const lastDayOfPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
                    const newLastClosedDate = new Date(prevYear, prevMonth - 1, lastDayOfPrevMonth);

                    // Update the account's last_closed_date
                    await account.update({
                        last_closed_date: newLastClosedDate.toISOString().split('T')[0]
                    }, { transaction });
                }
            }

            // Check if this is a backdated period and needs recalculation
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = currentDate.getFullYear();
            const isBackdated = (year < currentYear || (year === currentYear && month < currentMonth));

            if (isBackdated) {
                console.log(`Period ${month}/${year} is backdated compared to current ${currentMonth}/${currentYear}. Triggering recalculation.`);

                // Recalculate all months from this period to current month
                // for each ledger head to ensure proper balance propagation
                for (const ledgerHead of ledgerHeads) {
                    try {
                        // Use the first day of the opened month as the starting point
                        const fromDate = new Date(year, month - 1, 1).toISOString().split('T')[0];

                        // Call recalculateMonthlySnapshots to fix balances from this month forward
                        await BalanceCalculator.recalculateMonthlySnapshots(
                            accountId,
                            ledgerHead.id,
                            fromDate,
                            transaction
                        );

                        console.log(`Recalculated balances for ledger ${ledgerHead.id} from ${month}/${year} forward`);
                    } catch (recalcError) {
                        console.error(`Error recalculating balances for ledger ${ledgerHead.id}:`, recalcError);
                        // Continue with other ledger heads even if one fails
                    }
                }
            }

            // Log the period opening
            await this.logPeriodAction(accountId, month, year, 'periodOpened',
                `Opened accounting period for ${month}/${year}`, transaction);

            // Commit transaction if we created it
            if (useOwnTransaction) {
                await transaction.commit();
                console.log('Transaction committed successfully');
            }

            return {
                success: true,
                accountId,
                month,
                year,
                openedAt: new Date(),
                results
            };
        } catch (error) {
            // Rollback transaction if we created it
            const shouldRollback = transaction && !transaction.finished;
            if (shouldRollback) {
                await transaction.rollback();
                console.log('Transaction rolled back due to error');
            }

            console.error('Error in openAccountingPeriod:', error);
            throw error;
        }
    }

    /**
     * Get the currently open period for an account
     * @param {number} accountId - Account ID
     * @returns {Promise<Object|null>} The currently open period or null if none found
     */
    async getOpenPeriodForAccount(accountId) {
        try {
            // Get the first open period for this account
            const openPeriod = await db.MonthlyLedgerBalance.findOne({
                where: {
                    account_id: accountId,
                    is_open: true
                },
                attributes: ['account_id', 'month', 'year'],
                order: [['year', 'DESC'], ['month', 'DESC']],
                limit: 1
            });

            return openPeriod || null;
        } catch (error) {
            console.error('Error getting open period:', error);
            throw error;
        }
    }

    /**
     * Recalculates monthly snapshots after backdated transaction changes
     * @param {number} accountId - Account ID
     * @param {number} ledgerHeadId - Ledger head ID
     * @param {string} fromDate - Start date (YYYY-MM-DD)
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} Results of recalculation
     */
    async recalculateMonthlySnapshots(accountId, ledgerHeadId, fromDate, transaction = null) {
        try {
            return await BalanceCalculator.recalculateMonthlySnapshots(
                accountId, ledgerHeadId, fromDate, transaction
            );
        } catch (error) {
            console.error('Error in recalculateMonthlySnapshots:', error);
            throw error;
        }
    }

    /**
     * Reopens periods back to a specified date
     * @param {number} accountId - Account ID
     * @param {string} newClosingDate - The new closing date (YYYY-MM-DD)
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} Results of the reopening
     */
    async reopenPeriod(accountId, newClosingDate, transaction = null) {
        try {
            // Determine if we're using an existing transaction or creating our own
            const useOwnTransaction = !transaction;
            if (!transaction) {
                transaction = await sequelize.transaction();
            }

            // Get the account
            const account = await db.Account.findByPk(accountId, { transaction });
            if (!account) {
                throw new Error(`Account with ID ${accountId} not found`);
            }

            // If the account doesn't have a last_closed_date, nothing to reopen
            if (!account.last_closed_date) {
                return {
                    success: false,
                    message: 'Account has no closed periods to reopen',
                    accountId
                };
            }

            // Parse dates
            const newClosingDateObj = new Date(newClosingDate);
            const currentClosingDateObj = new Date(account.last_closed_date);

            // The new closing date should be before the current one
            if (newClosingDateObj >= currentClosingDateObj) {
                return {
                    success: false,
                    message: 'New closing date must be earlier than current closing date',
                    accountId,
                    currentClosingDate: account.last_closed_date,
                    newClosingDate
                };
            }

            // Update the account's last_closed_date
            await account.update({
                last_closed_date: newClosingDate
            }, { transaction });

            // Calculate the months to reopen
            // The month after the new closing date should be reopened
            const newMonth = newClosingDateObj.getMonth() + 2; // +1 for 0-indexed month, +1 to get next month
            const newYear = newClosingDateObj.getFullYear() + (newMonth > 12 ? 1 : 0);
            const adjustedNewMonth = newMonth > 12 ? newMonth - 12 : newMonth;

            const currentMonth = currentClosingDateObj.getMonth() + 2; // +1 for 0-indexed month, +1 to get next month
            const currentYear = currentClosingDateObj.getFullYear() + (currentMonth > 12 ? 1 : 0);
            const adjustedCurrentMonth = currentMonth > 12 ? currentMonth - 12 : currentMonth;

            // Log the periods being reopened
            console.log(`Reopening periods from ${adjustedNewMonth}/${newYear} to ${adjustedCurrentMonth}/${currentYear}`);

            // Get all ledger heads for this account
            const ledgerHeads = await db.LedgerHead.findAll({
                where: { account_id: accountId },
                transaction
            });

            const results = [];

            // For each ledger, update the monthly snapshots within the date range
            for (const ledgerHead of ledgerHeads) {
                let iterMonth = adjustedNewMonth;
                let iterYear = newYear;

                while (
                    iterYear < currentYear ||
                    (iterYear === currentYear && iterMonth <= adjustedCurrentMonth)
                ) {
                    console.log(`Processing month ${iterMonth}/${iterYear} for ledger ${ledgerHead.id}`);

                    // Find the monthly snapshot for this month
                    const monthlySnapshot = await db.MonthlyLedgerBalance.findOne({
                        where: {
                            ledger_head_id: ledgerHead.id,
                            account_id: accountId,
                            month: iterMonth,
                            year: iterYear
                        },
                        transaction
                    });

                    if (monthlySnapshot) {
                        const isOpen = iterMonth === adjustedNewMonth && iterYear === newYear;
                        console.log(`Setting is_open=${isOpen} for month ${iterMonth}/${iterYear}`);

                        // Update the snapshot
                        await monthlySnapshot.update({
                            is_open: isOpen // Only the first month gets set to open
                        }, { transaction });

                        results.push({
                            ledger_head_id: ledgerHead.id,
                            month: iterMonth,
                            year: iterYear,
                            is_open: isOpen,
                            updated: true
                        });
                    }

                    // Move to next month
                    if (iterMonth === 12) {
                        iterMonth = 1;
                        iterYear++;
                    } else {
                        iterMonth++;
                    }
                }
            }

            // Log the period reopening
            await this.logPeriodAction(accountId, adjustedNewMonth, newYear, 'periodsReopened',
                `Reopened periods from ${adjustedNewMonth}/${newYear}`, transaction);

            // Commit transaction if we created it
            if (useOwnTransaction) {
                await transaction.commit();
            }

            return {
                success: true,
                accountId,
                previousClosingDate: currentClosingDateObj.toISOString().split('T')[0],
                newClosingDate: newClosingDateObj.toISOString().split('T')[0],
                firstReopenedMonth: adjustedNewMonth,
                firstReopenedYear: newYear,
                results
            };
        } catch (error) {
            // Rollback transaction if we created it
            if (transaction && !transaction.finished && useOwnTransaction) {
                await transaction.rollback();
            }
            console.error('Error in reopenPeriod:', error);
            throw error;
        }
    }

    /**
     * Get all accounts with their period status
     * @returns {Promise<Array>} Array of accounts with their period status
     */
    async getAllAccountsPeriodStatus() {
        try {
            const accounts = await db.Account.findAll({
                attributes: ['id', 'name', 'last_closed_date'],
                order: [['name', 'ASC']]
            });

            const result = [];

            for (const account of accounts) {
                // Get the currently open period(s) for this account
                const openPeriods = await db.MonthlyLedgerBalance.findAll({
                    where: {
                        account_id: account.id,
                        is_open: true
                    },
                    attributes: ['month', 'year'],
                    group: ['month', 'year'],
                    order: [['year', 'DESC'], ['month', 'DESC']]
                });

                // Format open periods
                const formattedOpenPeriods = openPeriods.map(period => ({
                    month: period.month,
                    year: period.year,
                    label: `${period.month}/${period.year}`
                }));

                // Calculate next period based on last closed date
                let nextPeriod = null;
                if (account.last_closed_date) {
                    const lastClosedDate = new Date(account.last_closed_date);
                    let nextMonth = lastClosedDate.getMonth() + 2; // +1 for 0-indexed month, +1 to get next month
                    let nextYear = lastClosedDate.getFullYear();

                    if (nextMonth > 12) {
                        nextMonth -= 12;
                        nextYear += 1;
                    }

                    nextPeriod = {
                        month: nextMonth,
                        year: nextYear,
                        label: `${nextMonth}/${nextYear}`
                    };
                }

                result.push({
                    id: account.id,
                    name: account.name,
                    last_closed_date: account.last_closed_date,
                    open_periods: formattedOpenPeriods,
                    next_period: nextPeriod
                });
            }

            return result;
        } catch (error) {
            console.error('Error getting accounts period status:', error);
            throw error;
        }
    }

    /**
     * Log a period action in the system audit log
     * @param {number} accountId - Account ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {string} action - Action type (e.g., 'periodClosed', 'periodOpened')
     * @param {string} description - Description of the action
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} The created log entry
     */
    async logPeriodAction(accountId, month, year, action, description, transaction = null) {
        try {
            return await db.SystemLog.create({
                module: 'accounting',
                action: action,
                description: description,
                metadata: JSON.stringify({
                    accountId,
                    month,
                    year,
                    timestamp: new Date()
                }),
                created_at: new Date()
            }, { transaction });
        } catch (error) {
            console.error('Error logging period action:', error);
            // Don't throw the error, just log it - we don't want logging failures to break functionality
            return null;
        }
    }
}

module.exports = new MonthlyClosureService(); 