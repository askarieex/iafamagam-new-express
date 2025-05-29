const { Op } = require('sequelize');
const db = require('../models');
const { sequelize } = db;

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

                    // Update the ledger head balance
                    await this.updateLedgerHeadBalance(
                        split.ledger_head_id,
                        split.amount,
                        data.cash_type === 'cash' ? split.amount : 0,
                        data.cash_type !== 'cash' ? split.amount : 0,
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
            return await db.Transaction.findByPk(transaction.id, {
                include: [
                    { model: db.TransactionItem, as: 'items' },
                    { model: db.Donor, as: 'donor' },
                    { model: db.Booklet, as: 'booklet' },
                    { model: db.LedgerHead, as: 'ledgerHead' }
                ],
                transaction: t
            });
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

            // Check if any source would have negative balance after debit
            for (const source of data.sources) {
                const ledgerHead = await db.LedgerHead.findByPk(source.ledger_head_id, { transaction: t });
                if (!ledgerHead) {
                    throw new Error(`Source ledger head ID ${source.ledger_head_id} not found`);
                }

                // Check if we're taking from cash or bank
                let balanceToCheck;
                if (['cash'].includes(data.cash_type)) {
                    balanceToCheck = parseFloat(ledgerHead.cash_balance);
                } else {
                    balanceToCheck = parseFloat(ledgerHead.bank_balance);
                }

                if (balanceToCheck < parseFloat(source.amount)) {
                    throw new Error(`Insufficient balance in ledger head: ${ledgerHead.name}`);
                }
            }

            // Create the transaction
            const transaction = await db.Transaction.create({
                account_id: data.account_id,
                ledger_head_id: data.ledger_head_id,
                amount: data.amount,
                cash_amount: data.cash_type === 'cash' ? data.amount :
                    data.cash_type === 'multiple' ? (data.cash_amount || 0) : 0,
                bank_amount: data.cash_type === 'bank' ? data.amount :
                    data.cash_type === 'multiple' ? (data.bank_amount || 0) : 0,
                tx_type: 'debit',
                cash_type: data.cash_type,
                tx_date: data.tx_date,
                description: data.description
            }, { transaction: t });

            // Create transaction items for the target
            await db.TransactionItem.create({
                transaction_id: transaction.id,
                ledger_head_id: data.ledger_head_id,
                amount: data.amount,
                side: '+'
            }, { transaction: t });

            // Update the target ledger head balance
            const cashBalanceTarget = ['cash'].includes(data.cash_type) ? parseFloat(data.amount) : 0;
            const bankBalanceTarget = ['cash'].includes(data.cash_type) ? 0 : parseFloat(data.amount);

            await this.updateLedgerHeadBalance(
                data.ledger_head_id,
                data.amount,
                cashBalanceTarget,
                bankBalanceTarget,
                '+',
                data.tx_date,
                t
            );

            // Create transaction items for the sources
            for (const source of data.sources) {
                await db.TransactionItem.create({
                    transaction_id: transaction.id,
                    ledger_head_id: source.ledger_head_id,
                    amount: source.amount,
                    side: '-'
                }, { transaction: t });

                // Update the source ledger head balance
                const cashBalanceSource = ['cash'].includes(data.cash_type) ? parseFloat(source.amount) : 0;
                const bankBalanceSource = ['cash'].includes(data.cash_type) ? 0 : parseFloat(source.amount);

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

            // Load transaction with its items
            return await db.Transaction.findByPk(transaction.id, {
                include: [
                    { model: db.TransactionItem, as: 'items' },
                    { model: db.LedgerHead, as: 'ledgerHead' }
                ],
                transaction: t
            });
        });
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
                const booklet = await db.Booklet.findByPk(transaction.booklet_id, {
                    transaction: t
                });

                if (booklet) {
                    // Check if there are any other transactions with this booklet and receipt number
                    const duplicateTransactions = await db.Transaction.count({
                        where: {
                            booklet_id: transaction.booklet_id,
                            receipt_no: transaction.receipt_no,
                            id: { [Op.ne]: transactionId } // Exclude the current transaction
                        },
                        transaction: t
                    });

                    if (duplicateTransactions > 0) {
                        console.warn(`Receipt number ${transaction.receipt_no} is used by other transactions, not adding back to booklet ${transaction.booklet_id}`);
                    } else {
                        // Only add the receipt number back if it's not used by other transactions
                        console.log(`Restoring receipt number ${transaction.receipt_no} to booklet ${transaction.booklet_id}`);
                        const pagesLeft = [...booklet.pages_left, transaction.receipt_no];

                        // Sort the pages_left array numerically to maintain proper order
                        pagesLeft.sort((a, b) => parseInt(a) - parseInt(b));

                        // Update the booklet with the restored receipt number
                        await booklet.update({
                            pages_left: pagesLeft,
                            is_active: true // Also reactivate the booklet if it was closed
                        }, { transaction: t });
                    }
                }
            }

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
            }

            // Delete the transaction and its items (cascade deletion)
            await transaction.destroy({ transaction: t });

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

        // Update monthly ledger balance
        const [monthlyBalance, created] = await db.MonthlyLedgerBalance.findOrCreate({
            where: {
                account_id: ledgerHead.account_id,
                ledger_head_id: ledgerHeadId,
                month,
                year
            },
            defaults: {
                account_id: ledgerHead.account_id,
                ledger_head_id: ledgerHeadId,
                month,
                year,
                opening_balance: 0,
                receipts: 0,
                payments: 0,
                closing_balance: 0,
                cash_in_hand: 0,
                cash_in_bank: 0
            },
            transaction
        });

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

        const newClosingBalance = parseFloat(monthlyBalance.opening_balance) + newReceipts - newPayments;

        // Update the monthly snapshot
        await monthlyBalance.update({
            receipts: newReceipts,
            payments: newPayments,
            closing_balance: newClosingBalance,
            cash_in_hand: newCashInHand,
            cash_in_bank: newCashInBank
        }, { transaction });
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
        if (filters.cash_type) where.cash_type = filters.cash_type;

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

        // Get transactions with count
        const { count, rows } = await db.Transaction.findAndCountAll({
            where,
            include: [
                { model: db.TransactionItem, as: 'items' },
                { model: db.Donor, as: 'donor' },
                { model: db.Booklet, as: 'booklet' },
                { model: db.LedgerHead, as: 'ledgerHead' },
                { model: db.Account, as: 'account' }
            ],
            order: [['tx_date', 'DESC'], ['created_at', 'DESC']],
            limit,
            offset
        });

        return {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
            transactions: rows
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
                { model: db.Account, as: 'account' }
            ]
        });
    }

    /**
     * Update an existing transaction
     * @param {number} id - Transaction ID
     * @param {Object} data - Updated transaction data
     * @returns {Promise<Object>} Updated transaction
     */
    async updateTransaction(id, data) {
        return await sequelize.transaction(async (t) => {
            // Find existing transaction with items
            const existingTransaction = await db.Transaction.findByPk(id, {
                include: [{ model: db.TransactionItem, as: 'items' }],
                transaction: t
            });

            if (!existingTransaction) {
                throw new Error('Transaction not found');
            }

            // Handle receipt number changes for credit transactions
            if (existingTransaction.tx_type === 'credit') {
                let receiptChange = false;
                let oldBookletId = existingTransaction.booklet_id;
                let oldReceiptNo = existingTransaction.receipt_no;
                let newBookletId = data.booklet_id;
                let newReceiptNo = data.receipt_no ? parseInt(data.receipt_no) : null;

                // Check if receipt or booklet has changed
                if (newBookletId !== oldBookletId || (newReceiptNo && newReceiptNo !== oldReceiptNo)) {
                    receiptChange = true;

                    // If changing to a new booklet or receipt, ensure it's available
                    if (newBookletId && newReceiptNo) {
                        // Lock the new booklet for update
                        const newBooklet = await db.Booklet.findByPk(newBookletId, {
                            lock: true,
                            transaction: t
                        });

                        if (!newBooklet) {
                            throw new Error('New booklet not found');
                        }

                        // Check if the receipt exists in the new booklet
                        if (!newBooklet.pages_left.includes(newReceiptNo)) {
                            throw new Error(`Receipt number ${newReceiptNo} is not available in this booklet`);
                        }

                        // Check if this receipt is already used in another transaction
                        const existingReceiptTransaction = await db.Transaction.findOne({
                            where: {
                                booklet_id: newBookletId,
                                receipt_no: newReceiptNo,
                                id: { [Op.ne]: id }
                            },
                            transaction: t
                        });

                        if (existingReceiptTransaction) {
                            throw new Error(`Receipt number ${newReceiptNo} is already used in another transaction`);
                        }

                        // Remove the new receipt from the new booklet
                        const newPagesLeft = newBooklet.pages_left.filter(page => page !== newReceiptNo);
                        await newBooklet.update({
                            pages_left: newPagesLeft,
                            is_active: newPagesLeft.length > 0
                        }, { transaction: t });
                    }

                    // Return the old receipt to the old booklet
                    if (oldBookletId && oldReceiptNo) {
                        const oldBooklet = await db.Booklet.findByPk(oldBookletId, {
                            transaction: t
                        });

                        if (oldBooklet) {
                            // Return the receipt number to the old booklet
                            const oldPagesLeft = [...oldBooklet.pages_left, oldReceiptNo];

                            // Sort the pages_left array numerically to maintain proper order
                            oldPagesLeft.sort((a, b) => parseInt(a) - parseInt(b));

                            await oldBooklet.update({
                                pages_left: oldPagesLeft,
                                is_active: true
                            }, { transaction: t });
                        }
                    }
                }
            }

            // Reverse old transaction effects
            for (const item of existingTransaction.items) {
                // Determine if this was a cash or bank transaction
                let oldCashAmount = 0;
                let oldBankAmount = 0;

                if (existingTransaction.cash_type === 'cash') {
                    oldCashAmount = parseFloat(item.amount);
                } else if (existingTransaction.cash_type === 'bank') {
                    oldBankAmount = parseFloat(item.amount);
                } else if (existingTransaction.cash_type === 'both' || existingTransaction.cash_type === 'multiple') {
                    // For split payment types, use the ratio of cash/bank in the main transaction
                    const totalAmount = parseFloat(existingTransaction.amount);
                    const cashRatio = parseFloat(existingTransaction.cash_amount) / totalAmount;
                    const bankRatio = parseFloat(existingTransaction.bank_amount) / totalAmount;

                    oldCashAmount = parseFloat(item.amount) * cashRatio;
                    oldBankAmount = parseFloat(item.amount) * bankRatio;
                }

                // Reverse the effect by flipping the side
                const reverseSide = item.side === '+' ? '-' : '+';

                // Update the ledger head balance in reverse
                await this.updateLedgerHeadBalance(
                    item.ledger_head_id,
                    item.amount,
                    oldCashAmount,
                    oldBankAmount,
                    reverseSide,
                    existingTransaction.tx_date,
                    t
                );
            }

            // Delete old transaction items (we'll create new ones)
            await db.TransactionItem.destroy({
                where: { transaction_id: id },
                transaction: t
            });

            // Prepare payment amounts
            let cashAmount = 0;
            let bankAmount = 0;

            if (data.cash_type === 'cash') {
                cashAmount = parseFloat(data.amount);
            } else if (data.cash_type === 'bank') {
                bankAmount = parseFloat(data.amount);
            } else if (data.cash_type === 'both' || data.cash_type === 'multiple') {
                cashAmount = parseFloat(data.cash_amount || 0);
                bankAmount = parseFloat(data.bank_amount || 0);
            }

            // Update the transaction
            await existingTransaction.update({
                account_id: data.account_id,
                ledger_head_id: data.ledger_head_id,
                donor_id: data.donor_id || null,
                booklet_id: data.booklet_id,
                receipt_no: data.receipt_no,
                amount: data.amount,
                cash_amount: cashAmount,
                bank_amount: bankAmount,
                cash_type: data.cash_type,
                tx_date: data.tx_date,
                description: data.description || ''
            }, { transaction: t });

            // Create new transaction items
            if (data.splits && data.splits.length > 0) {
                // Handle split amounts across different ledger heads
                let totalSplitAmount = 0;
                const splitItems = [];

                for (const split of data.splits) {
                    const splitAmount = parseFloat(split.amount);
                    totalSplitAmount += splitAmount;

                    splitItems.push({
                        transaction_id: id,
                        ledger_head_id: split.ledger_head_id,
                        amount: splitAmount,
                        side: '+'
                    });

                    // Update the ledger head balance for this split
                    let splitCashAmount = 0;
                    let splitBankAmount = 0;

                    if (data.cash_type === 'cash') {
                        splitCashAmount = splitAmount;
                    } else if (data.cash_type === 'bank') {
                        splitBankAmount = splitAmount;
                    } else if (data.cash_type === 'both' || data.cash_type === 'multiple') {
                        // For split payment types, use the ratio of cash/bank in the total amount
                        const totalAmount = parseFloat(data.amount);
                        const cashRatio = parseFloat(data.cash_amount || 0) / totalAmount;
                        const bankRatio = parseFloat(data.bank_amount || 0) / totalAmount;

                        splitCashAmount = splitAmount * cashRatio;
                        splitBankAmount = splitAmount * bankRatio;
                    }

                    await this.updateLedgerHeadBalance(
                        split.ledger_head_id,
                        splitAmount,
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
                    transaction_id: id,
                    ledger_head_id: data.ledger_head_id,
                    amount: data.amount,
                    side: '+'
                }, { transaction: t });

                // Update the ledger head balance
                await this.updateLedgerHeadBalance(
                    data.ledger_head_id,
                    data.amount,
                    cashAmount,
                    bankAmount,
                    '+',
                    data.tx_date,
                    t
                );
            }

            // Get the updated transaction with all its associations
            return await this.getTransactionById(id);
        });
    }
}

module.exports = new TransactionService(); 