/**
 * Monthly End Procedure Utility
 * This utility is designed to be run at the end of each month to generate
 * ledger balance records for all heads based on actual transactions.
 */

const db = require('../models');
const { Op } = require('sequelize');
const { sequelize } = db;

/**
 * Generate monthly ledger balances for a specific month and year
 * @param {number} month - Month (1-12)
 * @param {number} year - Year (e.g., 2025)
 * @returns {Promise<{created: number, updated: number, skipped: number, errors: Array}>}
 */
const generateMonthlyBalances = async (month, year) => {
    if (!month || !year) {
        throw new Error('Month and year are required');
    }

    if (month < 1 || month > 12) {
        throw new Error('Month must be between 1 and 12');
    }

    const results = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: []
    };

    try {
        // Get all ledger heads
        const ledgerHeads = await db.LedgerHead.findAll({
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                }
            ]
        });

        console.log(`Processing ${ledgerHeads.length} ledger heads for ${month}/${year}...`);

        // Calculate the start and end date of the month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of the month

        // Format dates for SQL query
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // For each ledger head, create or update a monthly balance record
        for (const ledgerHead of ledgerHeads) {
            try {
                // Determine opening balance from previous month
                let openingBalance = 0;

                // If this is not January, check previous month of same year
                let prevMonth, prevYear;

                if (month > 1) {
                    prevMonth = month - 1;
                    prevYear = year;
                } else {
                    // If January, check December of previous year
                    prevMonth = 12;
                    prevYear = year - 1;
                }

                // Find previous month's record
                const prevRecord = await db.MonthlyLedgerBalance.findOne({
                    where: {
                        account_id: ledgerHead.account_id,
                        ledger_head_id: ledgerHead.id,
                        month: prevMonth,
                        year: prevYear
                    }
                });

                if (prevRecord) {
                    openingBalance = parseFloat(prevRecord.closing_balance);
                    console.log(`Found previous month balance for ledger ${ledgerHead.id}: ${openingBalance}`);
                } else {
                    // If no previous month record exists, check if there are any transactions before this month
                    // This handles the case of the first monthly record for a ledger head
                    const earliestTransactions = await sequelize.query(`
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
                        type: sequelize.QueryTypes.SELECT
                    });

                    if (earliestTransactions && earliestTransactions[0] && earliestTransactions[0].balance !== null) {
                        openingBalance = parseFloat(earliestTransactions[0].balance || 0);
                        console.log(`Calculated opening balance from historical transactions: ${openingBalance}`);
                    } else {
                        // If no prior transactions, use the current balance as opening balance only for the first month
                        // This handles initial system setup
                        openingBalance = parseFloat(ledgerHead.current_balance || 0);
                        console.log(`No prior transactions, using current balance: ${openingBalance}`);
                    }
                }

                // Calculate receipts (credits) and payments (debits) for this month
                // Get all transaction items for this ledger head in the month
                const monthTransactions = await sequelize.query(`
                    SELECT 
                        SUM(CASE WHEN ti.side = '+' THEN ti.amount ELSE 0 END) as credits,
                        SUM(CASE WHEN ti.side = '-' THEN ti.amount ELSE 0 END) as debits,
                        SUM(CASE 
                            WHEN ti.side = '+' AND (t.cash_type = 'cash' OR (t.cash_type = 'multiple' AND t.cash_amount > 0)) 
                            THEN CASE 
                                WHEN t.cash_type = 'cash' THEN ti.amount 
                                WHEN t.cash_type = 'multiple' THEN ti.amount * (t.cash_amount / t.amount)
                                ELSE 0 
                            END
                            WHEN ti.side = '-' AND (t.cash_type = 'cash' OR (t.cash_type = 'multiple' AND t.cash_amount > 0))
                            THEN -CASE
                                WHEN t.cash_type = 'cash' THEN ti.amount
                                WHEN t.cash_type = 'multiple' THEN ti.amount * (t.cash_amount / t.amount)
                                ELSE 0
                            END
                            ELSE 0 
                        END) as cash_balance,
                        SUM(CASE 
                            WHEN ti.side = '+' AND (t.cash_type != 'cash' OR (t.cash_type = 'multiple' AND t.bank_amount > 0))
                            THEN CASE
                                WHEN t.cash_type = 'cash' THEN 0
                                WHEN t.cash_type = 'multiple' THEN ti.amount * (t.bank_amount / t.amount)
                                ELSE ti.amount
                            END
                            WHEN ti.side = '-' AND (t.cash_type != 'cash' OR (t.cash_type = 'multiple' AND t.bank_amount > 0))
                            THEN -CASE
                                WHEN t.cash_type = 'cash' THEN 0
                                WHEN t.cash_type = 'multiple' THEN ti.amount * (t.bank_amount / t.amount)
                                ELSE ti.amount
                            END
                            ELSE 0 
                        END) as bank_balance
                    FROM transaction_items ti
                    JOIN transactions t ON ti.transaction_id = t.id
                    WHERE ti.ledger_head_id = :ledgerHeadId 
                    AND t.tx_date BETWEEN :startDate AND :endDate
                    AND t.status = 'completed'
                `, {
                    replacements: {
                        ledgerHeadId: ledgerHead.id,
                        startDate: startDateStr,
                        endDate: endDateStr
                    },
                    type: sequelize.QueryTypes.SELECT
                });

                // Extract the results
                const receipts = monthTransactions[0]?.credits ? parseFloat(monthTransactions[0].credits || 0) : 0;
                const payments = monthTransactions[0]?.debits ? parseFloat(monthTransactions[0].debits || 0) : 0;

                // Calculate cash and bank balances 
                const cashInHand = monthTransactions[0]?.cash_balance ? parseFloat(monthTransactions[0].cash_balance || 0) : 0;
                const cashInBank = monthTransactions[0]?.bank_balance ? parseFloat(monthTransactions[0].bank_balance || 0) : 0;

                // Calculate closing balance
                const closingBalance = openingBalance + receipts - payments;

                // Check if a record already exists
                const existingRecord = await db.MonthlyLedgerBalance.findOne({
                    where: {
                        account_id: ledgerHead.account_id,
                        ledger_head_id: ledgerHead.id,
                        month,
                        year
                    }
                });

                if (existingRecord) {
                    // Update existing record
                    await existingRecord.update({
                        opening_balance: openingBalance,
                        receipts,
                        payments,
                        closing_balance: closingBalance,
                        cash_in_hand: cashInHand,
                        cash_in_bank: cashInBank
                    });

                    console.log(`Updated monthly balance for ledger head ${ledgerHead.id} (${ledgerHead.name})`);
                    results.updated++;
                } else {
                    // Create new record
                    await db.MonthlyLedgerBalance.create({
                        account_id: ledgerHead.account_id,
                        ledger_head_id: ledgerHead.id,
                        month,
                        year,
                        opening_balance: openingBalance,
                        receipts,
                        payments,
                        closing_balance: closingBalance,
                        cash_in_hand: cashInHand,
                        cash_in_bank: cashInBank
                    });

                    console.log(`Created monthly balance for ledger head ${ledgerHead.id} (${ledgerHead.name})`);
                    results.created++;
                }

                // Log the balance details for debugging
                console.log(`Balance details: opening=${openingBalance}, receipts=${receipts}, payments=${payments}, closing=${closingBalance}`);
                console.log(`Cash: ${cashInHand}, Bank: ${cashInBank}`);
            } catch (err) {
                console.error(`Error processing ledger head ${ledgerHead.id}:`, err);
                results.errors.push({
                    ledgerHeadId: ledgerHead.id,
                    ledgerHeadName: ledgerHead.name,
                    error: err.message
                });
            }
        }

        return results;
    } catch (error) {
        console.error('Error in generateMonthlyBalances:', error);
        throw error;
    }
};

/**
 * Update ledger head current balances after month-end procedure
 * This ensures the ledger head balances reflect the latest closing balances
 * @param {number} month - Month (1-12)
 * @param {number} year - Year (e.g., 2025)
 * @returns {Promise<{updated: number, errors: Array}>}
 */
const updateLedgerHeadBalances = async (month, year) => {
    if (!month || !year) {
        throw new Error('Month and year are required');
    }

    if (month < 1 || month > 12) {
        throw new Error('Month must be between 1 and 12');
    }

    const results = {
        updated: 0,
        errors: []
    };

    try {
        // Get all monthly balance records for the specified month and year
        const monthlyBalances = await db.MonthlyLedgerBalance.findAll({
            where: {
                month,
                year
            },
            include: [
                {
                    model: db.LedgerHead,
                    as: 'ledgerHead'
                },
                {
                    model: db.Account,
                    as: 'account'
                }
            ]
        });

        console.log(`Updating ${monthlyBalances.length} ledger head balances for ${month}/${year}...`);

        // For each monthly balance, update the corresponding ledger head
        for (const monthlyBalance of monthlyBalances) {
            try {
                // Update the ledger head's balances with the monthly balance closing values
                await monthlyBalance.ledgerHead.update({
                    current_balance: monthlyBalance.closing_balance,
                    cash_balance: monthlyBalance.cash_in_hand,
                    bank_balance: monthlyBalance.cash_in_bank
                });

                console.log(`Updated ledger head ${monthlyBalance.ledger_head_id} balance to ${monthlyBalance.closing_balance}`);
                results.updated++;
            } catch (err) {
                console.error(`Error updating ledger head ${monthlyBalance.ledger_head_id}:`, err);
                results.errors.push({
                    ledgerHeadId: monthlyBalance.ledger_head_id,
                    error: err.message
                });
            }
        }

        // Now update account balances based on their ledger heads
        const accounts = await db.Account.findAll();

        for (const account of accounts) {
            try {
                // Get total cash and bank balances for all ledger heads of this account
                const ledgerHeadTotals = await db.LedgerHead.findAll({
                    where: { account_id: account.id },
                    attributes: [
                        [sequelize.fn('SUM', sequelize.col('cash_balance')), 'total_cash'],
                        [sequelize.fn('SUM', sequelize.col('bank_balance')), 'total_bank'],
                    ],
                    raw: true
                });

                if (ledgerHeadTotals && ledgerHeadTotals[0]) {
                    const totalCash = parseFloat(ledgerHeadTotals[0].total_cash || 0);
                    const totalBank = parseFloat(ledgerHeadTotals[0].total_bank || 0);
                    const totalBalance = totalCash + totalBank;

                    // Update the account with the total balances
                    await account.update({
                        cash_balance: totalCash,
                        bank_balance: totalBank,
                        closing_balance: totalBalance
                    });

                    console.log(`Updated account ${account.id} with totals: cash=${totalCash}, bank=${totalBank}, total=${totalBalance}`);
                }
            } catch (err) {
                console.error(`Error updating account ${account.id}:`, err);
                results.errors.push({
                    accountId: account.id,
                    error: err.message
                });
            }
        }

        return results;
    } catch (error) {
        console.error('Error in updateLedgerHeadBalances:', error);
        throw error;
    }
};

/**
 * Run the complete month-end procedure
 * @param {number} month - Month (1-12)
 * @param {number} year - Year (e.g., 2025)
 * @returns {Promise<Object>} - Results of the procedure
 */
const runMonthEndProcedure = async (month, year) => {
    console.log(`Running month-end procedure for ${month}/${year}...`);

    try {
        // Step 1: Generate monthly balance records
        const balanceResults = await generateMonthlyBalances(month, year);

        // Step 2: Update ledger head current balances
        const updateResults = await updateLedgerHeadBalances(month, year);

        return {
            success: true,
            balanceResults,
            updateResults,
            timestamp: new Date()
        };
    } catch (error) {
        console.error('Month-end procedure failed:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date()
        };
    }
};

module.exports = {
    generateMonthlyBalances,
    updateLedgerHeadBalances,
    runMonthEndProcedure
}; 