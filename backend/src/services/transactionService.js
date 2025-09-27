const db = require('../models');
const sequelize = db.sequelize;
const { Op } = require('sequelize');
const balanceCalculationService = require('./balanceCalculationService');

/**
 * Transaction Service - handles all transaction-related operations
 */
class TransactionService {
    /**
     * Create a credit transaction
     * @param {Object} data - Transaction data
     * @param {number} data.account_id - Account ID
     * @param {number} data.ledger_head_id - Primary ledger head ID
     * @param {number} data.donor_id - Donor ID (optional)
     * @param {number} data.booklet_id - Booklet ID
     * @param {number} data.amount - Total transaction amount
     * @param {string} data.cash_type - Type of payment (cash, bank, etc)
     * @param {string} data.tx_date - Transaction date (YYYY-MM-DD)
     * @param {string} data.description - Transaction description
     * @param {Array} data.splits - Array of split amounts (optional)
     * @returns {Promise<Object>} Created transaction
     */
    async createCredit(data) {
        return await sequelize.transaction(async (t) => {
            // Validate input
            if (!data.booklet_id) {
                throw new Error('Booklet ID is required for credit transactions');
            }

            // Lock the booklet for update
            const booklet = await db.Booklet.findByPk(data.booklet_id, {
                lock: true,
                transaction: t
            });

            if (!booklet) {
                throw new Error('Booklet not found');
            }

            if (!booklet.pages_left || booklet.pages_left.length === 0) {
                throw new Error('Booklet has no pages left');
            }

            // Check if a specific receipt number was requested
            let receiptNo;
            if (data.receipt_no && Number.isInteger(parseInt(data.receipt_no))) {
                receiptNo = parseInt(data.receipt_no);

                // Check if the requested receipt number exists in the booklet's pages_left
                if (!booklet.pages_left.includes(receiptNo)) {
                    console.error(`Requested receipt ${receiptNo} not found in booklet ${data.booklet_id}. Available receipts:`, booklet.pages_left);
                    throw new Error(`Requested receipt number ${receiptNo} is not available in this booklet`);
                }

                // Check if this receipt number is already used in a transaction
                const existingTransaction = await db.Transaction.findOne({
                    where: {
                        booklet_id: booklet.id,
                        receipt_no: receiptNo
                    },
                    transaction: t
                });

                if (existingTransaction) {
                    console.error(`Receipt number ${receiptNo} is already used in transaction ${existingTransaction.id}`);
                    throw new Error(`Receipt number ${receiptNo} is already used in another transaction`);
                }

                console.log(`Using requested receipt number: ${receiptNo}`);
            } else {
                // Fallback to original behavior if no specific receipt requested
                const sortedPages = [...booklet.pages_left].sort((a, b) => a - b);

                // Find the first available receipt number that's not already used in a transaction
                let foundValidReceipt = false;
                for (const page of sortedPages) {
                    const existingTransaction = await db.Transaction.findOne({
                        where: {
                            booklet_id: booklet.id,
                            receipt_no: page
                        },
                        transaction: t
                    });

                    if (!existingTransaction) {
                        receiptNo = page;
                        foundValidReceipt = true;
                        break;
                    } else {
                        console.warn(`Receipt number ${page} is already used in transaction ${existingTransaction.id}, skipping`);
                    }
                }

                if (!foundValidReceipt) {
                    console.error(`No available receipt numbers found for booklet ${booklet.id}`);
                    throw new Error('No available receipt numbers found for this booklet');
                }

                console.log(`No specific receipt requested, using first available: ${receiptNo}`);
            }

            // Remove the used page from pages_left
            const pagesLeft = booklet.pages_left.filter(page => page !== receiptNo);

            // If this was the last receipt, mark the booklet as inactive
            const bookletUpdate = { pages_left: pagesLeft };
            if (pagesLeft.length === 0) {
                console.log(`Closing booklet ${booklet.id} as all pages have been used`);
                bookletUpdate.is_active = false;
            }

            await booklet.update(bookletUpdate, { transaction: t });

            // Log the operation for debugging
            console.log(`Credit transaction created with receipt: ${receiptNo}. Pages left in booklet:`, pagesLeft.length);

            // Calculate proper cash/bank split using the balance calculation service
            const amountSplit = balanceCalculationService.calculateAmountSplit(
                data.cash_type,
                data.amount,
                data.cash_amount,
                data.bank_amount
            );

            if (!amountSplit.isValid) {
                throw new Error(amountSplit.error);
            }

            const cashBalance = amountSplit.cashAmount;
            const bankBalance = amountSplit.bankAmount;

            // Create the transaction with correct cash/bank amounts
            const transaction = await db.Transaction.create({
                account_id: data.account_id,
                ledger_head_id: data.ledger_head_id,
                donor_id: data.donor_id || null,
                booklet_id: data.booklet_id,
                receipt_no: receiptNo,
                amount: data.amount,
                cash_amount: cashBalance,
                bank_amount: bankBalance,
                tx_type: 'credit',
                cash_type: data.cash_type,
                tx_date: data.tx_date,
                description: data.description
            }, { transaction: t });

            // Create transaction items
            if (data.splits && data.splits.length > 0) {
                // Handle split amounts across different ledger heads
                let totalSplitAmount = 0;
                const splitItems = [];

                for (const split of data.splits) {
                    totalSplitAmount += parseFloat(split.amount);
                    splitItems.push({
                        transaction_id: transaction.id,
                        ledger_head_id: split.ledger_head_id,
                        amount: split.amount,
                        side: '+'
                    });

                    // Calculate proportional cash and bank amounts for this split
                    let splitCashAmount = 0;
                    let splitBankAmount = 0;

                    if (data.cash_type === 'multiple') {
                        // Calculate the proportion of this split relative to the total
                        const ratio = parseFloat(split.amount) / parseFloat(data.amount);
                        splitCashAmount = parseFloat(data.cash_amount || 0) * ratio;
                        splitBankAmount = parseFloat(data.bank_amount || 0) * ratio;
                    } else if (data.cash_type === 'cash') {
                        splitCashAmount = parseFloat(split.amount);
                        splitBankAmount = 0;
                    } else {
                        // For bank, cheque, UPI, etc.
                        splitCashAmount = 0;
                        splitBankAmount = parseFloat(split.amount);
                    }

                    // Update the ledger head balance using the new balance calculation service
                    await balanceCalculationService.updateLedgerHeadBalance(
                        split.ledger_head_id,
                        split.amount,
                        splitCashAmount,
                        splitBankAmount,
                        '+',
                        data.tx_date,
                        t
                    );
                }

                // Verify total split amount matches transaction amount
                if (Math.abs(totalSplitAmount - parseFloat(data.amount)) > 0.01) {
                    throw new Error('Sum of split amounts does not match total transaction amount');
                }

                await db.TransactionItem.bulkCreate(splitItems, { transaction: t });
            } else {
                // Single ledger head
                await db.TransactionItem.create({
                    transaction_id: transaction.id,
                    ledger_head_id: data.ledger_head_id,
                    amount: data.amount,
                    side: '+'
                }, { transaction: t });

                // Update the ledger head balance using the new balance calculation service
                await balanceCalculationService.updateLedgerHeadBalance(
                    data.ledger_head_id,
                    data.amount,
                    cashBalance,
                    bankBalance,
                    '+',
                    data.tx_date,
                    t
                );
            }

            // Load transaction with its items
            const loadedTransaction = await db.Transaction.findByPk(transaction.id, {
                include: [
                    { model: db.TransactionItem, as: 'items' },
                    { model: db.LedgerHead, as: 'ledgerHead' }
                ],
                transaction: t
            });

            // Create a cheque record if this is a cheque transaction
            if (data.cash_type === 'cheque') {
                // Validate required cheque fields
                if (!data.cheque_number) {
                    throw new Error('Cheque number is required for cheque transactions');
                }
                if (!data.bank_name) {
                    throw new Error('Bank name is required for cheque transactions');
                }
                if (!data.issue_date) {
                    throw new Error('Issue date is required for cheque transactions');
                }
                if (!data.due_date) {
                    throw new Error('Due date is required for cheque transactions');
                }

                // Validate sufficient bank balance
                const chequeService = require('./chequeService');

                // Find all transaction items where this ledger head is a source (negative side)
                const sourceItems = await db.TransactionItem.findAll({
                    where: {
                        transaction_id: transaction.id,
                        side: '-'
                    },
                    transaction: t
                });

                // Validate each source ledger head has sufficient bank balance
                for (const item of sourceItems) {
                    await chequeService.validateSufficientBankBalance(
                        item.ledger_head_id,
                        item.amount,
                        data.id // Pass transaction ID if we're updating an existing transaction
                    );
                }

                // Create the cheque record
                await db.Cheque.create({
                    tx_id: transaction.id,
                    account_id: data.account_id,
                    ledger_head_id: data.ledger_head_id,
                    cheque_number: data.cheque_number,
                    bank_name: data.bank_name,
                    issue_date: data.issue_date,
                    due_date: data.due_date,
                    status: 'pending',
                    description: data.description
                }, { transaction: t });
            }

            return loadedTransaction;
        });
    }

