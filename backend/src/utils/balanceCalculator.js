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
                COALESCE(SUM(CASE WHEN t.tx_type = 'credit' THEN t.amount ELSE 0 END), 0) as receipts,
                COALESCE(SUM(CASE WHEN t.tx_type = 'debit' THEN t.amount ELSE 0 END), 0) as payments
            FROM transactions t
            WHERE t.account_id = :accountId
                AND (
                    (t.tx_type = 'credit' AND t.ledger_head_id = :ledgerHeadId) 
                    OR 
                    (t.tx_type = 'debit' AND t.ledger_head_id = :ledgerHeadId)
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

        // Handle differently based on ledger head type (debit vs credit)
        const isDebitHead = ledgerHead.head_type === 'debit';

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
            // For debit heads (expenses), we don't track balance, only spending amounts
            if (isDebitHead) {
                // Create new snapshot with zero balance but track payments/receipts
                monthlySnapshot = await db.MonthlyLedgerBalance.create({
                    ledger_head_id: ledgerHeadId,
                    account_id: accountId,
                    month: txMonth,
                    year: txYear,
                    opening_balance: 0, // Always zero for debit heads
                    receipts: txType === 'credit' ? amount : 0,
                    payments: txType === 'debit' ? amount : 0,
                    closing_balance: 0, // Always zero for debit heads
                    is_open: false,
                    cash_in_hand: 0,
                    cash_in_bank: 0
                }, { transaction });
            } else {
                // For credit heads, calculate opening balance from previous month
                const openingBalance = await this.calculateOpeningBalance(
                    ledgerHeadId, accountId, txMonth, txYear, transaction
                );

                // Create new snapshot with calculated balances
                monthlySnapshot = await db.MonthlyLedgerBalance.create({
                    ledger_head_id: ledgerHeadId,
                    account_id: accountId,
                    month: txMonth,
                    year: txYear,
                    opening_balance: openingBalance,
                    receipts: txType === 'credit' ? amount : 0,
                    payments: txType === 'debit' ? amount : 0,
                    closing_balance: openingBalance + (txType === 'credit' ? amount : -amount),
                    is_open: false,
                    cash_in_hand: 0,
                    cash_in_bank: 0
                }, { transaction });
            }
        } else {
            // Update existing snapshot
            const newReceipts = txType === 'credit'
                ? parseFloat(monthlySnapshot.receipts) + parseFloat(amount)
                : parseFloat(monthlySnapshot.receipts);

            const newPayments = txType === 'debit'
                ? parseFloat(monthlySnapshot.payments) + parseFloat(amount)
                : parseFloat(monthlySnapshot.payments);

            if (isDebitHead) {
                // For debit heads, update only receipts and payments, keep balance at zero
                await monthlySnapshot.update({
                    receipts: newReceipts,
                    payments: newPayments,
                    // Keep opening and closing balance at zero for debit heads
                    opening_balance: 0,
                    closing_balance: 0
                }, { transaction });
            } else {
                // For credit heads, calculate proper opening/closing balance
                const newClosingBalance = parseFloat(monthlySnapshot.opening_balance) + newReceipts - newPayments;

                await monthlySnapshot.update({
                    receipts: newReceipts,
                    payments: newPayments,
                    closing_balance: newClosingBalance
                }, { transaction });
            }
        }

        // Update the ledger head's current balance
        if (isDebitHead) {
            // For debit heads, current_balance should reflect total spent (payments - receipts)
            // This helps track expenses, not a "balance" in the traditional sense
            const totalExpenses = parseFloat(monthlySnapshot.payments) - parseFloat(monthlySnapshot.receipts);

            await ledgerHead.update({
                current_balance: totalExpenses,
                // Still update cash/bank balances for UI displays
                cash_balance: txType === 'credit' ?
                    parseFloat(ledgerHead.cash_balance) - parseFloat(amount) :
                    parseFloat(ledgerHead.cash_balance) + parseFloat(amount),
                bank_balance: 0 // We don't track bank balance for debit heads
            }, { transaction });
        } else {
            // For credit heads, calculate true balance from all transactions
            const currentBalance = await this.calculateBalanceFromTransactions(
                ledgerHeadId, accountId, null, null, transaction
            );

            await ledgerHead.update({
                current_balance: currentBalance
            }, { transaction });
        }

        // Return the updated balances
        return {
            ledgerHeadId,
            accountId,
            month: txMonth,
            year: txYear,
            isDebitHead,
            currentBalance: isDebitHead ?
                parseFloat(monthlySnapshot.payments) - parseFloat(monthlySnapshot.receipts) :
                parseFloat(monthlySnapshot.closing_balance),
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
        let totalDelta = 0; // Track the total delta for audit logging

        // Track original values for audit logging
        let originalFirstMonthClosing = null;
        let newFirstMonthClosing = null;

        // Get the ledger head to determine its type
        const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId, { transaction });
        if (!ledgerHead) {
            throw new Error(`Ledger head with ID ${ledgerHeadId} not found`);
        }
        
        // Check if this is a debit head (expense category) or credit head (balance account)
        const isDebitHead = ledgerHead.head_type === 'debit';

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

            // Store original closing value of first month for delta calculation
            if (currentMonth === startMonth && currentYear === startYear && snapshot) {
                originalFirstMonthClosing = parseFloat(snapshot.closing_balance);
            }

            // Calculate previous month/year for chronological ordering
            let monthForPrev = currentMonth > 1 ? currentMonth - 1 : 12;
            let yearForPrev = currentMonth > 1 ? currentYear : currentYear - 1;

            // For debit heads, we don't need the previous month's closing balance
            // since we don't track balances for expense categories
            let openingBalance = 0;
            
            if (!isDebitHead) {
                // Only for credit heads - get previous month's snapshot for opening balance
                const prev = await db.MonthlyLedgerBalance.findOne({
                    where: {
                        account_id: accountId,
                        ledger_head_id: ledgerHeadId,
                        year: yearForPrev,
                        month: monthForPrev
                    },
                    transaction
                });
                
                if (prev) {
                    openingBalance = parseFloat(prev.closing_balance);
                    console.log(`Using previous month's closing balance as opening: ${openingBalance}`);
                } else {
                    // If no previous snapshot and this is the first month being calculated,
                    // calculate from all transactions before this month
                    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
                    const txBeforeMonth = await this.calculateBalanceFromTransactions(
                        ledgerHeadId, accountId, null, firstDayOfMonth, transaction
                    );
                    
                    openingBalance = txBeforeMonth;
                    console.log(`Calculated opening balance from transactions: ${openingBalance}`);
                }
            }

            // Calculate transactions for this month
            const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
            const lastDayOfMonth = new Date(currentYear, currentMonth, 0);
            
            // Format dates for query
            const fromDateStr = firstDayOfMonth.toISOString().split('T')[0];
            const toDateStr = lastDayOfMonth.toISOString().split('T')[0];
            
            // Get all transactions for this month
            const monthlyTransactions = await db.Transaction.findAll({
                where: {
                    account_id: accountId,
                    tx_date: {
                        [Op.between]: [fromDateStr, toDateStr]
                    },
                    status: 'completed'
                },
                include: [
                    {
                        model: db.TransactionItem,
                        as: 'items',
                        where: {
                            ledger_head_id: ledgerHeadId
                        }
                    }
                ],
                transaction
            });
            
            // Calculate receipts and payments
            let receipts = 0;
            let payments = 0;
            
            for (const tx of monthlyTransactions) {
                for (const item of tx.items) {
                    if (item.side === '+') {
                        receipts += parseFloat(item.amount);
                    } else {
                        payments += parseFloat(item.amount);
                    }
                }
            }
            
            // Calculate closing balance differently based on head type
            let closingBalance;
            if (isDebitHead) {
                // For debit heads, always keep closing balance at zero
                // We only track expenses, not balances
                closingBalance = 0;
            } else {
                // For credit heads, calculate proper balance
                closingBalance = openingBalance + receipts - payments;
            }

            if (snapshot) {
                // Update existing snapshot
                await snapshot.update({
                    opening_balance: isDebitHead ? 0 : openingBalance,
                    receipts: receipts,
                    payments: payments,
                    closing_balance: isDebitHead ? 0 : closingBalance
                }, { transaction });

                if (currentMonth === startMonth && currentYear === startYear) {
                    newFirstMonthClosing = isDebitHead ? 0 : closingBalance;
                }

                results.push({
                    month: currentMonth,
                    year: currentYear,
                    opening_balance: isDebitHead ? 0 : parseFloat(openingBalance),
                    receipts: parseFloat(receipts),
                    payments: parseFloat(payments),
                    closing_balance: isDebitHead ? 0 : closingBalance,
                    created: false
                });
            } else {
                // Create new snapshot if it doesn't exist
                console.log(`No snapshot exists for ${currentMonth}/${currentYear} - creating one`);

                // ALWAYS create new snapshots as NOT open to avoid constraint violations
                // The proper place to set which period is open is in ensureOnlyCurrentPeriodOpen

                // Create new snapshot
                snapshot = await db.MonthlyLedgerBalance.create({
                    account_id: accountId,
                    ledger_head_id: ledgerHeadId,
                    month: currentMonth,
                    year: currentYear,
                    opening_balance: isDebitHead ? 0 : openingBalance,
                    receipts: receipts,
                    payments: payments,
                    closing_balance: isDebitHead ? 0 : closingBalance,
                    is_open: false, // Always set to false to avoid unique constraint violation
                    cash_in_hand: 0,
                    cash_in_bank: 0
                }, { transaction });

                results.push({
                    month: currentMonth,
                    year: currentYear,
                    opening_balance: isDebitHead ? 0 : parseFloat(openingBalance),
                    receipts: parseFloat(receipts),
                    payments: parseFloat(payments),
                    closing_balance: isDebitHead ? 0 : closingBalance,
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
        if (ledgerHead) {
            if (isDebitHead) {
                // For debit heads, current_balance represents total expenses
                // Get the sum of all payments minus all receipts
                const totalExpenses = await db.MonthlyLedgerBalance.sum('payments', {
                    where: {
                        account_id: accountId,
                        ledger_head_id: ledgerHeadId
                    },
                    transaction
                }) - await db.MonthlyLedgerBalance.sum('receipts', {
                    where: {
                        account_id: accountId,
                        ledger_head_id: ledgerHeadId
                    },
                    transaction
                });
                
                await ledgerHead.update({
                    current_balance: totalExpenses || 0
                }, { transaction });
            } else {
                // For credit heads, calculate true balance from all transactions
                const currentBalance = await this.calculateBalanceFromTransactions(
                    ledgerHeadId, accountId, null, null, transaction
                );
                
                await ledgerHead.update({
                    current_balance: currentBalance
                }, { transaction });
            }
        }

        // Calculate the delta for audit logging
        if (originalFirstMonthClosing !== null && newFirstMonthClosing !== null) {
            totalDelta = newFirstMonthClosing - originalFirstMonthClosing;
        }

        // Log the recalculation for audit purposes
        if (db.AuditLog) {
            try {
                await db.AuditLog.create({
                    action: 'periodRecalculated',
                    entity_type: 'MonthlyLedgerBalance',
                    entity_id: `${accountId}_${ledgerHeadId}`,
                    details: JSON.stringify({
                        fromMonth: startMonth,
                        fromYear: startYear,
                        accountId,
                        ledgerHeadId,
                        delta: totalDelta.toFixed(2),
                        recalculatedMonths: results.length,
                        isDebitHead
                    }),
                    created_at: new Date()
                }, { transaction });
                console.log(`Audit log created for balance recalculation, delta: ${totalDelta.toFixed(2)}`);
            } catch (error) {
                console.error('Failed to create audit log for balance recalculation:', error);
                // Don't fail the transaction just because audit logging failed
            }
        }

        return {
            accountId,
            ledgerHeadId,
            fromDate,
            recalculatedMonths: results.length,
            months: results,
            delta: totalDelta,
            isDebitHead
        };
    }
}

module.exports = BalanceCalculator;