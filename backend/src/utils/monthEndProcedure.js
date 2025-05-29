/**
 * Monthly End Procedure Utility
 * This utility is designed to be run at the end of each month to generate
 * ledger balance records for all heads based on actual transactions.
 */

const { MonthlyLedgerBalance, LedgerHead, Account } = require('../models');
const { Op } = require('sequelize');

/**
 * Generate monthly ledger balances for a specific month and year
 * @param {number} month - Month (1-12)
 * @param {number} year - Year (e.g., 2025)
 * @returns {Promise<{created: number, skipped: number, errors: Array}>}
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
        skipped: 0,
        errors: []
    };

    try {
        // Get all ledger heads
        const ledgerHeads = await LedgerHead.findAll({
            include: [
                {
                    model: Account,
                    as: 'account',
                    attributes: ['id', 'name']
                }
            ]
        });

        console.log(`Processing ${ledgerHeads.length} ledger heads for ${month}/${year}...`);

        // For each ledger head, create a monthly balance record
        for (const ledgerHead of ledgerHeads) {
            try {
                // Check if a record already exists
                const existingRecord = await MonthlyLedgerBalance.findOne({
                    where: {
                        account_id: ledgerHead.account_id,
                        ledger_head_id: ledgerHead.id,
                        month,
                        year
                    }
                });

                if (existingRecord) {
                    console.log(`Skipping existing record for ledger head ${ledgerHead.id} (${ledgerHead.name})`);
                    results.skipped++;
                    continue;
                }

                // TODO: In a real application, fetch and calculate these values from transactions table
                // This is a simplified example assuming we only have the current balance

                // Get the previous month's closing balance as this month's opening balance
                let openingBalance = 0;

                // If this is not January, check previous month of same year
                if (month > 1) {
                    const prevMonth = month - 1;
                    const prevYear = year;

                    const prevRecord = await MonthlyLedgerBalance.findOne({
                        where: {
                            account_id: ledgerHead.account_id,
                            ledger_head_id: ledgerHead.id,
                            month: prevMonth,
                            year: prevYear
                        }
                    });

                    if (prevRecord) {
                        openingBalance = prevRecord.closing_balance;
                    }
                }
                // If January, check December of previous year
                else {
                    const prevMonth = 12;
                    const prevYear = year - 1;

                    const prevRecord = await MonthlyLedgerBalance.findOne({
                        where: {
                            account_id: ledgerHead.account_id,
                            ledger_head_id: ledgerHead.id,
                            month: prevMonth,
                            year: prevYear
                        }
                    });

                    if (prevRecord) {
                        openingBalance = prevRecord.closing_balance;
                    }
                }

                // Placeholder for transaction calculations
                // In a real application, you would calculate these based on transaction records
                const receipts = 0; // Sum of credits from transactions
                const payments = 0; // Sum of debits from transactions
                const closingBalance = openingBalance + receipts - payments;

                // In a real application, you would calculate these based on cashflow records
                const cashInHand = 0;
                const cashInBank = 0;

                // Create the monthly balance record
                await MonthlyLedgerBalance.create({
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
        const monthlyBalances = await MonthlyLedgerBalance.findAll({
            where: {
                month,
                year
            },
            include: [
                {
                    model: LedgerHead,
                    as: 'ledgerHead'
                }
            ]
        });

        console.log(`Updating ${monthlyBalances.length} ledger head balances for ${month}/${year}...`);

        // For each monthly balance, update the corresponding ledger head
        for (const monthlyBalance of monthlyBalances) {
            try {
                // Update the ledger head's current_balance with the closing_balance
                await monthlyBalance.ledgerHead.update({
                    current_balance: monthlyBalance.closing_balance
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