    /**
     * Create a debit transaction
     * @param {Object} data - Transaction data
     * @param {number} data.account_id - Account ID
     * @param {number} data.ledger_head_id - Target ledger head ID
     * @param {number} data.amount - Total transaction amount
     * @param {string} data.cash_type - Type of payment (cash, bank, etc)
     * @param {string} data.tx_date - Transaction date (YYYY-MM-DD)
     * @param {string} data.description - Transaction description
     * @param {Array} data.sources - Array of source ledger heads and amounts
     * @returns {Promise<Object>} Created transaction
     */
    async createDebit(data) {
        return await sequelize.transaction(async (t) => {
            // Validate sources
            if (!data.sources || !Array.isArray(data.sources) || data.sources.length === 0) {
                throw new Error('At least one source ledger head is required for debit transactions');
            }

            // Verify total source amount matches transaction amount
            const totalSourceAmount = data.sources.reduce((sum, source) => sum + parseFloat(source.amount), 0);
            if (Math.abs(totalSourceAmount - parseFloat(data.amount)) > 0.01) {
                throw new Error('Sum of source amounts does not match total transaction amount');
            }

            // Special validation for cheque transactions
            if (data.is_cheque || data.cash_type === 'cheque') {
                // Validate required cheque fields
                if (!data.cheque_number) {
                    throw new Error('Cheque number is required for cheque transactions');
                }
                if (!data.bank_name) {
                    throw new Error('Bank name is required for cheque transactions');
                }
                if (!data.issue_date) {
                    throw new Error('Issue date is required for cheque transactions');
                }
                if (!data.due_date) {
                    throw new Error('Due date is required for cheque transactions');
                }

                // Ensure the account/cheque_number combination is unique
                const existingCheque = await db.Cheque.findOne({
                    where: {
                        account_id: data.account_id,
                        cheque_number: data.cheque_number
                    },
                    transaction: t
                });

                if (existingCheque) {
                    throw new Error(`Cheque number ${data.cheque_number} already exists for this account`);
                }

                // For cheques, validate available bank balance for each source ledger head
                const chequeService = require('./chequeService');
                for (const source of data.sources) {
                    await chequeService.validateSufficientBankBalance(
                        source.ledger_head_id,
                        source.amount,
                        data.id // Pass transaction ID if we're updating an existing transaction
                    );
                }
            }
            // For non-cheque transactions, check balance as before
            else if (!data.is_cheque) {
                // Check if any source would have negative balance after debit
                for (const source of data.sources) {
                    const ledgerHead = await db.LedgerHead.findByPk(source.ledger_head_id, { transaction: t });
                    if (!ledgerHead) {
                        throw new Error(`Source ledger head ID ${source.ledger_head_id} not found`);
                    }

                    // Check if we're taking from cash or bank
                    let balanceToCheck;
                    let sourceAmount;

                    if (data.cash_type === 'multiple') {
                        // For 'multiple' (both), validate both cash and bank balances separately
                        const cashRatio = parseFloat(data.cash_amount) / parseFloat(data.amount);
                        const bankRatio = parseFloat(data.bank_amount) / parseFloat(data.amount);

                        // Calculate how much of this source will come from cash vs bank
                        const sourceCashAmount = parseFloat(source.amount) * cashRatio;
                        const sourceBankAmount = parseFloat(source.amount) * bankRatio;

                        // Check cash balance
                        if (sourceCashAmount > 0 && parseFloat(ledgerHead.cash_balance) < sourceCashAmount) {
                            throw new Error(`Insufficient cash balance in ledger head: ${ledgerHead.name}`);
                        }

                        // Check bank balance
                        if (sourceBankAmount > 0 && parseFloat(ledgerHead.bank_balance) < sourceBankAmount) {
                            throw new Error(`Insufficient bank balance in ledger head: ${ledgerHead.name}`);
                        }

                        // We've already done the checks, so we can continue to the next source
                        continue;
                    } else if (['cash'].includes(data.cash_type)) {
                        balanceToCheck = parseFloat(ledgerHead.cash_balance);
                        sourceAmount = parseFloat(source.amount);
                    } else {
                        balanceToCheck = parseFloat(ledgerHead.bank_balance);
                        sourceAmount = parseFloat(source.amount);
                    }

                    if (balanceToCheck < sourceAmount) {
                        throw new Error(`Insufficient balance in ledger head: ${ledgerHead.name}`);
                    }
                }
            }

            // Set the actual cash_type to "cheque" if is_cheque is true
            const actualCashType = data.is_cheque ? 'cheque' : data.cash_type;

            // Create the transaction
            const transaction = await db.Transaction.create({
                account_id: data.account_id,
                ledger_head_id: data.ledger_head_id,
                amount: data.amount,
                cash_amount: actualCashType === 'cash' ? data.amount :
                    actualCashType === 'multiple' ? (data.cash_amount || 0) : 0,
                bank_amount: actualCashType === 'bank' || actualCashType === 'cheque' ? data.amount :
                    actualCashType === 'multiple' ? (data.bank_amount || 0) : 0,
                tx_type: 'debit',
                cash_type: actualCashType,
                tx_date: data.tx_date,
                description: data.description,
                status: (data.is_cheque || actualCashType === 'cheque') ? 'pending' : 'completed',
                // Store cheque details directly on transaction for failsafe
                ...(actualCashType === 'cheque' || data.is_cheque ? {
                    cheque_number: data.cheque_number,
                    bank_name: data.bank_name,
                    issue_date: data.issue_date,
                    due_date: data.due_date
                } : {})
            }, { transaction: t });

            // Create transaction items for the target
            await db.TransactionItem.create({
                transaction_id: transaction.id,
                ledger_head_id: data.ledger_head_id,
                amount: data.amount,
                side: '+'
            }, { transaction: t });

            // Create transaction items for the sources
            for (const source of data.sources) {
                await db.TransactionItem.create({
                    transaction_id: transaction.id,
                    ledger_head_id: source.ledger_head_id,
                    amount: source.amount,
                    side: '-'
                }, { transaction: t });
            }

            // Only update balances if this is NOT a cheque transaction
            if (!data.is_cheque && actualCashType !== 'cheque') {
                // Calculate proper cash/bank split for target ledger (debit head)
                const targetAmountSplit = balanceCalculationService.calculateAmountSplit(
                    data.cash_type,
                    data.amount,
                    data.cash_amount,
                    data.bank_amount
                );

                if (!targetAmountSplit.isValid) {
                    throw new Error(targetAmountSplit.error);
                }

                // Update the target ledger head balance (debit head gets credit)
                await balanceCalculationService.updateLedgerHeadBalance(
                    data.ledger_head_id,
                    data.amount,
                    targetAmountSplit.cashAmount,
                    targetAmountSplit.bankAmount,
                    '+',
                    data.tx_date,
                    t
                );

                // Update the source ledger head balances (credit heads get debited)
                for (const source of data.sources) {
                    // Calculate proportional amounts for this source
                    const sourceProportion = parseFloat(source.amount) / parseFloat(data.amount);
                    const sourceCashAmount = targetAmountSplit.cashAmount * sourceProportion;
                    const sourceBankAmount = targetAmountSplit.bankAmount * sourceProportion;

                    await balanceCalculationService.updateLedgerHeadBalance(
                        source.ledger_head_id,
                        source.amount,
                        sourceCashAmount,
                        sourceBankAmount,
                        '-',
                        data.tx_date,
                        t
                    );
                }
            }

            // Create a cheque record if is_cheque is true
            if (data.is_cheque) {
                // Validate required cheque fields
                if (!data.cheque_number) {
                    throw new Error('Cheque number is required for cheque transactions');
                }
                if (!data.bank_name) {
                    throw new Error('Bank name is required for cheque transactions');
                }
                if (!data.issue_date) {
                    throw new Error('Issue date is required for cheque transactions');
                }
                if (!data.due_date) {
                    throw new Error('Due date is required for cheque transactions');
                }

                // Create the cheque record
                await db.Cheque.create({
                    tx_id: transaction.id,
                    account_id: data.account_id,
                    ledger_head_id: data.sources[0].ledger_head_id,
                    cheque_number: data.cheque_number,
                    bank_name: data.bank_name,
                    issue_date: data.issue_date,
                    due_date: data.due_date,
                    status: 'pending',
                    description: data.description
                }, { transaction: t });
            }

            // Load transaction with its items
            return await db.Transaction.findByPk(transaction.id, {
                include: [
                    { model: db.TransactionItem, as: 'items' },
                    { model: db.LedgerHead, as: 'ledgerHead' },
                    { model: db.Cheque, as: 'cheque' }
                ],
                transaction: t
            });
        });
    }

