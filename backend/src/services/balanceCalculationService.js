const db = require('../models');
const { sequelize, Sequelize } = require('../models');
const { Op } = Sequelize;

/**
 * Balance Calculation Service - Handles accurate balance calculations
 * 
 * This service ensures all balance calculations are consistent and accurate across:
 * - Ledger Head balances (current_balance, cash_balance, bank_balance)
 * - Account balances (cash_balance, bank_balance, closing_balance)
 * - Monthly snapshots (opening_balance, receipts, payments, closing_balance)
 */
class BalanceCalculationService {
    
    /**
     * Calculate and split amounts based on payment method
     * @param {string} cashType - Payment method (cash, bank, both, multiple, etc.)
     * @param {number} totalAmount - Total transaction amount
     * @param {number} cashAmount - Specific cash amount (for 'both' or 'multiple')
     * @param {number} bankAmount - Specific bank amount (for 'both' or 'multiple')
     * @returns {Object} { cashAmount, bankAmount, isValid }
     */
    calculateAmountSplit(cashType, totalAmount, cashAmount = 0, bankAmount = 0) {
        const total = parseFloat(totalAmount);
        let cash = 0;
        let bank = 0;

        switch (cashType) {
            case 'cash':
                cash = total;
                bank = 0;
                break;
                
            case 'bank':
            case 'upi':
            case 'card':
            case 'netbank':
                cash = 0;
                bank = total;
                break;
                
            case 'cheque':
                cash = 0;
                bank = total; // Cheques are treated as bank transactions
                break;
                
            case 'both':
            case 'multiple':
                cash = parseFloat(cashAmount || 0);
                bank = parseFloat(bankAmount || 0);
                
                // Validate that cash + bank equals total
                const sum = cash + bank;
                if (Math.abs(sum - total) > 0.01) {
                    return {
                        cashAmount: cash,
                        bankAmount: bank,
                        isValid: false,
                        error: `Cash (${cash}) + Bank (${bank}) = ${sum} does not equal total amount ${total}`
                    };
                }
                break;
                
            default:
                // Default to bank for unknown payment types
                cash = 0;
                bank = total;
                break;
        }

        return {
            cashAmount: cash,
            bankAmount: bank,
            isValid: true
        };
    }

    /**
     * Update ledger head balance with proper cash/bank tracking
     * @param {number} ledgerHeadId - Ledger head ID
     * @param {number} amount - Total amount
     * @param {number} cashAmount - Cash portion
     * @param {number} bankAmount - Bank portion
     * @param {string} operation - '+' for credit, '-' for debit
     * @param {string} txDate - Transaction date (YYYY-MM-DD)
     * @param {Object} transaction - Sequelize transaction
     * @returns {Promise<Object>} Updated ledger head
     */
    async updateLedgerHeadBalance(ledgerHeadId, amount, cashAmount, bankAmount, operation, txDate, transaction) {
        // Find and lock the ledger head
        const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId, {
            lock: true,
            transaction
        });

        if (!ledgerHead) {
            throw new Error(`Ledger head ID ${ledgerHeadId} not found`);
        }

        const totalAmount = parseFloat(amount);
        const cashAmt = parseFloat(cashAmount);
        const bankAmt = parseFloat(bankAmount);

        // Calculate new balances
        let newCurrentBalance = parseFloat(ledgerHead.current_balance);
        let newCashBalance = parseFloat(ledgerHead.cash_balance);
        let newBankBalance = parseFloat(ledgerHead.bank_balance);

        if (operation === '+') {
            // Credit operation - increase balances
            newCurrentBalance += totalAmount;
            newCashBalance += cashAmt;
            newBankBalance += bankAmt;
        } else {
            // Debit operation - decrease balances
            newCurrentBalance -= totalAmount;
            newCashBalance -= cashAmt;
            newBankBalance -= bankAmt;

            // Validate sufficient balance for debit operations
            if (newCurrentBalance < -0.01) { // Allow small floating point errors
                const errorMsg = `Insufficient balance in ledger head "${ledgerHead.name}" (ID: ${ledgerHead.id}). Required: ₹${totalAmount}, Available: ₹${ledgerHead.current_balance}`;
                console.error(`Balance validation failed: ${errorMsg}`);
                throw new Error(errorMsg);
            }
            
            if (newCashBalance < -0.01 && cashAmt > 0) {
                const errorMsg = `Insufficient cash balance in ledger head "${ledgerHead.name}" (ID: ${ledgerHead.id}). Required: ₹${cashAmt}, Available: ₹${ledgerHead.cash_balance}`;
                console.error(`Cash balance validation failed: ${errorMsg}`);
                throw new Error(errorMsg);
            }
            
            if (newBankBalance < -0.01 && bankAmt > 0) {
                const errorMsg = `Insufficient bank balance in ledger head "${ledgerHead.name}" (ID: ${ledgerHead.id}). Required: ₹${bankAmt}, Available: ₹${ledgerHead.bank_balance}`;
                console.error(`Bank balance validation failed: ${errorMsg}`);
                throw new Error(errorMsg);
            }
        }

