const db = require('../models');
const { sequelize } = db;

/**
 * Utility class for balance calculations.
 * This centralizes all balance calculation logic used across services.
 */
class BalanceCalculator {
    /**
     * Calculate opening balance for a ledger head for a specific month/year
     * @param {number} ledgerHeadId - The ledger head ID
     * @param {number} accountId - The account ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year 
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<number>} - The calculated opening balance
     */
    static async calculateOpeningBalance(ledgerHeadId, accountId, month, year, transaction = null) {
        let openingBalance = 0;

        // If not January, check previous month of same year
        if (month > 1) {
            const prevMonth = month - 1;
            const prevYear = year;

            const prevMonthBalance = await db.MonthlyLedgerBalance.findOne({
                where: {
                    ledger_head_id: ledgerHeadId,
                    account_id: accountId,
                    month: prevMonth,
                    year: prevYear
                },
                transaction
            });

            if (prevMonthBalance) {
                return parseFloat(prevMonthBalance.closing_balance);
            }

            // If no previous month balance found, calculate from transactions
            return await this.calculateBalanceFromTransactions(
                ledgerHeadId,
                accountId,
                new Date(prevYear, prevMonth - 1, 1),
                new Date(year, month - 1, 1),
                transaction
            );
        }
        // If January, check December of previous year
        else {
            const prevMonth = 12;
            const prevYear = year - 1;

            const prevMonthBalance = await db.MonthlyLedgerBalance.findOne({
                where: {
                    ledger_head_id: ledgerHeadId,
                    account_id: accountId,
                    month: prevMonth,
                    year: prevYear
                },
                transaction
            });

            if (prevMonthBalance) {
                return parseFloat(prevMonthBalance.closing_balance);
            }

            // If no previous December balance, get balance from transactions before this month
            return await this.calculateBalanceFromTransactions(
                ledgerHeadId,
                accountId,
                null,
                new Date(year, month - 1, 1),
                transaction
            );
        }
    }