    /**
     * Recalculate a single month's snapshot from raw transaction data
     * @private
     */
    async recalculateSingleMonth(ledgerHeadId, accountId, txDate, transaction) {
        // Parse date to get month and year
        const txDateObj = new Date(txDate);
        const month = txDateObj.getMonth() + 1; // 1-12
        const year = txDateObj.getFullYear();

        // Calculate the start and end date of the month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of the month

        // Format dates for SQL query
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // Find the snapshot for this month
        const snapshot = await db.MonthlyLedgerBalance.findOne({
            where: {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                month,
                year
            },
            transaction
        });

        if (!snapshot) {
            console.log(`No snapshot found for ledger ${ledgerHeadId} in ${month}/${year}, nothing to recalculate`);
            return;
        }

        // Recalculate receipts and payments from raw transaction data
        const sums = await sequelize.query(`
            SELECT
                SUM(CASE WHEN ti.side = '+' THEN ti.amount ELSE 0 END) as receipts,
                SUM(CASE WHEN ti.side = '-' THEN ti.amount ELSE 0 END) as payments,
                SUM(CASE WHEN ti.side = '+' THEN 
                    CASE WHEN t.cash_type = 'cash' THEN ti.amount 
                         WHEN t.cash_type = 'multiple' THEN 
                            (ti.amount / t.amount) * t.cash_amount 
                         ELSE 0 END 
                    ELSE 0 END) as cash_receipts,
                SUM(CASE WHEN ti.side = '-' THEN 
                    CASE WHEN t.cash_type = 'cash' THEN ti.amount 
                         WHEN t.cash_type = 'multiple' THEN 
                            (ti.amount / t.amount) * t.cash_amount
                         ELSE 0 END 
                    ELSE 0 END) as cash_payments,
                SUM(CASE WHEN ti.side = '+' THEN 
                    CASE WHEN t.cash_type = 'cash' THEN 0 
                         WHEN t.cash_type = 'multiple' THEN 
                            (ti.amount / t.amount) * t.bank_amount
                         ELSE ti.amount END 
                    ELSE 0 END) as bank_receipts,
                SUM(CASE WHEN ti.side = '-' THEN 
                    CASE WHEN t.cash_type = 'cash' THEN 0 
                         WHEN t.cash_type = 'multiple' THEN 
                            (ti.amount / t.amount) * t.bank_amount
                         ELSE ti.amount END 
                    ELSE 0 END) as bank_payments
            FROM transaction_items ti
            JOIN transactions t ON ti.transaction_id = t.id
            WHERE ti.ledger_head_id = :ledgerHeadId 
            AND t.tx_date BETWEEN :startDate AND :endDate
            AND t.status = 'completed'
        `, {
            replacements: {
                ledgerHeadId,
                startDate: startDateStr,
                endDate: endDateStr
            },
            type: sequelize.QueryTypes.SELECT,
            transaction
        });

        // Extract the results
        const receipts = sums[0]?.receipts ? parseFloat(sums[0].receipts || 0) : 0;
        const payments = sums[0]?.payments ? parseFloat(sums[0].payments || 0) : 0;
        const cashReceipts = sums[0]?.cash_receipts ? parseFloat(sums[0].cash_receipts || 0) : 0;
        const cashPayments = sums[0]?.cash_payments ? parseFloat(sums[0].cash_payments || 0) : 0;
        const bankReceipts = sums[0]?.bank_receipts ? parseFloat(sums[0].bank_receipts || 0) : 0;
        const bankPayments = sums[0]?.bank_payments ? parseFloat(sums[0].bank_payments || 0) : 0;

        // Calculate net cash and bank
        const netCashInHand = cashReceipts - cashPayments;
        const netCashInBank = bankReceipts - bankPayments;

        // Calculate closing balance
        const openingBalance = parseFloat(snapshot.opening_balance);
        const closingBalance = openingBalance + receipts - payments;

        console.log(`Recalculated snapshot for ${month}/${year} ledger ${ledgerHeadId}:`, {
            receipts,
            payments,
            netCashInHand,
            netCashInBank,
            openingBalance,
            closingBalance
        });

        // Update the snapshot with recalculated values
        await snapshot.update({
            receipts,
            payments,
            closing_balance: closingBalance,
            cash_in_hand: netCashInHand,
            cash_in_bank: netCashInBank
        }, { transaction });

        console.log(`Updated monthly snapshot for ${month}/${year} with recalculated values`);
        return snapshot;
    }

