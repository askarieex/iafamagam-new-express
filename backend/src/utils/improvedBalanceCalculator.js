const db = require('../models');

/**
 * Utility class for balance calculation and recalculation
 */
class ImprovedBalanceCalculator {
    /**
     * Recalculate all monthly snapshots from a given date forward,
     * ensuring proper balance propagation for backdated transactions
     * 
     * @param {number} accountId - The account ID
     * @param {number} ledgerHeadId - The ledger head ID
     * @param {string} fromDate - Start date (YYYY-MM-DD)
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} - Results of recalculation
     */
    static async recalculateMonthlySnapshots(accountId, ledgerHeadId, fromDate, transaction = null) {
        console.log(`[IMPROVED] Recalculating snapshots for account ${accountId}, ledger ${ledgerHeadId} from ${fromDate}`);
        
        try {
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

            console.log(`Recalculating from ${startMonth}/${startYear} to ${endMonth}/${endYear}`);

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

                // Calculate opening balance for this month
                let openingBalance;
                
                if (previousMonthClosingBalance !== null) {
                    // Use previous month's closing balance as this month's opening
                    // This is the key to propagating changes forward
                    openingBalance = previousMonthClosingBalance;
                    console.log(`Using previous month's closing balance: ${openingBalance}`);
                } else if (currentMonth === startMonth && currentYear === startYear) {
                    // For the first month, calculate opening balance up to the from date
                    const prevMonth = startMonth === 1 ? 12 : startMonth - 1;
                    const prevYear = startMonth === 1 ? startYear - 1 : startYear;
                    
                    // Look for previous month's closing balance
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
                        // Use previous month's closing balance
                        openingBalance = parseFloat(prevSnapshot.closing_balance);
                        console.log(`Using previous month snapshot's closing balance: ${openingBalance}`);
                    } else {
                        // No previous month snapshot, calculate from all transactions before the date
                        const endOfPrevMonth = new Date(startYear, startMonth - 1, 0);
                        openingBalance = await this.calculateBalanceUntilDate(
                            ledgerHeadId, accountId, endOfPrevMonth, transaction
                        );
                        console.log(`Calculated opening balance from transactions: ${openingBalance}`);
                    }
                } else {
                    // For other months, opening should be the previous month's closing
                    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
                    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
                    
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
                        openingBalance = parseFloat(prevSnapshot.closing_balance);
                        console.log(`Using previous month snapshot's closing balance: ${openingBalance}`);
                    } else {
                        // No previous month snapshot, use 0 as opening balance
                        openingBalance = 0;
                        console.log(`No previous month snapshot found, using 0 as opening balance`);
                    }
                }

                // Calculate receipts and payments for this month
                const { receipts, payments } = await this.calculateMonthlyActivity(
                    ledgerHeadId,
                    accountId,
                    currentMonth,
                    currentYear,
                    transaction
                );
                console.log(`Month ${currentMonth}/${currentYear} activity: receipts=${receipts}, payments=${payments}`);

                // Calculate closing balance
                const closingBalance = parseFloat(openingBalance) + parseFloat(receipts) - parseFloat(payments);
                console.log(`Calculated closing balance: ${closingBalance}`);

                if (snapshot) {
                    // Update existing snapshot
                    const isOpen = snapshot.is_open;
                    
                    await snapshot.update({
                        opening_balance: openingBalance,
                        receipts: receipts,
                        payments: payments,
                        closing_balance: closingBalance,
                        is_open: isOpen // Preserve open status
                    }, { transaction });
                    
                    console.log(`Updated existing snapshot for ${currentMonth}/${currentYear}`);
                } else {
                    // Create new snapshot
                    const isCurrentMonth = (currentMonth === now.getMonth() + 1 && currentYear === now.getFullYear());
                    
                    snapshot = await db.MonthlyLedgerBalance.create({
                        account_id: accountId,
                        ledger_head_id: ledgerHeadId,
                        month: currentMonth,
                        year: currentYear,
                        opening_balance: openingBalance,
                        receipts: receipts,
                        payments: payments,
                        closing_balance: closingBalance,
                        is_open: isCurrentMonth, // Only open for current month
                        cash_in_hand: 0,
                        cash_in_bank: 0
                    }, { transaction });
                    
                    console.log(`Created new snapshot for ${currentMonth}/${currentYear}`);
                }

