const db = require('../models');
const { Op } = require('sequelize');

/**
 * Snapshot Service
 * Calculates historical balances for any date by combining monthly_ledger_balances 
 * with same-month transactions up to the selected date
 */
class SnapshotService {
    
    /**
     * Get snapshot of all ledger heads for an account as of a specific date
     * @param {number} accountId - The account ID
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<Array>} Array of ledger head snapshots
     */
    static async snapshotForDate(accountId, date) {
        try {
            console.log(`Getting snapshot for account ${accountId} as of ${date}`);
            
            const snapshotDate = new Date(date);
            const month = snapshotDate.getMonth() + 1; // 1-12
            const year = snapshotDate.getFullYear();
            
            // Get all ledger heads for this account
            const ledgerHeads = await db.LedgerHead.findAll({
                where: { account_id: accountId },
                include: [{
                    model: db.Account,
                    as: 'account'
                }],
                order: [['name', 'ASC']]
            });
            
            const snapshots = [];
            
            for (const ledgerHead of ledgerHeads) {
                const snapshot = await this.calculateLedgerSnapshot(
                    accountId, 
                    ledgerHead.id, 
                    date, 
                    month, 
                    year
                );
                
                snapshots.push({
                    ledger_head_id: ledgerHead.id,
                    ledger_name: ledgerHead.name,
                    head_type: ledgerHead.head_type,
                    description: ledgerHead.description,
                    ...snapshot
                });
            }
            
            console.log(`Calculated snapshots for ${snapshots.length} ledger heads`);
            return snapshots;
            
        } catch (error) {
            console.error('Error getting snapshot for date:', error);
            throw error;
        }
    }
    