    /**
     * Void (delete) a transaction
     * @param {string} transactionId - Transaction ID to void
     * @returns {Promise<boolean>} Success status
     */
    async voidTransaction(transactionId) {
        return await sequelize.transaction(async (t) => {
            // Find transaction with items
            const transaction = await db.Transaction.findByPk(transactionId, {
                include: [{ model: db.TransactionItem, as: 'items' }],
                transaction: t
            });

            if (!transaction) {
                throw new Error('Transaction not found');
            }

            // If it's a credit transaction and has a booklet, restore the receipt page
            if (transaction.tx_type === 'credit' && transaction.booklet_id && transaction.receipt_no) {
                try {
                    // Get the booklet
                    const booklet = await db.Booklet.findByPk(transaction.booklet_id, {
                        transaction: t
                    });

                    if (booklet) {
                        // Check if BookletPage model exists
                        if (db.BookletPage) {
                            // Restore the receipt page as available
                            await db.BookletPage.update(
                                { status: 'available' },
                                {
                                    where: {
                                        booklet_id: transaction.booklet_id,
                                        page_no: transaction.receipt_no
                                    },
                                    transaction: t
                                }
                            );

                            // Also update the booklet's pages_left count
                            await booklet.update(
                                {
                                    pages_left: booklet.pages_left + 1
                                },
                                { transaction: t }
                            );

                            console.log(`Restored receipt page ${transaction.receipt_no} in booklet ${transaction.booklet_id}`);
                        } else {
                            // If BookletPage model doesn't exist, just update the booklet's pages_left
                            await booklet.update(
                                {
                                    pages_left: booklet.pages_left + 1
                                },
                                { transaction: t }
                            );

                            console.log(`Updated booklet ${transaction.booklet_id} pages count, but BookletPage model not found`);
                        }
                    } else {
                        console.log(`Booklet ${transaction.booklet_id} not found for transaction ${transaction.id}`);
                    }
                } catch (bookletError) {
                    console.error('Error restoring booklet page:', bookletError);
                    // Continue with transaction void even if booklet update fails
                }
            }

            // Track affected ledger heads and their transaction dates
            const affectedLedgers = new Map();

            // Reverse all balance changes
            for (const item of transaction.items) {
                // Calculate proportional cash and bank amounts for this item
                const totalTxAmount = parseFloat(transaction.amount);
                const itemAmount = parseFloat(item.amount);
                const proportion = itemAmount / totalTxAmount;
                
                const totalCashAmount = parseFloat(transaction.cash_amount || 0);
                const totalBankAmount = parseFloat(transaction.bank_amount || 0);
                
                const cashAmount = totalCashAmount * proportion;
                const bankAmount = totalBankAmount * proportion;

                // Flip the side (+ becomes -, - becomes +)
                const reverseSide = item.side === '+' ? '-' : '+';

                console.log(`Voiding item: Ledger ${item.ledger_head_id}, Amount: ₹${itemAmount}, Cash: ₹${cashAmount}, Bank: ₹${bankAmount}, Side: ${item.side} → ${reverseSide}`);

                // Update the ledger head balance in reverse
                await balanceCalculationService.updateLedgerHeadBalance(
                    item.ledger_head_id,
                    itemAmount,
                    cashAmount,
                    bankAmount,
                    reverseSide,
                    transaction.tx_date,
                    t
                );

                // Store affected ledger and transaction date for recalculation
                affectedLedgers.set(item.ledger_head_id, {
                    accountId: transaction.account_id,
                    txDate: transaction.tx_date
                });
            }

            // Delete the transaction and its items (cascade deletion)
            await transaction.destroy({ transaction: t });

            // Recalculate monthly snapshots for all affected ledgers
            for (const [ledgerHeadId, data] of affectedLedgers.entries()) {
                await this.recalculateSingleMonth(
                    ledgerHeadId,
                    data.accountId,
                    data.txDate,
                    t
                );
                console.log(`Recalculated monthly snapshot for ledger ${ledgerHeadId} after voiding transaction`);
            }

            return true;
        });
    }

