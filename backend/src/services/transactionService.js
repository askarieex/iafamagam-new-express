const db = require('../models');
const sequelize = db.sequelize;
const { Op } = require('sequelize');

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

            // Prepare ledger head update data
            let cashBalance = 0;
            let bankBalance = 0;

            // Determine which balance to update based on cash_type
            if (data.cash_type === 'cash') {
                cashBalance = parseFloat(data.amount);
            } else if (data.cash_type === 'bank') {
                bankBalance = parseFloat(data.amount);
            } else if (data.cash_type === 'multiple') {
                // For 'multiple', use the separate cash and bank amounts
                cashBalance = parseFloat(data.cash_amount || 0);
                bankBalance = parseFloat(data.bank_amount || 0);

                // Verify that the sum matches the total amount
                if (Math.abs((cashBalance + bankBalance) - parseFloat(data.amount)) > 0.01) {
                    throw new Error('Sum of cash and bank amounts does not match total transaction amount');
                }
            } else {
                // For other payment types (upi, card, etc.), treat as bank
                bankBalance = parseFloat(data.amount);
            }

            // Create the transaction
            const transaction = await db.Transaction.create({
                account_id: data.account_id,
                ledger_head_id: data.ledger_head_id,
                donor_id: data.donor_id || null,
                booklet_id: data.booklet_id,
                receipt_no: receiptNo,
                amount: data.amount,
                cash_amount: data.cash_type === 'cash' ? data.amount :
                    data.cash_type === 'multiple' ? (data.cash_amount || 0) : 0,
                bank_amount: data.cash_type === 'bank' ? data.amount :
                    data.cash_type === 'multiple' ? (data.bank_amount || 0) : 0,
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

                    // Update the ledger head balance with properly proportioned cash/bank amounts
                    await this.updateLedgerHeadBalance(
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

                // Update the ledger head balance
                await this.updateLedgerHeadBalance(
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
                // Update the target ledger head balance
                let cashBalanceTarget, bankBalanceTarget;

                if (data.cash_type === 'multiple') {
                    cashBalanceTarget = parseFloat(data.cash_amount || 0);
                    bankBalanceTarget = parseFloat(data.bank_amount || 0);
                } else {
                    cashBalanceTarget = ['cash'].includes(data.cash_type) ? parseFloat(data.amount) : 0;
                    bankBalanceTarget = ['cash'].includes(data.cash_type) ? 0 : parseFloat(data.amount);
                }

                await this.updateLedgerHeadBalance(
                    data.ledger_head_id,
                    data.amount,
                    cashBalanceTarget,
                    bankBalanceTarget,
                    '+',
                    data.tx_date,
                    t
                );

                // Update the source ledger head balances
                for (const source of data.sources) {
                    let cashBalanceSource, bankBalanceSource;

                    if (data.cash_type === 'multiple') {
                        // Calculate the proper proportion for cash and bank
                        const cashRatio = parseFloat(data.cash_amount) / parseFloat(data.amount);
                        const bankRatio = parseFloat(data.bank_amount) / parseFloat(data.amount);

                        cashBalanceSource = parseFloat(source.amount) * cashRatio;
                        bankBalanceSource = parseFloat(source.amount) * bankRatio;
                    } else {
                        cashBalanceSource = ['cash'].includes(data.cash_type) ? parseFloat(source.amount) : 0;
                        bankBalanceSource = ['cash'].includes(data.cash_type) ? 0 : parseFloat(source.amount);
                    }

                    await this.updateLedgerHeadBalance(
                        source.ledger_head_id,
                        source.amount,
                        cashBalanceSource,
                        bankBalanceSource,
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
                // Determine if this was a cash or bank transaction
                const isBank = !['cash'].includes(transaction.cash_type);
                const cashAmount = isBank ? 0 : parseFloat(item.amount);
                const bankAmount = isBank ? parseFloat(item.amount) : 0;

                // Flip the side (+ becomes -, - becomes +)
                const reverseSide = item.side === '+' ? '-' : '+';

                // Update the ledger head balance in reverse
                await this.updateLedgerHeadBalance(
                    item.ledger_head_id,
                    item.amount,
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

        // Parse date components for the monthly snapshot
        const txDateObj = new Date(txDate);
        const month = txDateObj.getMonth() + 1; // 1-12
        const year = txDateObj.getFullYear();

        // Update ledger head current balance
        let newCurrentBalance = parseFloat(ledgerHead.current_balance);
        let newCashBalance = parseFloat(ledgerHead.cash_balance);
        let newBankBalance = parseFloat(ledgerHead.bank_balance);

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

        // Find and update the associated account
        await this.updateAccountBalance(ledgerHead.account_id, cashAmount, bankAmount, side, transaction);

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

        // If no monthly balance exists, we need to create one with proper opening balance
        if (!monthlyBalance) {
            // First, determine the opening balance from the previous month
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

            // Create the monthly balance with correct opening balance - use try/catch for race condition protection
            try {
                monthlyBalance = await db.MonthlyLedgerBalance.create({
                    account_id: ledgerHead.account_id,
                    ledger_head_id: ledgerHeadId,
                    month,
                    year,
                    opening_balance: openingBalance,
                    receipts: side === '+' ? parseFloat(amount) : 0,
                    payments: side === '-' ? parseFloat(amount) : 0,
                    closing_balance: openingBalance + (side === '+' ? parseFloat(amount) : -parseFloat(amount)),
                    cash_in_hand: side === '+' ? parseFloat(cashAmount) : -parseFloat(cashAmount),
                    cash_in_bank: side === '+' ? parseFloat(bankAmount) : -parseFloat(bankAmount)
                }, { transaction });

                console.log(`Created new monthly balance for ${month}/${year} with opening ${openingBalance}`);
            } catch (error) {
                // Handle race condition - if another process created this record concurrently
                if (error.name === 'SequelizeUniqueConstraintError') {
                    console.log(`Monthly balance for ${month}/${year} already exists, retrieving...`);
                    monthlyBalance = await db.MonthlyLedgerBalance.findOne({
                        where: {
                            account_id: ledgerHead.account_id,
                            ledger_head_id: ledgerHeadId,
                            month,
                            year
                        },
                        transaction
                    });
                } else {
                    throw error;
                }
            }
        } else {
            // Update monthly balance receipts/payments and closing
            let newReceipts = parseFloat(monthlyBalance.receipts);
            let newPayments = parseFloat(monthlyBalance.payments);
            let newCashInHand = parseFloat(monthlyBalance.cash_in_hand);
            let newCashInBank = parseFloat(monthlyBalance.cash_in_bank);

            if (side === '+') {
                newReceipts += parseFloat(amount);
                newCashInHand += parseFloat(cashAmount);
                newCashInBank += parseFloat(bankAmount);
            } else {
                newPayments += parseFloat(amount);
                newCashInHand -= parseFloat(cashAmount);
                newCashInBank -= parseFloat(bankAmount);
            }

            const openingBalance = parseFloat(monthlyBalance.opening_balance);
            const newClosingBalance = openingBalance + newReceipts - newPayments;

            // Update the monthly snapshot
            await monthlyBalance.update({
                receipts: newReceipts,
                payments: newPayments,
                closing_balance: newClosingBalance,
                cash_in_hand: newCashInHand,
                cash_in_bank: newCashInBank
            }, { transaction });

            console.log(`Updated monthly balance for ${month}/${year}: opening=${openingBalance}, receipts=${newReceipts}, payments=${newPayments}, closing=${newClosingBalance}`);
        }

        // Check if this transaction is backdated (earlier than the current open period)
        // If so, recalculate all subsequent monthly snapshots
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        // Transaction is backdated if its year is less than current year,
        // or if it's the same year but an earlier month
        const isBackdated = (year < currentYear) || (year === currentYear && month < currentMonth);

        if (isBackdated) {
            try {
                console.log(`Transaction is backdated (${month}/${year}), recalculating subsequent monthly snapshots`);
                const BalanceCalculator = require('../utils/balanceCalculator');

                // Get the account details for logging
                const account = await db.Account.findByPk(ledgerHead.account_id, {
                    transaction,
                    attributes: ['name']
                });

                const ledgerHeadDetails = await db.LedgerHead.findByPk(ledgerHeadId, {
                    transaction,
                    attributes: ['name']
                });

                console.log(`Recalculating balances for account ${account ? account.name : ledgerHead.account_id}, ledger head ${ledgerHeadDetails ? ledgerHeadDetails.name : ledgerHeadId}`);

                // Recalculate from the first day of the transaction month
                const recalcResult = await BalanceCalculator.recalculateMonthlySnapshots(
                    ledgerHead.account_id,
                    ledgerHeadId,
                    new Date(txDateObj.getFullYear(), txDateObj.getMonth(), 1),
                    transaction
                );

                console.log(`Balance recalculation complete. Delta: ${recalcResult.delta}, Affected months: ${recalcResult.recalculatedMonths}`);

                // Once recalculation is complete, make sure all periods except the current one are marked as closed
                // This ensures only the current period remains open after backdated changes
                if (recalcResult.recalculatedMonths > 0) {
                    try {
                        await this.ensureOnlyCurrentPeriodOpen(ledgerHead.account_id, transaction, true);
                    } catch (periodLockError) {
                        console.error('Error ensuring only current period is open:', periodLockError);
                        // Continue with the transaction - this is not critical enough to fail the whole process
                    }
                }
            } catch (recalcError) {
                console.error('Error during balance recalculation:', recalcError);
                // Log the error but don't block the transaction - the base transaction should still go through
                // We can fix any inconsistencies later with the reconciliation job
            }
        }
    }

    /**
     * Ensure that only one accounting period is marked as open
     * @param {number} accountId - The account ID
     * @param {Transaction} transaction - Sequelize transaction
     * @param {boolean} [preserveUserOpenPeriod=true] - Whether to preserve the user's manually opened period
     * @returns {Promise<void>}
     */
    async ensureOnlyCurrentPeriodOpen(accountId, transaction, preserveUserOpenPeriod = true) {
        // Get the current date for default calculation
        const currentDate = new Date();
        const calendarMonth = currentDate.getMonth() + 1;
        const calendarYear = currentDate.getFullYear();

        // If we need to preserve the user's open period, find it first
        let targetMonth = calendarMonth;
        let targetYear = calendarYear;

        if (preserveUserOpenPeriod) {
            try {
                // Find the currently open period for this account
                const openPeriod = await db.MonthlyLedgerBalance.findOne({
                    where: {
                        account_id: accountId,
                        is_open: true
                    },
                    order: [['year', 'DESC'], ['month', 'DESC']],
                    transaction
                });

                // If found, use this period instead of the calendar period
                if (openPeriod) {
                    targetMonth = openPeriod.month;
                    targetYear = openPeriod.year;
                    console.log(`Found user's open period: ${targetMonth}/${targetYear}, will preserve it`);
                }
            } catch (error) {
                console.error('Error finding user open period:', error);
                // Fall back to calendar month/year
            }
        }

        console.log(`Ensuring only period ${targetMonth}/${targetYear} is open for account ${accountId}`);

        try {
            // First, close ALL periods for this account to avoid constraint violations
            await db.MonthlyLedgerBalance.update(
                { is_open: false },
                {
                    where: {
                        account_id: accountId,
                        is_open: true
                    },
                    transaction
                }
            );

            // Now, find the target period for the first ledger head
            const targetPeriod = await db.MonthlyLedgerBalance.findOne({
                where: {
                    account_id: accountId,
                    month: targetMonth,
                    year: targetYear,
                    ledger_head_id: {
                        [Op.in]: sequelize.literal(`(SELECT id FROM ledger_heads WHERE account_id = ${accountId} ORDER BY id LIMIT 1)`)
                    }
                },
                transaction
            });

            // If we found the target period, open it
            if (targetPeriod) {
                await targetPeriod.update({ is_open: true }, { transaction });
                console.log(`Opened period ${targetMonth}/${targetYear} for account ${accountId}`);
            } else {
                // This means the period doesn't exist yet for the ledger head
                console.log(`Target period ${targetMonth}/${targetYear} not found for account ${accountId}`);

                // Get the first ledger head for the account
                const firstLedgerHead = await db.LedgerHead.findOne({
                    where: { account_id: accountId },
                    order: [['id', 'ASC']],
                    transaction
                });

                if (!firstLedgerHead) {
                    throw new Error(`No ledger heads found for account ${accountId}`);
                }

                // Create the period and set it as open
                await db.MonthlyLedgerBalance.create({
                    account_id: accountId,
                    ledger_head_id: firstLedgerHead.id,
                    month: targetMonth,
                    year: targetYear,
                    opening_balance: 0,
                    receipts: 0,
                    payments: 0,
                    closing_balance: 0,
                    cash_in_hand: 0,
                    cash_in_bank: 0,
                    is_open: true
                }, { transaction });

                console.log(`Created and opened new period ${targetMonth}/${targetYear} for account ${accountId}`);
            }
        } catch (error) {
            console.error(`Error ensuring period ${targetMonth}/${targetYear} is open for account ${accountId}:`, error);
            throw error;
        }

        console.log(`Period locking complete for account ${accountId}, keeping ${targetMonth}/${targetYear} open`);
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
        let newCashBalance = parseFloat(account.cash_balance);
        let newBankBalance = parseFloat(account.bank_balance);

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
                        totalCashBalance += parseFloat(ledgerHead.cash_balance);
                        totalBankBalance += parseFloat(ledgerHead.bank_balance);
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
        if (filters.tx_type) where.tx_type = filters.tx_type;

        // Handle status and cash_type together for proper tab filtering
        if (filters.status) {
            // For pending tab - ONLY show pending cheques
            if (filters.status === 'pending') {
                where.status = 'pending';
                where.cash_type = 'cheque';
            }
            // For cancelled tab - ONLY show cancelled cheques
            else if (filters.status === 'cancelled') {
                where.status = 'cancelled';
                where.cash_type = 'cheque';
            }
            // For completed tab - show completed transactions OR cleared cheques
            else if (filters.status === 'completed') {
                where[Op.or] = [
                    // Regular transactions
                    {
                        [Op.and]: [
                            { status: 'completed' },
                            { cash_type: { [Op.ne]: 'cheque' } }
                        ]
                    },
                    // Cleared cheques
                    {
                        [Op.and]: [
                            { status: 'completed' },
                            { cash_type: 'cheque' }
                        ]
                    }
                ];
            } else {
                where.status = filters.status;
            }
        }

        // If separate cash_type filter provided (and not in a status-specific tab)
        if (filters.cash_type && !filters.status) {
            where.cash_type = filters.cash_type;
        }

        // Date range filter
        if (filters.start_date && filters.end_date) {
            where.tx_date = {
                [Op.between]: [filters.start_date, filters.end_date]
            };
        } else if (filters.start_date) {
            where.tx_date = { [Op.gte]: filters.start_date };
        } else if (filters.end_date) {
            where.tx_date = { [Op.lte]: filters.end_date };
        }

        console.log('Transaction filter query:', JSON.stringify(where, null, 2));

        // Get transactions with count
        const { count, rows } = await db.Transaction.findAndCountAll({
            where,
            include: [
                { model: db.TransactionItem, as: 'items' },
                { model: db.Donor, as: 'donor' },
                { model: db.Booklet, as: 'booklet' },
                { model: db.LedgerHead, as: 'ledgerHead' },
                { model: db.Account, as: 'account' },
                { model: db.Cheque, as: 'cheque' }
            ],
            order: [['tx_date', 'DESC'], ['created_at', 'DESC']],
            limit,
            offset
        });

        // COUNTS FOR THE TAB HEADERS
        // These should be consistently calculated regardless of current tab

        // Pending cheques: cash_type=cheque, status=pending
        const pendingChequesWhere = {
            cash_type: 'cheque',
            status: 'pending'
        };

        // Cancelled cheques: cash_type=cheque, status=cancelled
        const cancelledChequesWhere = {
            cash_type: 'cheque',
            status: 'cancelled'
        };

        // Apply common filters to these queries too
        if (filters.account_id) {
            pendingChequesWhere.account_id = filters.account_id;
            cancelledChequesWhere.account_id = filters.account_id;
        }

        if (filters.ledger_head_id) {
            pendingChequesWhere.ledger_head_id = filters.ledger_head_id;
            cancelledChequesWhere.ledger_head_id = filters.ledger_head_id;
        }

        if (filters.tx_type) {
            pendingChequesWhere.tx_type = filters.tx_type;
            cancelledChequesWhere.tx_type = filters.tx_type;
        }

        if (filters.start_date && filters.end_date) {
            pendingChequesWhere.tx_date = { [Op.between]: [filters.start_date, filters.end_date] };
            cancelledChequesWhere.tx_date = { [Op.between]: [filters.start_date, filters.end_date] };
        } else if (filters.start_date) {
            pendingChequesWhere.tx_date = { [Op.gte]: filters.start_date };
            cancelledChequesWhere.tx_date = { [Op.gte]: filters.start_date };
        } else if (filters.end_date) {
            pendingChequesWhere.tx_date = { [Op.lte]: filters.end_date };
            cancelledChequesWhere.tx_date = { [Op.lte]: filters.end_date };
        }

        // Get pending cheques count and sum
        const pendingCheques = await db.Transaction.findAll({
            where: pendingChequesWhere,
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
                ['tx_type', 'type']
            ],
            group: ['tx_type'],
            raw: true
        });

        // Get cancelled cheques count and sum
        const cancelledCheques = await db.Transaction.findAll({
            where: cancelledChequesWhere,
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
                ['tx_type', 'type']
            ],
            group: ['tx_type'],
            raw: true
        });

        // Calculate total pending statistics
        let pendingCount = 0;
        let pendingTotal = 0;
        let pendingDebitCount = 0;
        let pendingCreditCount = 0;

        pendingCheques.forEach(group => {
            pendingCount += parseInt(group.count) || 0;
            pendingTotal += parseFloat(group.total) || 0;

            if (group.type === 'debit') {
                pendingDebitCount += parseInt(group.count) || 0;
            } else if (group.type === 'credit') {
                pendingCreditCount += parseInt(group.count) || 0;
            }
        });

        // Calculate total cancelled statistics
        let cancelledCount = 0;
        let cancelledTotal = 0;
        let cancelledDebitCount = 0;
        let cancelledCreditCount = 0;

        cancelledCheques.forEach(group => {
            cancelledCount += parseInt(group.count) || 0;
            cancelledTotal += parseFloat(group.total) || 0;

            if (group.type === 'debit') {
                cancelledDebitCount += parseInt(group.count) || 0;
            } else if (group.type === 'credit') {
                cancelledCreditCount += parseInt(group.count) || 0;
            }
        });

        return {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
            transactions: rows,
            pendingCount,
            pendingTotal,
            cancelledCount,
            cancelledTotal,
            pendingDebitCount,
            pendingCreditCount,
            cancelledDebitCount,
            cancelledCreditCount
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