    /**
     * Calculate monthly activity (receipts and payments) for a ledger head
     * @param {number} ledgerHeadId - The ledger head ID
     * @param {number} accountId - The account ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} - { receipts, payments }
     */
    static async calculateMonthlyActivity(ledgerHeadId, accountId, month, year, transaction = null) {
        // Calculate the date range for this month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // Use raw SQL query for performance
        const [result] = await sequelize.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0) as receipts,
                COALESCE(SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END), 0) as payments
            FROM transactions t
            WHERE t.account_id = :accountId
                AND (
                    (t.type = 'credit' AND t.ledger_head_id = :ledgerHeadId) 
                    OR 
                    (t.type = 'debit' AND t.source_ledger_id = :ledgerHeadId)
                )
                AND t.tx_date BETWEEN :startDate AND :endDate
                AND t.status = 'completed'
        `, {
            replacements: {
                accountId,
                ledgerHeadId,
                startDate: startDateStr,
                endDate: endDateStr
            },
            type: sequelize.QueryTypes.SELECT,
            transaction
        });

        return {
            receipts: parseFloat(result.receipts || 0),
            payments: parseFloat(result.payments || 0)
        };
    }

    /**
     * Calculate balance by summing up all transactions up to a given date
     * @param {number} ledgerHeadId - The ledger head ID
     * @param {number} accountId - The account ID
     * @param {Date} [fromDate=null] - Start date (null for beginning of time)
     * @param {Date} [toDate=null] - End date (null for current date)
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<number>} - The calculated balance
     */
    static async calculateBalanceFromTransactions(ledgerHeadId, accountId, fromDate = null, toDate = null, transaction = null) {
        let whereClause = {
            account_id: accountId,
            status: 'completed'
        };

        let dateFilter = {};
        if (fromDate) {
            dateFilter.tx_date = { ...dateFilter.tx_date, $gte: fromDate.toISOString().split('T')[0] };
        }

        if (toDate) {
            dateFilter.tx_date = { ...dateFilter.tx_date, $lt: toDate.toISOString().split('T')[0] };
        }

        if (Object.keys(dateFilter).length > 0) {
            whereClause = { ...whereClause, ...dateFilter };
        }

        // Credits (money in)
        const creditsSum = await db.Transaction.sum('amount', {
            where: {
                ...whereClause,
                tx_type: 'credit',
                ledger_head_id: ledgerHeadId
            },
            transaction
        });

        // Debits (money out)
        const debitsSum = await db.Transaction.sum('amount', {
            where: {
                ...whereClause,
                tx_type: 'debit',
                ledger_head_id: ledgerHeadId  // Using ledger_head_id instead of source_ledger_id
            },
            transaction
        });

        return parseFloat(creditsSum || 0) - parseFloat(debitsSum || 0);
    }

    /**
     * Update a ledger head's balance based on a transaction
     * @param {number} ledgerHeadId - The ledger head ID to update
     * @param {number} accountId - The account ID
     * @param {string} txType - Transaction type ('credit' or 'debit')
     * @param {number} amount - Transaction amount
     * @param {string} txDate - Transaction date (YYYY-MM-DD)
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} - Updated balances information
     */
    static async updateLedgerHeadBalance(ledgerHeadId, accountId, txType, amount, txDate, transaction = null) {
        const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId, { transaction });
        if (!ledgerHead) {
            throw new Error(`Ledger head with ID ${ledgerHeadId} not found`);
        }

        const txDateObj = new Date(txDate);
        const txMonth = txDateObj.getMonth() + 1; // 1-12
        const txYear = txDateObj.getFullYear();

        // Get the monthly ledger balance for this month
        let monthlySnapshot = await db.MonthlyLedgerBalance.findOne({
            where: {
                ledger_head_id: ledgerHeadId,
                account_id: accountId,
                month: txMonth,
                year: txYear
            },
            transaction
        });

        // If no snapshot exists, create one
        if (!monthlySnapshot) {
            // Calculate opening balance from previous month
            const openingBalance = await this.calculateOpeningBalance(
                ledgerHeadId, accountId, txMonth, txYear, transaction
            );

            // Create new snapshot with initial values
            monthlySnapshot = await db.MonthlyLedgerBalance.create({
                ledger_head_id: ledgerHeadId,
                account_id: accountId,
                month: txMonth,
                year: txYear,
                opening_balance: openingBalance,
                receipts: txType === 'credit' ? amount : 0,
                payments: txType === 'debit' ? amount : 0,
                closing_balance: openingBalance + (txType === 'credit' ? amount : -amount)
            }, { transaction });
        } else {
            // Update existing snapshot
            const newReceipts = txType === 'credit'
                ? parseFloat(monthlySnapshot.receipts) + parseFloat(amount)
                : parseFloat(monthlySnapshot.receipts);

            const newPayments = txType === 'debit'
                ? parseFloat(monthlySnapshot.payments) + parseFloat(amount)
                : parseFloat(monthlySnapshot.payments);

            const newClosingBalance = parseFloat(monthlySnapshot.opening_balance) + newReceipts - newPayments;

            await monthlySnapshot.update({
                receipts: newReceipts,
                payments: newPayments,
                closing_balance: newClosingBalance
            }, { transaction });
        }

        // Update the ledger head's current balance
        const currentBalance = await this.calculateBalanceFromTransactions(
            ledgerHeadId, accountId, null, null, transaction
        );

        await ledgerHead.update({
            current_balance: currentBalance
        }, { transaction });

        // Return the updated balances
        return {
            ledgerHeadId,
            accountId,
            month: txMonth,
            year: txYear,
            currentBalance,
            monthlySnapshot: {
                openingBalance: parseFloat(monthlySnapshot.opening_balance),
                receipts: parseFloat(monthlySnapshot.receipts),
                payments: parseFloat(monthlySnapshot.payments),
                closingBalance: parseFloat(monthlySnapshot.closing_balance)
            }
        };
    }

    /**
     * Recalculate all monthly snapshots from a given date forward
     * @param {number} accountId - The account ID
     * @param {number} ledgerHeadId - The ledger head ID
     * @param {string} fromDate - Start date (YYYY-MM-DD)
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} - Results of recalculation
     */
    static async recalculateMonthlySnapshots(accountId, ledgerHeadId, fromDate, transaction = null) {
        console.log(`Recalculating snapshots for account ${accountId}, ledger ${ledgerHeadId} from ${fromDate}`);
        const fromDateObj = new Date(fromDate);
        const startMonth = fromDateObj.getMonth() + 1; // 1-12
        const startYear = fromDateObj.getFullYear();

        // Current date for end bound
        const now = new Date();
        const endMonth = now.getMonth() + 1;
        const endYear = now.getFullYear();

        const results = [];
        let previousMonthClosingBalance = null;

        // Start from the month of fromDate and iterate forward to current month
        let currentMonth = startMonth;
        let currentYear = startYear;

        while (
            currentYear < endYear ||
            (currentYear === endYear && currentMonth <= endMonth)
        ) {
            console.log(`Processing month ${currentMonth}/${currentYear}`);

            // Get the monthly snapshot for this month
            let snapshot = await db.MonthlyLedgerBalance.findOne({
                where: {
                    account_id: accountId,
                    ledger_head_id: ledgerHeadId,
                    month: currentMonth,
                    year: currentYear
                },
                transaction
            });

            // Calculate opening balance
            let openingBalance;

            if (previousMonthClosingBalance !== null) {
                // Use previous month's closing balance for continuity
                openingBalance = previousMonthClosingBalance;
                console.log(`Using previous month's closing balance: ${openingBalance}`);
            } else if (currentMonth === startMonth && currentYear === startYear) {
                // First month in sequence - calculate from prior transactions
                openingBalance = await this.calculateBalanceFromTransactions(
                    ledgerHeadId, accountId, null, fromDateObj, transaction
                );
                console.log(`Calculated first month opening balance: ${openingBalance}`);
            } else {
                // Standard opening balance calculation
                openingBalance = await this.calculateOpeningBalance(
                    ledgerHeadId, accountId, currentMonth, currentYear, transaction
                );
                console.log(`Calculated opening balance: ${openingBalance}`);
            }

            // Calculate monthly activity for this month
            const { receipts, payments } = await this.calculateMonthlyActivity(
                ledgerHeadId,
                accountId,
                currentMonth,
                currentYear,
                transaction
            );
            console.log(`Calculated receipts: ${receipts}, payments: ${payments}`);

            // Calculate closing balance
            const closingBalance = parseFloat(openingBalance) + parseFloat(receipts) - parseFloat(payments);
            console.log(`New closing balance: ${closingBalance}`);

            // Store for next iteration (this is the key improvement)
            previousMonthClosingBalance = closingBalance;

            if (snapshot) {
                // Update existing snapshot
                const isOpen = snapshot.is_open;

                await snapshot.update({
                    opening_balance: openingBalance,
                    receipts: receipts,
                    payments: payments,
                    closing_balance: closingBalance,
                    is_open: isOpen // Preserve the open status
                }, { transaction });

                results.push({
                    month: currentMonth,
                    year: currentYear,
                    opening_balance: parseFloat(openingBalance),
                    receipts: parseFloat(receipts),
                    payments: parseFloat(payments),
                    closing_balance: closingBalance,
                    updated: true
                });
            } else {
                // Create new snapshot if it doesn't exist
                console.log(`No snapshot exists for ${currentMonth}/${currentYear} - creating one`);

                // Determine if this should be the open period (current month/year)
                const isCurrentMonth = (currentMonth === now.getMonth() + 1 && currentYear === now.getFullYear());

                // Create new snapshot
                snapshot = await db.MonthlyLedgerBalance.create({
                    account_id: accountId,
                    ledger_head_id: ledgerHeadId,
                    month: currentMonth,
                    year: currentYear,
                    opening_balance: openingBalance,
                    receipts: receipts,
                    payments: payments,
                    closing_balance: closingBalance,
                    is_open: isCurrentMonth, // Only open if it's the current month
                    cash_in_hand: 0,
                    cash_in_bank: 0
                }, { transaction });

                results.push({
                    month: currentMonth,
                    year: currentYear,
                    opening_balance: parseFloat(openingBalance),
                    receipts: parseFloat(receipts),
                    payments: parseFloat(payments),
                    closing_balance: closingBalance,
                    created: true
                });
            }

            // Move to next month
            if (currentMonth === 12) {
                currentMonth = 1;
                currentYear++;
            } else {
                currentMonth++;
            }
        }

        // Update the ledger head's current balance
        const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId, { transaction });
        if (ledgerHead) {
            const currentBalance = await this.calculateBalanceFromTransactions(
                ledgerHeadId, accountId, null, null, transaction
            );

            await ledgerHead.update({
                current_balance: currentBalance
            }, { transaction });
        }

        return {
            accountId,
            ledgerHeadId,
            fromDate,
            recalculatedMonths: results.length,
            months: results
        };
    }
}

module.exports = BalanceCalculator;