    /**
     * Update ledger head balance and monthly snapshot
     * @private
     */
    async updateLedgerHeadBalance(ledgerHeadId, amount, cashAmount, bankAmount, side, txDate, transaction) {
        // Find the ledger head
        const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId, {
            lock: true,
            transaction
        });

        if (!ledgerHead) {
            throw new Error(`Ledger head ID ${ledgerHeadId} not found`);
        }

        // Determine if this is a debit or credit ledger head
        const isDebitHead = ledgerHead.head_type === 'debit';

        // Parse date components for the monthly snapshot
        const txDateObj = new Date(txDate);
        const month = txDateObj.getMonth() + 1; // 1-12
        const year = txDateObj.getFullYear();

        // Update ledger head current balance
        let newCurrentBalance = parseFloat(ledgerHead.current_balance || 0);
        let newCashBalance = parseFloat(ledgerHead.cash_balance || 0);
        let newBankBalance = parseFloat(ledgerHead.bank_balance || 0);

        if (side === '+') {
            newCurrentBalance += parseFloat(amount);
            newCashBalance += parseFloat(cashAmount);
            newBankBalance += parseFloat(bankAmount);
        } else {
            newCurrentBalance -= parseFloat(amount);
            newCashBalance -= parseFloat(cashAmount);
            newBankBalance -= parseFloat(bankAmount);
        }

