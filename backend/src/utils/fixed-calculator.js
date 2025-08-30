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
}

module.exports = BalanceCalculator;