        // Update ledger head
        const updatedLedgerHead = await ledgerHead.update({
            current_balance: Math.round(newCurrentBalance * 100) / 100, // Round to 2 decimal places
            cash_balance: Math.round(newCashBalance * 100) / 100,
            bank_balance: Math.round(newBankBalance * 100) / 100
        }, { transaction });

        // Update monthly balance snapshot
        await this.updateMonthlyBalanceSnapshot(
            ledgerHead.account_id,
            ledgerHeadId,
            totalAmount,
            cashAmt,
            bankAmt,
            operation,
            txDate,
            transaction
        );

        // Update account balance
        await this.updateAccountBalance(
            ledgerHead.account_id,
            cashAmt,
            bankAmt,
            operation,
            transaction
        );

        console.log(`Updated ledger head ${ledgerHeadId}: Total=${newCurrentBalance}, Cash=${newCashBalance}, Bank=${newBankBalance}`);
        
        return updatedLedgerHead;
    }

    /**
     * Update monthly balance snapshot
     * @param {number} accountId - Account ID
     * @param {number} ledgerHeadId - Ledger head ID
     * @param {number} amount - Total amount
     * @param {number} cashAmount - Cash amount
     * @param {number} bankAmount - Bank amount
     * @param {string} operation - '+' or '-'
     * @param {string} txDate - Transaction date
     * @param {Object} transaction - Sequelize transaction
     */
    async updateMonthlyBalanceSnapshot(accountId, ledgerHeadId, amount, cashAmount, bankAmount, operation, txDate, transaction) {
        const txDateObj = new Date(txDate);
        const month = txDateObj.getMonth() + 1;
        const year = txDateObj.getFullYear();

        // Find existing monthly balance record
        let monthlyBalance = await db.MonthlyLedgerBalance.findOne({
            where: {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                month,
                year
            },
            transaction
        });

        // Get ledger head info to determine type
        const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId, { transaction });
        const isDebitHead = ledgerHead.head_type === 'debit';

        if (!monthlyBalance) {
            // Create new monthly balance record
            let openingBalance = 0;
            let openingCash = 0;
            let openingBank = 0;

            if (!isDebitHead) {
                // For credit heads, get opening balance from previous month
                const { opening, cashOpening, bankOpening } = await this.calculateOpeningBalance(
                    accountId, ledgerHeadId, month, year, transaction
                );
                openingBalance = opening;
                openingCash = cashOpening;
                openingBank = bankOpening;
            }

            const receipts = operation === '+' ? amount : 0;
            const payments = operation === '-' ? amount : 0;
            const closingBalance = isDebitHead ? 0 : (openingBalance + receipts - payments);

            const cashInHand = isDebitHead ? 0 : (openingCash + (operation === '+' ? cashAmount : -cashAmount));
            const cashInBank = isDebitHead ? 0 : (openingBank + (operation === '+' ? bankAmount : -bankAmount));

            monthlyBalance = await db.MonthlyLedgerBalance.create({
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                month,
                year,
                opening_balance: openingBalance,
                receipts,
                payments,
                closing_balance: closingBalance,
                cash_in_hand: Math.max(0, cashInHand), // Ensure non-negative
                cash_in_bank: Math.max(0, cashInBank), // Ensure non-negative
                is_open: false
            }, { transaction });

            console.log(`Created monthly balance for ${ledgerHeadId} (${month}/${year}): Opening=${openingBalance}, Closing=${closingBalance}`);
        } else {
            // Update existing monthly balance
            const newReceipts = operation === '+' 
                ? parseFloat(monthlyBalance.receipts) + amount
                : parseFloat(monthlyBalance.receipts);

            const newPayments = operation === '-'
                ? parseFloat(monthlyBalance.payments) + amount
                : parseFloat(monthlyBalance.payments);

            let newClosingBalance = parseFloat(monthlyBalance.closing_balance);
            let newCashInHand = parseFloat(monthlyBalance.cash_in_hand);
            let newCashInBank = parseFloat(monthlyBalance.cash_in_bank);

            if (!isDebitHead) {
                // For credit heads, update balances
                newClosingBalance = parseFloat(monthlyBalance.opening_balance) + newReceipts - newPayments;

                if (operation === '+') {
                    newCashInHand += cashAmount;
                    newCashInBank += bankAmount;
                } else {
                    newCashInHand = Math.max(0, newCashInHand - cashAmount);
                    newCashInBank = Math.max(0, newCashInBank - bankAmount);
                }
            }

            await monthlyBalance.update({
                receipts: newReceipts,
                payments: newPayments,
                closing_balance: newClosingBalance,
                cash_in_hand: newCashInHand,
                cash_in_bank: newCashInBank
            }, { transaction });

            console.log(`Updated monthly balance for ${ledgerHeadId} (${month}/${year}): Receipts=${newReceipts}, Payments=${newPayments}, Closing=${newClosingBalance}`);
        }
    }

    /**
     * Calculate opening balance from previous month or historical transactions
     */
    async calculateOpeningBalance(accountId, ledgerHeadId, month, year, transaction) {
        // Try to find previous month's record
        let prevMonth, prevYear;
        if (month > 1) {
            prevMonth = month - 1;
            prevYear = year;
        } else {
            prevMonth = 12;
            prevYear = year - 1;
        }

        const prevRecord = await db.MonthlyLedgerBalance.findOne({
            where: {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                month: prevMonth,
                year: prevYear
            },
            transaction
        });

        if (prevRecord) {
            return {
                opening: parseFloat(prevRecord.closing_balance),
                cashOpening: parseFloat(prevRecord.cash_in_hand),
                bankOpening: parseFloat(prevRecord.cash_in_bank)
            };
        }

        // If no previous record, calculate from historical transactions
        const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];

        const result = await sequelize.query(`
            SELECT 
                SUM(CASE WHEN ti.side = '+' THEN ti.amount ELSE -ti.amount END) as balance,
                SUM(CASE WHEN ti.side = '+' THEN t.cash_amount ELSE -t.cash_amount END) as cash_balance,
                SUM(CASE WHEN ti.side = '+' THEN t.bank_amount ELSE -t.bank_amount END) as bank_balance
            FROM transaction_items ti
            JOIN transactions t ON ti.transaction_id = t.id
            WHERE ti.ledger_head_id = :ledgerHeadId 
            AND t.tx_date < :startDate
            AND t.status = 'completed'
        `, {
            replacements: { ledgerHeadId, startDate },
            type: sequelize.QueryTypes.SELECT,
            transaction
        });

        const row = result[0];
        return {
            opening: parseFloat(row?.balance || 0),
            cashOpening: Math.max(0, parseFloat(row?.cash_balance || 0)),
            bankOpening: Math.max(0, parseFloat(row?.bank_balance || 0))
        };
    }

    /**
     * Update account-level balances
     */
    async updateAccountBalance(accountId, cashAmount, bankAmount, operation, transaction) {
        const account = await db.Account.findByPk(accountId, {
            lock: true,
            transaction
        });

        if (!account) {
            throw new Error(`Account ID ${accountId} not found`);
        }

        let newCashBalance = parseFloat(account.cash_balance);
        let newBankBalance = parseFloat(account.bank_balance);

        if (operation === '+') {
            newCashBalance += parseFloat(cashAmount);
            newBankBalance += parseFloat(bankAmount);
        } else {
            newCashBalance -= parseFloat(cashAmount);
            newBankBalance -= parseFloat(bankAmount);
        }

        const newClosingBalance = newCashBalance + newBankBalance;

        await account.update({
            cash_balance: Math.round(newCashBalance * 100) / 100,
            bank_balance: Math.round(newBankBalance * 100) / 100,
            closing_balance: Math.round(newClosingBalance * 100) / 100
        }, { transaction });

        console.log(`Updated account ${accountId}: Cash=${newCashBalance}, Bank=${newBankBalance}, Total=${newClosingBalance}`);
    }

    /**
     * Recalculate forward balances starting from a specific month/year
     * This is the core function for cascading balance updates when backdated transactions are added
     * @param {number} accountId - Account ID
     * @param {number} ledgerHeadId - Ledger head ID
     * @param {number} startMonth - Month to start recalculation from (1-12)
     * @param {number} startYear - Year to start recalculation from
     * @param {Object} transaction - Sequelize transaction
     */
    async recalculateForwardBalances(accountId, ledgerHeadId, startMonth, startYear, transaction) {
        console.log(`🔄 Starting cascading balance recalculation for ledger ${ledgerHeadId} from ${startMonth}/${startYear}`);
        
        // Get ledger head info to determine type
        const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId, { transaction });
        if (!ledgerHead) {
            throw new Error(`Ledger head ${ledgerHeadId} not found`);
        }
        
        const isDebitHead = ledgerHead.head_type === 'debit';
        
        // For debit heads, we don't cascade balances (they don't carry forward)
        if (isDebitHead) {
            console.log(`Ledger ${ledgerHeadId} is a debit head, no cascading needed`);
            return;
        }
        
        // Get all monthly balance records from the start month forward, ordered chronologically
        const monthlyBalances = await db.MonthlyLedgerBalance.findAll({
            where: {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                [Op.or]: [
                    { year: { [Op.gt]: startYear } },
                    {
                        year: startYear,
                        month: { [Op.gte]: startMonth }
                    }
                ]
            },
            order: [['year', 'ASC'], ['month', 'ASC']],
            transaction
        });
        
        console.log(`Found ${monthlyBalances.length} monthly balance records to recalculate`);
        
        // Process each month sequentially to maintain proper opening/closing balance chain
        for (let i = 0; i < monthlyBalances.length; i++) {
            const monthlyBalance = monthlyBalances[i];
            const month = monthlyBalance.month;
            const year = monthlyBalance.year;
            
            console.log(`Recalculating ${month}/${year} for ledger ${ledgerHeadId}`);
            
            // Calculate the correct opening balance for this month
            let openingBalance = 0;
            let openingCash = 0;
            let openingBank = 0;
            
            if (i === 0) {
                // For the first month in our recalculation, get opening from previous month
                const { opening, cashOpening, bankOpening } = await this.calculateOpeningBalance(
                    accountId, ledgerHeadId, month, year, transaction
                );
                openingBalance = opening;
                openingCash = cashOpening;
                openingBank = bankOpening;
            } else {
                // For subsequent months, use the previous month's closing balance
                const prevMonth = monthlyBalances[i - 1];
                openingBalance = parseFloat(prevMonth.closing_balance);
                openingCash = parseFloat(prevMonth.cash_in_hand);
                openingBank = parseFloat(prevMonth.cash_in_bank);
            }
            
            // Recalculate receipts and payments from actual transaction data
            const { receipts, payments, cashInHand, cashInBank } = await this.recalculateMonthTransactions(
                accountId, ledgerHeadId, month, year, transaction
            );
            
            // Calculate new closing balance
            const closingBalance = openingBalance + receipts - payments;
            
            // Update the monthly balance record
            await monthlyBalance.update({
                opening_balance: openingBalance,
                receipts,
                payments,
                closing_balance: closingBalance,
                cash_in_hand: openingCash + cashInHand,
                cash_in_bank: openingBank + cashInBank
            }, { transaction });
            
            console.log(`✅ Updated ${month}/${year}: Opening=${openingBalance}, Receipts=${receipts}, Payments=${payments}, Closing=${closingBalance}`);
        }
        
        console.log(`✅ Completed cascading recalculation for ledger ${ledgerHeadId}`);
    }
    
    /**
     * Recalculate a specific month's transactions totals
     * @param {number} accountId - Account ID
     * @param {number} ledgerHeadId - Ledger head ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {Object} transaction - Sequelize transaction
     * @returns {Object} { receipts, payments, cashInHand, cashInBank }
     */
    async recalculateMonthTransactions(accountId, ledgerHeadId, month, year, transaction) {
        const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        
        const result = await sequelize.query(`
            SELECT
                SUM(CASE WHEN ti.side = '+' THEN ti.amount ELSE 0 END) as receipts,
                SUM(CASE WHEN ti.side = '-' THEN ti.amount ELSE 0 END) as payments,
                SUM(CASE WHEN ti.side = '+' THEN 
                    CASE WHEN t.cash_type = 'cash' THEN ti.amount 
                         WHEN t.cash_type = 'multiple' THEN 
                            (ti.amount / t.amount) * t.cash_amount 
                         ELSE 0 END 
                    WHEN ti.side = '-' THEN 
                        -1 * CASE WHEN t.cash_type = 'cash' THEN ti.amount 
                             WHEN t.cash_type = 'multiple' THEN 
                                (ti.amount / t.amount) * t.cash_amount
                             ELSE 0 END
                    ELSE 0 END) as cash_in_hand,
                SUM(CASE WHEN ti.side = '+' THEN 
                    CASE WHEN t.cash_type = 'cash' THEN 0 
                         WHEN t.cash_type = 'multiple' THEN 
                            (ti.amount / t.amount) * t.bank_amount
                         ELSE ti.amount END 
                    WHEN ti.side = '-' THEN 
                        -1 * CASE WHEN t.cash_type = 'cash' THEN 0 
                             WHEN t.cash_type = 'multiple' THEN 
                                (ti.amount / t.amount) * t.bank_amount
                             ELSE ti.amount END
                    ELSE 0 END) as cash_in_bank
            FROM transaction_items ti
            JOIN transactions t ON ti.transaction_id = t.id
            WHERE ti.ledger_head_id = :ledgerHeadId 
            AND t.account_id = :accountId
            AND t.tx_date BETWEEN :startDate AND :endDate
            AND t.status = 'completed'
        `, {
            replacements: {
                ledgerHeadId,
                accountId,
                startDate,
                endDate
            },
            type: sequelize.QueryTypes.SELECT,
            transaction
        });
        
        const row = result[0];
        return {
            receipts: parseFloat(row?.receipts || 0),
            payments: parseFloat(row?.payments || 0),
            cashInHand: parseFloat(row?.cash_in_hand || 0),
            cashInBank: parseFloat(row?.cash_in_bank || 0)
        };
    }
    
    /**
     * Trigger cascading balance updates when a backdated transaction is processed
     * This is the main entry point called by transaction controllers
     * @param {number} accountId - Account ID
     * @param {number} ledgerHeadId - Ledger head ID
     * @param {string} txDate - Transaction date (YYYY-MM-DD)
     * @param {Object} transaction - Sequelize transaction
     */
    async triggerCascadingUpdate(accountId, ledgerHeadId, txDate, transaction) {
        const txDateObj = new Date(txDate);
        const txMonth = txDateObj.getMonth() + 1;
        const txYear = txDateObj.getFullYear();
        
        console.log(`🔄 Triggering cascading update for transaction in ${txMonth}/${txYear}`);
        
        // Recalculate forward from the transaction's month
        await this.recalculateForwardBalances(accountId, ledgerHeadId, txMonth, txYear, transaction);
        
        // Also update current ledger head balance to ensure it's in sync
        await this.syncLedgerHeadCurrentBalance(ledgerHeadId, transaction);
        
        console.log(`✅ Cascading update completed for ledger ${ledgerHeadId}`);
    }
    
    /**
     * Synchronize ledger head's current balance with latest monthly snapshot
     * @param {number} ledgerHeadId - Ledger head ID
     * @param {Object} transaction - Sequelize transaction
     */
    async syncLedgerHeadCurrentBalance(ledgerHeadId, transaction) {
        // Get the most recent monthly balance record
        const latestBalance = await db.MonthlyLedgerBalance.findOne({
            where: { ledger_head_id: ledgerHeadId },
            order: [['year', 'DESC'], ['month', 'DESC']],
            transaction
        });
        
        if (latestBalance) {
            const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId, { transaction });
            
            await ledgerHead.update({
                current_balance: latestBalance.closing_balance,
                cash_balance: latestBalance.cash_in_hand,
                bank_balance: latestBalance.cash_in_bank
            }, { transaction });
            
            console.log(`Synced ledger head ${ledgerHeadId} current balance: ${latestBalance.closing_balance}`);
        }
    }

    /**
     * Recalculate all balances for a ledger head (used for corrections)
     */
    async recalculateLedgerHeadBalances(ledgerHeadId, transaction) {
        console.log(`Recalculating balances for ledger head ${ledgerHeadId}`);

        // Get all completed transactions for this ledger head
        const transactionItems = await db.TransactionItem.findAll({
            where: { ledger_head_id: ledgerHeadId },
            include: [{
                model: db.Transaction,
                as: 'transaction',
                where: { status: 'completed' },
                attributes: ['id', 'cash_amount', 'bank_amount', 'tx_date']
            }],
            order: [['transaction', 'tx_date'], ['id']],
            transaction
        });

        // Reset ledger head balances
        const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId, { transaction });
        await ledgerHead.update({
            current_balance: 0,
            cash_balance: 0,
            bank_balance: 0
        }, { transaction });

        // Recalculate by processing each transaction in chronological order
        for (const item of transactionItems) {
            const amount = parseFloat(item.amount);
            const cashAmount = parseFloat(item.transaction.cash_amount || 0);
            const bankAmount = parseFloat(item.transaction.bank_amount || 0);
            const operation = item.side;

            await this.updateLedgerHeadBalance(
                ledgerHeadId,
                amount,
                cashAmount,
                bankAmount,
                operation,
                item.transaction.tx_date,
                transaction
            );
        }

        console.log(`Completed recalculation for ledger head ${ledgerHeadId}`);
    }
}

module.exports = new BalanceCalculationService();