        // Update the ledger head
        await ledgerHead.update({
            current_balance: newCurrentBalance,
            cash_balance: newCashBalance,
            bank_balance: newBankBalance
        }, { transaction });

        // Note: Account balance update is now handled within the balance calculation service

        // Check if a monthly balance record exists for this month
        let monthlyBalance = await db.MonthlyLedgerBalance.findOne({
            where: {
                account_id: ledgerHead.account_id,
                ledger_head_id: ledgerHeadId,
                month,
                year
            },
            transaction
        });

        // If no monthly balance exists, we need to create one
        if (!monthlyBalance) {
            // For debit ledger heads, we only track expenses, not balances
            if (isDebitHead) {
                // Create with zero balances, just track receipts/payments
                monthlyBalance = await db.MonthlyLedgerBalance.create({
                    account_id: ledgerHead.account_id,
                    ledger_head_id: ledgerHeadId,
                    month,
                    year,
                    opening_balance: 0, // Always zero for debit heads
                    receipts: side === '+' ? amount : 0,
                    payments: side === '-' ? amount : 0,
                    closing_balance: 0, // Always zero for debit heads
                    is_open: false,
                    cash_in_hand: 0,
                    cash_in_bank: 0
                }, { transaction });

                console.log(`Created new debit head snapshot for ${ledgerHeadId} with zero balances`);
            } else {
                // For credit heads, determine the opening balance from previous month
                let openingBalance = 0;

                // If not January, check previous month of same year
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
                        ledger_head_id: ledgerHeadId,
                        month: prevMonth,
                        year: prevYear
                    },
                    transaction
                });

                if (prevRecord) {
                    openingBalance = parseFloat(prevRecord.closing_balance);
                    console.log(`Using previous month's closing balance as opening: ${openingBalance}`);
                } else {
                    // If no previous month record, calculate from transactions prior to this month
                    const startDate = new Date(year, month - 1, 1);
                    const startDateStr = startDate.toISOString().split('T')[0];

                    const priorTransactions = await sequelize.query(`
                        SELECT SUM(CASE WHEN ti.side = '+' THEN ti.amount ELSE -ti.amount END) as balance
                        FROM transaction_items ti
                        JOIN transactions t ON ti.transaction_id = t.id
                        WHERE ti.ledger_head_id = :ledgerHeadId 
                        AND t.tx_date < :startDate
                        AND t.status = 'completed'
                    `, {
                        replacements: {
                            ledgerHeadId: ledgerHeadId,
                            startDate: startDateStr
                        },
                        type: sequelize.QueryTypes.SELECT,
                        transaction
                    });

                    if (priorTransactions && priorTransactions[0] && priorTransactions[0].balance !== null) {
                        openingBalance = parseFloat(priorTransactions[0].balance || 0);
                        console.log(`Calculated opening balance from historical transactions: ${openingBalance}`);
                    }
                }

                // Calculate closing balance based on the new transaction
                const closingBalance = openingBalance + (side === '+' ? parseFloat(amount) : -parseFloat(amount));

                // Create the monthly balance record
                monthlyBalance = await db.MonthlyLedgerBalance.create({
                    account_id: ledgerHead.account_id,
                    ledger_head_id: ledgerHeadId,
                    month,
                    year,
                    opening_balance: openingBalance,
                    receipts: side === '+' ? amount : 0,
                    payments: side === '-' ? amount : 0,
                    closing_balance: closingBalance,
                    is_open: false,
                    cash_in_hand: side === '+' ? cashAmount : 0,
                    cash_in_bank: side === '+' ? bankAmount : 0
                }, { transaction });

                console.log(`Created new credit head monthly balance with opening: ${openingBalance}, closing: ${closingBalance}`);
            }
        } else {
            // Update existing monthly balance
            if (isDebitHead) {
                // For debit heads, only update receipts/payments - don't update balances
                const newReceipts = side === '+'
                    ? parseFloat(monthlyBalance.receipts) + parseFloat(amount)
                    : parseFloat(monthlyBalance.receipts);

                const newPayments = side === '-'
                    ? parseFloat(monthlyBalance.payments) + parseFloat(amount)
                    : parseFloat(monthlyBalance.payments);

                await monthlyBalance.update({
                    receipts: newReceipts,
                    payments: newPayments,
                    // Keep balances at zero for debit heads
                    opening_balance: 0,
                    closing_balance: 0
                }, { transaction });

                console.log(`Updated debit head monthly snapshot, receipts: ${newReceipts}, payments: ${newPayments}`);
            } else {
                // For credit heads, update all values including balances
                const newReceipts = side === '+'
                    ? parseFloat(monthlyBalance.receipts) + parseFloat(amount)
                    : parseFloat(monthlyBalance.receipts);

                const newPayments = side === '-'
                    ? parseFloat(monthlyBalance.payments) + parseFloat(amount)
                    : parseFloat(monthlyBalance.payments);

                // Calculate new closing balance
                const newClosingBalance = parseFloat(monthlyBalance.opening_balance) + newReceipts - newPayments;

                // Update cash/bank balances
                let newCashInHand = parseFloat(monthlyBalance.cash_in_hand);
                let newCashInBank = parseFloat(monthlyBalance.cash_in_bank);

                if (side === '+') {
                    newCashInHand += parseFloat(cashAmount);
                    newCashInBank += parseFloat(bankAmount);
                } else {
                    newCashInHand -= parseFloat(cashAmount);
                    newCashInBank -= parseFloat(bankAmount);
                }

                await monthlyBalance.update({
                    receipts: newReceipts,
                    payments: newPayments,
                    closing_balance: newClosingBalance,
                    cash_in_hand: newCashInHand,
                    cash_in_bank: newCashInBank
                }, { transaction });

                console.log(`Updated credit head monthly balance, new closing balance: ${newClosingBalance}`);
            }
        }

        console.log(`Ledger head balance updated: ${ledgerHeadId}, current balance: ${newCurrentBalance}`);
    }


    /**
     * Update account balance when ledger head balances change
     * @private
     */
    async updateAccountBalance(accountId, cashAmount, bankAmount, side, transaction) {
        // Find the account with locking for update
        const account = await db.Account.findByPk(accountId, {
            lock: true,
            transaction
        });

        if (!account) {
            throw new Error(`Account ID ${accountId} not found`);
        }

        // Parse current balances
        let newCashBalance = parseFloat(account.cash_balance || 0);
        let newBankBalance = parseFloat(account.bank_balance || 0);

        // Update balances based on side (+ or -)
        if (side === '+') {
            newCashBalance += parseFloat(cashAmount);
            newBankBalance += parseFloat(bankAmount);
        } else {
            newCashBalance -= parseFloat(cashAmount);
            newBankBalance -= parseFloat(bankAmount);
        }

        // Calculate new closing balance (sum of cash and bank)
        const newClosingBalance = newCashBalance + newBankBalance;

        // Update the account
        await account.update({
            cash_balance: newCashBalance,
            bank_balance: newBankBalance,
            closing_balance: newClosingBalance
        }, { transaction });
    }

    /**
     * Recalculate and synchronize account balances from ledger heads
     * This can be used to fix discrepancies or during system initialization
     */
    async syncAccountBalances() {
        return await sequelize.transaction(async (t) => {
            try {
                // Get all accounts
                const accounts = await db.Account.findAll({
                    transaction: t
                });

                const results = [];

                // For each account, recalculate balances from its ledger heads
                for (const account of accounts) {
                    // Get all ledger heads for this account
                    const ledgerHeads = await db.LedgerHead.findAll({
                        where: { account_id: account.id },
                        transaction: t
                    });

                    // Calculate total cash and bank balances
                    let totalCashBalance = 0;
                    let totalBankBalance = 0;

                    for (const ledgerHead of ledgerHeads) {
                        totalCashBalance += parseFloat(ledgerHead.cash_balance || 0);
                        totalBankBalance += parseFloat(ledgerHead.bank_balance || 0);
                    }

                    // Calculate new closing balance
                    const newClosingBalance = totalCashBalance + totalBankBalance;

                    // Update the account
                    await account.update({
                        cash_balance: totalCashBalance,
                        bank_balance: totalBankBalance,
                        closing_balance: newClosingBalance
                    }, { transaction: t });

                    results.push({
                        accountId: account.id,
                        name: account.name,
                        previousClosingBalance: parseFloat(account.closing_balance),
                        newClosingBalance: newClosingBalance,
                        changed: parseFloat(account.closing_balance) !== newClosingBalance
                    });
                }

                return {
                    success: true,
                    message: `Synchronized balances for ${accounts.length} accounts`,
                    results
                };
            } catch (error) {
                console.error('Error synchronizing account balances:', error);
                throw error;
            }
        });
    }

    /**
     * Get all transactions with pagination
     */
    async getAllTransactions(page = 1, limit = 10, filters = {}) {
        const offset = (page - 1) * limit;
        const where = {};

        // Apply filters if provided
        if (filters.account_id) where.account_id = filters.account_id;
        if (filters.ledger_head_id) where.ledger_head_id = filters.ledger_head_id;
        if (filters.donor_id) where.donor_id = filters.donor_id;

        // Date range filter
        if (filters.start_date && filters.end_date) {
            where.transaction_date = {
                [Op.between]: [filters.start_date, filters.end_date]
            };
        } else if (filters.start_date) {
            where.transaction_date = { [Op.gte]: filters.start_date };
        } else if (filters.end_date) {
            where.transaction_date = { [Op.lte]: filters.end_date };
        }

        console.log('Transaction filter query:', JSON.stringify(where, null, 2));

        // Get ALL transaction log entries (not filtering by log_sequence)
        const allLogEntries = await db.TransactionLog.findAll({
            where: where,
            include: [
                { model: db.LedgerHead, as: 'ledgerHead' },
                { model: db.Account, as: 'account' },
                { model: db.Donor, as: 'donor' },
                { model: db.Booklet, as: 'booklet' }
            ],
            order: [['transaction_date', 'DESC'], ['created_at', 'DESC']]
        });

        // Group by transaction_uuid to identify double-entry vs single-entry transactions
        const transactionGroups = {};
        allLogEntries.forEach(entry => {
            const uuid = entry.transaction_uuid;
            if (!transactionGroups[uuid]) {
                transactionGroups[uuid] = [];
            }
            transactionGroups[uuid].push(entry);
        });

        // Process each transaction group and decide what to show
        const businessTransactions = [];
        for (const [uuid, logEntries] of Object.entries(transactionGroups)) {
            if (logEntries.length === 1) {
                // Single entry = Credit transaction (money coming in)
                const entry = logEntries[0];
                businessTransactions.push({
                    id: entry.transaction_uuid,
                    account_id: entry.account_id,
                    ledger_head_id: entry.ledger_head_id,
                    donor_id: entry.donor_id,
                    booklet_id: entry.booklet_id,
                    receipt_no: entry.receipt_number,
                    amount: entry.amount,
                    cash_amount: entry.cash_amount,
                    bank_amount: entry.bank_amount,
                    tx_type: 'credit',
                    cash_type: entry.cash_type,
                    tx_date: entry.transaction_date,
                    description: entry.description,
                    status: 'completed',
                    created_at: entry.created_at,
                    updated_at: entry.created_at,
                    ledgerHead: entry.ledgerHead,
                    account: entry.account,
                    donor: entry.donor,
                    booklet: entry.booklet
                });
            } else if (logEntries.length === 2) {
                // Double entry = Debit transaction (money going out)
                // Show ONLY the debit head entry (what money is spent ON)
                const debitHeadEntry = logEntries.find(entry =>
                    entry.ledgerHead && entry.ledgerHead.head_type === 'debit'
                );

                const creditHeadEntry = logEntries.find(entry =>
                    entry.ledgerHead && entry.ledgerHead.head_type === 'credit'
                );

                if (debitHeadEntry && creditHeadEntry) {
                    // Clean up the description by removing the "Transfer to:/from:" prefix
                    let cleanDescription = debitHeadEntry.description.replace(/^Transfer (to|from):[^-]*-\s*/, '');

                    businessTransactions.push({
                        id: debitHeadEntry.transaction_uuid,
                        account_id: debitHeadEntry.account_id,
                        ledger_head_id: debitHeadEntry.ledger_head_id,
                        donor_id: debitHeadEntry.donor_id,
                        booklet_id: debitHeadEntry.booklet_id,
                        receipt_no: debitHeadEntry.receipt_number,
                        amount: debitHeadEntry.amount,
                        cash_amount: debitHeadEntry.cash_amount,
                        bank_amount: debitHeadEntry.bank_amount,
                        tx_type: 'debit',
                        cash_type: debitHeadEntry.cash_type,
                        tx_date: debitHeadEntry.transaction_date,
                        description: cleanDescription,
                        status: 'completed',
                        created_at: debitHeadEntry.created_at,
                        updated_at: debitHeadEntry.created_at,
                        ledgerHead: debitHeadEntry.ledgerHead,
                        account: debitHeadEntry.account,
                        donor: debitHeadEntry.donor,
                        booklet: debitHeadEntry.booklet,
                        // Add source information for context
                        sourceHead: creditHeadEntry.ledgerHead
                    });
                }
            }
        }

        // Apply tx_type filter after grouping
        let filteredTransactions = businessTransactions;
        if (filters.tx_type) {
            filteredTransactions = businessTransactions.filter(tx => tx.tx_type === filters.tx_type);
        }

        // Sort by date
        filteredTransactions.sort((a, b) => new Date(b.tx_date) - new Date(a.tx_date));

        // Apply pagination
        const paginatedTransactions = filteredTransactions.slice(offset, offset + limit);

        const totalCount = filteredTransactions.length;

        return {
            total: totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit),
            transactions: paginatedTransactions,
            pendingCount: 0, // No pending transactions in log-based system
            pendingTotal: 0,
            cancelledCount: 0, // No cancelled transactions in log-based system
            cancelledTotal: 0,
            pendingDebitCount: 0,
            pendingCreditCount: 0,
            cancelledDebitCount: 0,
            cancelledCreditCount: 0
        };
    }

    /**
     * Get transaction by ID
     */
    async getTransactionById(id) {
        return await db.Transaction.findByPk(id, {
            include: [
                { model: db.TransactionItem, as: 'items', include: [{ model: db.LedgerHead, as: 'ledgerHead' }] },
                { model: db.Donor, as: 'donor' },
                { model: db.Booklet, as: 'booklet' },
                { model: db.LedgerHead, as: 'ledgerHead' },
                { model: db.Account, as: 'account' },
                { model: db.Cheque, as: 'cheque' }
            ]
        });
    }
}

module.exports = new TransactionService(); 