                // Store this month's closing balance for next month's opening
                previousMonthClosingBalance = closingBalance;

                results.push({
                    month: currentMonth,
                    year: currentYear,
                    opening_balance: parseFloat(openingBalance),
                    receipts: parseFloat(receipts),
                    payments: parseFloat(payments),
                    closing_balance: parseFloat(closingBalance)
                });

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
                const currentBalance = await this.calculateBalanceUntilDate(
                    ledgerHeadId, accountId, new Date(), transaction
                );

                await ledgerHead.update({
                    current_balance: currentBalance
                }, { transaction });
                
                console.log(`Updated ledger head ${ledgerHeadId} current balance to ${currentBalance}`);
            }

            return {
                accountId,
                ledgerHeadId,
                fromDate,
                recalculatedMonths: results.length,
                months: results
            };
        } catch (error) {
            console.error('Error in improved recalculateMonthlySnapshots:', error);
            throw error;
        }
    }

    /**
     * Calculate the balance for a ledger head up to a specific date
     * @param {number} ledgerHeadId - The ledger head ID
     * @param {number} accountId - The account ID
     * @param {Date} toDate - The end date
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<number>} - The calculated balance
     */
    static async calculateBalanceUntilDate(ledgerHeadId, accountId, toDate, transaction = null) {
        try {
            const toDateStr = toDate.toISOString().split('T')[0];
            
            // Get sum of all credits
            const creditsResult = await db.sequelize.query(
                `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
                WHERE account_id = ? AND ledger_head_id = ? AND tx_type = 'credit' 
                AND status = 'completed' AND tx_date <= ?`,
                {
                    replacements: [accountId, ledgerHeadId, toDateStr],
                    type: db.sequelize.QueryTypes.SELECT,
                    transaction
                }
            );
            
            // Get sum of all debits
            const debitsResult = await db.sequelize.query(
                `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
                WHERE account_id = ? AND ledger_head_id = ? AND tx_type = 'debit' 
                AND status = 'completed' AND tx_date <= ?`,
                {
                    replacements: [accountId, ledgerHeadId, toDateStr],
                    type: db.sequelize.QueryTypes.SELECT,
                    transaction
                }
            );
            
            const credits = parseFloat(creditsResult[0].total) || 0;
            const debits = parseFloat(debitsResult[0].total) || 0;
            
            // Get the ledger head to check if it has an initial balance
            const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId, { transaction });
            const initialBalance = ledgerHead && ledgerHead.initial_balance ? parseFloat(ledgerHead.initial_balance) : 0;
            
            // Calculate balance: initial + credits - debits
            const balance = initialBalance + credits - debits;
            
            return balance;
        } catch (error) {
            console.error('Error calculating balance until date:', error);
            throw error;
        }
    }

    /**
     * Calculate the activity (receipts and payments) for a month
     * @param {number} ledgerHeadId - The ledger head ID
     * @param {number} accountId - The account ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} - The calculated receipts and payments
     */
    static async calculateMonthlyActivity(ledgerHeadId, accountId, month, year, transaction = null) {
        try {
            // Start and end date for the month
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0); // Last day of month
            
            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];
            
            // Get sum of all credits for the month
            const creditsResult = await db.sequelize.query(
                `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
                WHERE account_id = ? AND ledger_head_id = ? AND tx_type = 'credit' 
                AND status = 'completed' AND tx_date >= ? AND tx_date <= ?`,
                {
                    replacements: [accountId, ledgerHeadId, startDateStr, endDateStr],
                    type: db.sequelize.QueryTypes.SELECT,
                    transaction
                }
            );
            
            // Get sum of all debits for the month
            const debitsResult = await db.sequelize.query(
                `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
                WHERE account_id = ? AND ledger_head_id = ? AND tx_type = 'debit' 
                AND status = 'completed' AND tx_date >= ? AND tx_date <= ?`,
                {
                    replacements: [accountId, ledgerHeadId, startDateStr, endDateStr],
                    type: db.sequelize.QueryTypes.SELECT,
                    transaction
                }
            );
            
            const receipts = parseFloat(creditsResult[0].total) || 0;
            const payments = parseFloat(debitsResult[0].total) || 0;
            
            return { receipts, payments };
        } catch (error) {
            console.error('Error calculating monthly activity:', error);
            throw error;
        }
    }
}

module.exports = ImprovedBalanceCalculator; 