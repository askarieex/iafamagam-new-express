const db = require('../models');
const { sequelize } = db;
const { Op } = require('sequelize');

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
        console.log(`Calculating opening balance for ${month}/${year} (ledger ${ledgerHeadId}, account ${accountId})`);
        
        // FIXED: Get the most recent closed period BEFORE the month we're opening
        // This is the key fix to prevent backwards balance flow
        const prevMonthBalance = await db.MonthlyLedgerBalance.findOne({
            where: {
                ledger_head_id: ledgerHeadId,
                account_id: accountId,
                [Op.or]: [
                    { year: { [Op.lt]: year } },                   // Any month from earlier years
                    { year, month: { [Op.lt]: month } }            // Earlier month same year
                ]
            },
            order: [['year', 'DESC'], ['month', 'DESC']],          // Get the most recent one
            transaction
        });
        
        if (prevMonthBalance) {
            console.log(`Found previous period ${prevMonthBalance.month}/${prevMonthBalance.year} with closing balance ${prevMonthBalance.closing_balance}`);
            return parseFloat(prevMonthBalance.closing_balance);
        }
        
        console.log(`No previous periods found, calculating from historical transactions`);
        // No previous period found, calculate from all transactions before this month
        return await this.calculateBalanceFromTransactions(
            ledgerHeadId,
            accountId,
            null, // From beginning of time
            new Date(year, month - 1, 1), // Up to first day of target month
            transaction
        );
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
            dateFilter.tx_date = { ...dateFilter.tx_date, [Op.gte]: fromDate.toISOString().split('T')[0] };
        }

        if (toDate) {
            dateFilter.tx_date = { ...dateFilter.tx_date, [Op.lt]: toDate.toISOString().split('T')[0] };
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
                ledger_head_id: ledgerHeadId
            },
            transaction
        });

        return parseFloat(creditsSum || 0) - parseFloat(debitsSum || 0);
    }
    
    /**
     * Calculate monthly activity (receipts and payments) for a specific month/year
     * @param {number} ledgerHeadId - The ledger head ID
     * @param {number} accountId - The account ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<{receipts: number, payments: number}>} - The calculated activity
     */
    static async calculateMonthlyActivity(ledgerHeadId, accountId, month, year, transaction = null) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        endDate.setHours(23, 59, 59, 999);
        
        console.log(`Calculating monthly activity for ${month}/${year} (ledger ${ledgerHeadId}, account ${accountId})`);
        console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
        
        // Format dates for SQL
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        // Credits (receipts)
        const receiptsSum = await db.Transaction.sum('amount', {
            where: {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                tx_type: 'credit',
                status: 'completed',
                tx_date: {
                    [Op.gte]: startDateStr,
                    [Op.lte]: endDateStr
                }
            },
            transaction
        });
        
        // Debits (payments)
        const paymentsSum = await db.Transaction.sum('amount', {
            where: {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                tx_type: 'debit',
                status: 'completed',
                tx_date: {
                    [Op.gte]: startDateStr,
                    [Op.lte]: endDateStr
                }
            },
            transaction
        });
        
        return {
            receipts: parseFloat(receiptsSum || 0),
            payments: parseFloat(paymentsSum || 0)
        };
    }
    
    /**
     * Recalculate monthly snapshots from a given date forward
     * @param {number} accountId - The account ID
     * @param {number} ledgerHeadId - The ledger head ID
     * @param {string} fromDate - Start date (YYYY-MM-DD) 
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} - Results of recalculation
     */
    static async recalculateMonthlySnapshots(accountId, ledgerHeadId, fromDate, transaction = null) {
        console.log(`Recalculating snapshots for account ${accountId}, ledger ${ledgerHeadId} from ${fromDate}`);
        
        try {
            const fromDateObj = new Date(fromDate);
            const startMonth = fromDateObj.getMonth() + 1; // 1-12
            const startYear = fromDateObj.getFullYear();
            
            // Current date for end bound
            const now = new Date();
            const endMonth = now.getMonth() + 1;
            const endYear = now.getFullYear();
            
            console.log(`Recalculating from ${startMonth}/${startYear} to ${endMonth}/${endYear}`);
            
            let currentMonth = startMonth;
            let currentYear = startYear;
            let previousMonthClosingBalance = null;
            
            // Get the opening balance for the first month
            if (currentMonth === startMonth && currentYear === startYear) {
                const prevMonth = startMonth === 1 ? 12 : startMonth - 1;
                const prevYear = startMonth === 1 ? startYear - 1 : startYear;
                
                // Check for previous month snapshot
                const prevSnapshot = await db.MonthlyLedgerBalance.findOne({
                    where: {
                        account_id: accountId,
                        ledger_head_id: ledgerHeadId,
                        month: prevMonth,
                        year: prevYear
                    },
                    transaction
                });
                
                if (prevSnapshot) {
                    previousMonthClosingBalance = parseFloat(prevSnapshot.closing_balance || 0);
                    console.log(`Using previous month ${prevMonth}/${prevYear} closing balance: ${previousMonthClosingBalance}`);
                } else {
                    // Calculate from all transactions before the start date
                    previousMonthClosingBalance = await this.calculateBalanceFromTransactions(
                        ledgerHeadId,
                        accountId,
                        null,
                        fromDateObj,
                        transaction
                    );
                    console.log(`Calculated opening balance from transactions: ${previousMonthClosingBalance}`);
                }
            }
            
            // Recalculate each month forward
            while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
                await this.recalculateSingleMonthSnapshot(
                    accountId,
                    ledgerHeadId,
                    currentMonth,
                    currentYear,
                    previousMonthClosingBalance,
                    transaction
                );
                
                // Get the updated snapshot to use its closing balance for next month
                const snapshot = await db.MonthlyLedgerBalance.findOne({
                    where: {
                        account_id: accountId,
                        ledger_head_id: ledgerHeadId,
                        month: currentMonth,
                        year: currentYear
                    },
                    transaction
                });
                
                if (snapshot) {
                    previousMonthClosingBalance = parseFloat(snapshot.closing_balance || 0);
                }
                
                // Move to next month
                if (currentMonth === 12) {
                    currentMonth = 1;
                    currentYear++;
                } else {
                    currentMonth++;
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error in recalculateMonthlySnapshots:', error);
            throw error;
        }
    }
    
    /**
     * Recalculate a single month's snapshot
     * @param {number} accountId - The account ID
     * @param {number} ledgerHeadId - The ledger head ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {number} openingBalance - Opening balance for this month
     * @param {Transaction} [transaction] - Sequelize transaction
     */
    static async recalculateSingleMonthSnapshot(accountId, ledgerHeadId, month, year, openingBalance, transaction = null) {
        console.log(`Recalculating month ${month}/${year} with opening balance ${openingBalance}`);
        
        // Calculate receipts and payments for this month
        const { receipts, payments } = await this.calculateMonthlyActivity(
            ledgerHeadId,
            accountId,
            month,
            year,
            transaction
        );
        
        // Calculate closing balance
        const closingBalance = parseFloat(openingBalance || 0) + parseFloat(receipts || 0) - parseFloat(payments || 0);
        
        // Find or create snapshot
        const [snapshot, created] = await db.MonthlyLedgerBalance.findOrCreate({
            where: {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                month,
                year
            },
            defaults: {
                opening_balance: openingBalance || 0,
                receipts: receipts || 0,
                payments: payments || 0,
                closing_balance: closingBalance,
                cash_in_hand: 0,
                cash_in_bank: 0,
                is_open: false
            },
            transaction
        });
        
        if (!created) {
            // Update existing snapshot
            await snapshot.update({
                opening_balance: openingBalance || 0,
                receipts: receipts || 0, 
                payments: payments || 0,
                closing_balance: closingBalance
                // Don't change is_open status
            }, { transaction });
        }
        
        console.log(`Month ${month}/${year} recalculated: opening=${openingBalance}, receipts=${receipts}, payments=${payments}, closing=${closingBalance}`);
    }
}

module.exports = BalanceCalculator;