    /**
     * Get snapshot of a single ledger head as of a specific date
     * @param {number} accountId - The account ID
     * @param {number} ledgerHeadId - The ledger head ID
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<Object>} Ledger head snapshot
     */
    static async snapshotForLedgerAtDate(accountId, ledgerHeadId, date) {
        try {
            console.log(`Getting snapshot for ledger ${ledgerHeadId} as of ${date}`);
            
            const snapshotDate = new Date(date);
            const month = snapshotDate.getMonth() + 1; // 1-12
            const year = snapshotDate.getFullYear();
            
            // Get ledger head info
            const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId, {
                include: [{
                    model: db.Account,
                    as: 'account'
                }]
            });
            
            if (!ledgerHead) {
                throw new Error(`Ledger head with ID ${ledgerHeadId} not found`);
            }
            
            const snapshot = await this.calculateLedgerSnapshot(
                accountId, 
                ledgerHeadId, 
                date, 
                month, 
                year
            );
            
            return {
                ledger_head_id: ledgerHeadId,
                ledger_name: ledgerHead.name,
                head_type: ledgerHead.head_type,
                description: ledgerHead.description,
                account_name: ledgerHead.account.name,
                ...snapshot
            };
            
        } catch (error) {
            console.error('Error getting ledger snapshot for date:', error);
            throw error;
        }
    }
    
    /**
     * Calculate snapshot for a single ledger head
     * @private
     */
    static async calculateLedgerSnapshot(accountId, ledgerHeadId, date, month, year) {
        try {
            console.log(`Calculating snapshot for ledger ${ledgerHeadId}, date: ${date}, month: ${month}, year: ${year}`);
            
            // Get the monthly balance record for this month/year
            const monthlyBalance = await db.MonthlyLedgerBalance.findOne({
                where: {
                    account_id: accountId,
                    ledger_head_id: ledgerHeadId,
                    month: month,
                    year: year
                }
            });
            
            let openingBalance = 0;
            let receiptsToDate = 0;
            let paymentsToDate = 0;
            
            if (monthlyBalance) {
                console.log(`Found monthly balance: opening=${monthlyBalance.opening_balance}, receipts=${monthlyBalance.receipts}, payments=${monthlyBalance.payments}`);
                
                // Use monthly balance as starting point
                openingBalance = parseFloat(monthlyBalance.opening_balance || 0);
                
                // Calculate transactions up to the selected date within this month
                const firstDayOfMonth = new Date(year, month - 1, 1).toISOString().split('T')[0];
                
                const monthlyActivity = await this.calculateTransactionsInPeriod(
                    accountId,
                    ledgerHeadId,
                    firstDayOfMonth,
                    date
                );
                
                receiptsToDate = monthlyActivity.receipts;
                paymentsToDate = monthlyActivity.payments;
                console.log(`Monthly activity from ${firstDayOfMonth} to ${date}: receipts=${receiptsToDate}, payments=${paymentsToDate}`);
                
            } else {
                console.log(`No monthly balance found for ${month}/${year}, calculating from previous months...`);
                
                // No monthly balance exists - need to calculate opening balance from previous month
                const prevMonth = month === 1 ? 12 : month - 1;
                const prevYear = month === 1 ? year - 1 : year;
                
                // Get previous month's closing balance
                const prevMonthBalance = await db.MonthlyLedgerBalance.findOne({
                    where: {
                        account_id: accountId,
                        ledger_head_id: ledgerHeadId,
                        month: prevMonth,
                        year: prevYear
                    }
                });
                
                if (prevMonthBalance) {
                    openingBalance = parseFloat(prevMonthBalance.closing_balance || 0);
                    console.log(`Using previous month closing balance as opening: ${openingBalance}`);
                } else {
                    // Calculate from all transactions before this month
                    const startOfMonth = new Date(year, month - 1, 1);
                    const allPreviousActivity = await this.calculateTransactionsInPeriod(
                        accountId,
                        ledgerHeadId,
                        null, // From beginning
                        new Date(startOfMonth.getTime() - 1).toISOString().split('T')[0] // Day before month start
                    );
                    openingBalance = allPreviousActivity.receipts - allPreviousActivity.payments;
                    console.log(`Calculated opening balance from all previous transactions: ${openingBalance}`);
                }
                
                // Calculate transactions in current month up to selected date
                const firstDayOfMonth = new Date(year, month - 1, 1).toISOString().split('T')[0];
                const monthlyActivity = await this.calculateTransactionsInPeriod(
                    accountId,
                    ledgerHeadId,
                    firstDayOfMonth,
                    date
                );
                
                receiptsToDate = monthlyActivity.receipts;
                paymentsToDate = monthlyActivity.payments;
                console.log(`Current month activity from ${firstDayOfMonth} to ${date}: receipts=${receiptsToDate}, payments=${paymentsToDate}`);
            }
            
            // Calculate closing balance as of the selected date
            const closingBalance = openingBalance + receiptsToDate - paymentsToDate;
            
            console.log(`Final calculation: opening=${openingBalance} + receipts=${receiptsToDate} - payments=${paymentsToDate} = closing=${closingBalance}`);
            
            // Calculate cash and bank balances proportionally
            const { cashBalance, bankBalance } = await this.calculateCashBankSplit(
                accountId,
                ledgerHeadId,
                date,
                closingBalance
            );
            
            const result = {
                snapshot_date: date,
                opening_balance: parseFloat(openingBalance.toFixed(2)),
                receipts_to_date: parseFloat(receiptsToDate.toFixed(2)),
                payments_to_date: parseFloat(paymentsToDate.toFixed(2)),
                closing_balance: parseFloat(closingBalance.toFixed(2)),
                cash_balance: parseFloat(cashBalance.toFixed(2)),
                bank_balance: parseFloat(bankBalance.toFixed(2))
            };
            
            console.log(`Snapshot result:`, result);
            return result;
            
        } catch (error) {
            console.error('Error calculating ledger snapshot:', error);
            throw error;
        }
    }
    
    /**
     * Calculate transaction activity in a date range
     * @private
     */
    static async calculateTransactionsInPeriod(accountId, ledgerHeadId, fromDate, toDate) {
        try {
            console.log(`Calculating transactions for ledger ${ledgerHeadId} from ${fromDate} to ${toDate}`);
            
            let whereClause = {
                account_id: accountId,
                status: 'completed'
            };
            
            // Add date filters
            if (fromDate || toDate) {
                whereClause.tx_date = {};
                if (fromDate) {
                    whereClause.tx_date[Op.gte] = fromDate;
                }
                if (toDate) {
                    whereClause.tx_date[Op.lte] = toDate;
                }
            }
            

            
            // Get credits (receipts) - money coming INTO this ledger
            const creditTransactions = await db.Transaction.findAll({
                where: {
                    ...whereClause,
                    tx_type: 'credit',
                    ledger_head_id: ledgerHeadId
                },
                attributes: ['amount', 'tx_date', 'tx_type']
            });
            
            // Get debits (payments) - money going OUT of this ledger
            const debitTransactions = await db.Transaction.findAll({
                where: {
                    ...whereClause,
                    tx_type: 'debit',
                    ledger_head_id: ledgerHeadId
                },
                attributes: ['amount', 'tx_date', 'tx_type']
            });
            
            const creditsSum = creditTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
            const debitsSum = debitTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
            
            console.log(`Credits: ${creditsSum}, Debits: ${debitsSum}`);
            
            return {
                receipts: creditsSum,
                payments: debitsSum
            };
            
        } catch (error) {
            console.error('Error calculating transactions in period:', error);
            throw error;
        }
    }
    
    /**
     * Calculate proportional cash and bank balances
     * @private
     */
    static async calculateCashBankSplit(accountId, ledgerHeadId, date, totalBalance) {
        try {
            // Get specific cash/bank amounts for this ledger from transactions
            const snapshotDate = new Date(date);
            const month = snapshotDate.getMonth() + 1;
            const year = snapshotDate.getFullYear();
            
            // Try to get from monthly balance first
            const monthlyBalance = await db.MonthlyLedgerBalance.findOne({
                where: {
                    account_id: accountId,
                    ledger_head_id: ledgerHeadId,
                    month: month,
                    year: year
                }
            });
            
            if (monthlyBalance) {
                // Use the cash/bank split from monthly balance (proportional to date)
                const totalMonthlyBalance = parseFloat(monthlyBalance.closing_balance || 0);
                const monthlyCash = parseFloat(monthlyBalance.cash_in_hand || 0);
                const monthlyBank = parseFloat(monthlyBalance.cash_in_bank || 0);
                
                if (totalMonthlyBalance !== 0) {
                    const cashRatio = monthlyCash / totalMonthlyBalance;
                    const bankRatio = monthlyBank / totalMonthlyBalance;
                    
                    return {
                        cashBalance: totalBalance * cashRatio,
                        bankBalance: totalBalance * bankRatio
                    };
                }
            }
            
            // Fallback: Calculate from actual transaction amounts up to date
            let cashSum = 0;
            let bankSum = 0;
            
            // Get all transactions for this ledger up to the date
            const transactions = await db.Transaction.findAll({
                where: {
                    account_id: accountId,
                    ledger_head_id: ledgerHeadId,
                    tx_date: { [Op.lte]: date },
                    status: 'completed'
                },
                attributes: ['cash_amount', 'bank_amount', 'tx_type', 'ledger_head_id']
            });
            
            transactions.forEach(tx => {
                const cashAmount = parseFloat(tx.cash_amount || 0);
                const bankAmount = parseFloat(tx.bank_amount || 0);
                
                // Credit transactions add to this ledger
                if (tx.tx_type === 'credit') {
                    cashSum += cashAmount;
                    bankSum += bankAmount;
                }
                // Debit transactions subtract from this ledger
                else if (tx.tx_type === 'debit') {
                    cashSum -= cashAmount;
                    bankSum -= bankAmount;
                }
            });
            
            console.log(`Cash/Bank split for ledger ${ledgerHeadId}: cash=${cashSum}, bank=${bankSum}, total=${totalBalance}`);
            
            return {
                cashBalance: cashSum,
                bankBalance: bankSum
            };
            
        } catch (error) {
            console.error('Error calculating cash/bank split:', error);
            return { cashBalance: 0, bankBalance: 0 };
        }
    }
}

module.exports = SnapshotService; 