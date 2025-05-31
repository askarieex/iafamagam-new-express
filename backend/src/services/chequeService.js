const db = require('../models');
const { Op } = require('sequelize');
const { sequelize } = db;
const transactionService = require('./transactionService');

class ChequeService {
    // List all cheques with optional filtering
    async listCheques(filters = {}) {
        try {
            console.log('Listing cheques with filters:', filters);

            // Debug: Query the transactions table directly to find pending cheque transactions
            const pendingChequeTransactions = await db.Transaction.findAll({
                where: {
                    status: 'pending',
                    cash_type: 'cheque'
                },
                include: [
                    {
                        model: db.Cheque,
                        as: 'cheque',
                        required: false
                    }
                ]
            });

            console.log(`Found ${pendingChequeTransactions.length} pending cheque transactions directly in Transactions table`);
            pendingChequeTransactions.forEach((tx, index) => {
                console.log(`Transaction #${index + 1}:`, {
                    id: tx.id,
                    status: tx.status,
                    cash_type: tx.cash_type,
                    amount: tx.amount,
                    has_cheque: tx.cheque ? true : false,
                    cheque_id: tx.cheque?.id
                });
            });

            const whereClause = {};
            const txWhereClause = { cash_type: 'cheque' };

            // Apply status filter (default to pending if not specified)
            if (filters.status) {
                whereClause.status = filters.status;
                // Always apply the status to transaction filter
                txWhereClause.status = filters.status;
            } else {
                whereClause.status = 'pending';
                // Also set transaction status to pending by default
                txWhereClause.status = 'pending';
            }

            // Apply account filter
            if (filters.account_id) {
                whereClause.account_id = filters.account_id;
            }

            // Apply ledger head filter
            if (filters.ledger_head_id) {
                whereClause.ledger_head_id = filters.ledger_head_id;
            }

            // Apply transaction type filter (credit/debit)
            if (filters.tx_type) {
                txWhereClause.tx_type = filters.tx_type;
            }

            // Apply date range filters for issue_date
            if (filters.from_date && filters.to_date) {
                whereClause.issue_date = {
                    [Op.between]: [filters.from_date, filters.to_date]
                };
            } else if (filters.from_date) {
                whereClause.issue_date = {
                    [Op.gte]: filters.from_date
                };
            } else if (filters.to_date) {
                whereClause.issue_date = {
                    [Op.lte]: filters.to_date
                };
            }

            // Get cheques with related data
            const cheques = await db.Cheque.findAll({
                where: whereClause,
                include: [
                    {
                        model: db.Transaction,
                        as: 'transaction',
                        where: null, // Remove conditions from the JOIN
                        required: false, // Use left join to make debugging easier
                        attributes: ['id', 'amount', 'tx_date', 'tx_type', 'cash_type', 'description', 'status']
                    },
                    {
                        model: db.Account,
                        as: 'account',
                        attributes: ['id', 'name']
                    },
                    {
                        model: db.LedgerHead,
                        as: 'ledgerHead',
                        attributes: ['id', 'name', 'head_type', 'bank_balance']
                    }
                ],
                order: [
                    ['status', 'ASC'], // Pending first
                    ['due_date', 'ASC'] // Earliest due date first
                ]
            });

            // Log raw cheque data for debugging
            console.log(`Found ${cheques.length} raw cheques before filtering`);
            if (cheques.length > 0) {
                cheques.forEach((cheque, index) => {
                    console.log(`Cheque #${index + 1}:`, {
                        id: cheque.id,
                        status: cheque.status,
                        cheque_number: cheque.cheque_number,
                        tx_id: cheque.tx_id,
                        transaction: cheque.transaction ? {
                            id: cheque.transaction.id,
                            status: cheque.transaction.status,
                            cash_type: cheque.transaction.cash_type,
                            tx_type: cheque.transaction.tx_type,
                            amount: cheque.transaction.amount
                        } : null
                    });
                });
            }

            // Filter the results after fetching to apply transaction conditions
            const filteredCheques = cheques.filter(cheque => {
                const transaction = cheque.transaction;
                // Skip cheques without transactions
                if (!transaction) return false;

                // Apply cash_type filter
                if (transaction.cash_type !== 'cheque') return false;

                // Apply status filter if specified
                if (txWhereClause.status && transaction.status !== txWhereClause.status) return false;

                // Apply tx_type filter if specified
                if (txWhereClause.tx_type && transaction.tx_type !== txWhereClause.tx_type) return false;

                return true;
            });

            console.log(`Found ${filteredCheques.length} cheques matching filters:`, filters);

            // Calculate totals by status
            let totalPendingValue = 0;
            let totalCancelledValue = 0;
            let totalClearedValue = 0;

            let totalDebitValue = 0;
            let totalCreditValue = 0;

            if (filteredCheques.length > 0) {
                // Group cheques by status and transaction type
                const pendingCheques = filteredCheques.filter(cheque => cheque.status === 'pending');
                const cancelledCheques = filteredCheques.filter(cheque => cheque.status === 'cancelled');
                const clearedCheques = filteredCheques.filter(cheque => cheque.status === 'cleared');

                const debitCheques = filteredCheques.filter(cheque => cheque.transaction?.tx_type === 'debit');
                const creditCheques = filteredCheques.filter(cheque => cheque.transaction?.tx_type === 'credit');

                // Calculate totals by status
                if (pendingCheques.length > 0) {
                    totalPendingValue = pendingCheques.reduce((sum, cheque) => {
                        return sum + (parseFloat(cheque.transaction?.amount || 0));
                    }, 0);
                }

                if (cancelledCheques.length > 0) {
                    totalCancelledValue = cancelledCheques.reduce((sum, cheque) => {
                        return sum + (parseFloat(cheque.transaction?.amount || 0));
                    }, 0);
                }

                if (clearedCheques.length > 0) {
                    totalClearedValue = clearedCheques.reduce((sum, cheque) => {
                        return sum + (parseFloat(cheque.transaction?.amount || 0));
                    }, 0);
                }

                // Calculate totals by transaction type
                if (debitCheques.length > 0) {
                    totalDebitValue = debitCheques.reduce((sum, cheque) => {
                        return sum + (parseFloat(cheque.transaction?.amount || 0));
                    }, 0);
                }

                if (creditCheques.length > 0) {
                    totalCreditValue = creditCheques.reduce((sum, cheque) => {
                        return sum + (parseFloat(cheque.transaction?.amount || 0));
                    }, 0);
                }
            }

            // Return cheques with detailed stats
            return {
                cheques: filteredCheques,
                totalPendingValue,
                totalCancelledValue,
                totalClearedValue,
                totalDebitValue,
                totalCreditValue,
                counts: {
                    pending: filteredCheques.filter(c => c.status === 'pending').length,
                    cancelled: filteredCheques.filter(c => c.status === 'cancelled').length,
                    cleared: filteredCheques.filter(c => c.status === 'cleared').length,
                    debit: filteredCheques.filter(c => c.transaction?.tx_type === 'debit').length,
                    credit: filteredCheques.filter(c => c.transaction?.tx_type === 'credit').length
                }
            };
        } catch (error) {
            console.error('Error listing cheques:', error);
            throw error;
        }
    }

    // Get a single cheque by ID
    async getChequeById(id) {
        try {
            console.log(`Getting cheque details for ID: ${id}`);

            const cheque = await db.Cheque.findByPk(id, {
                include: [
                    {
                        model: db.Transaction,
                        as: 'transaction',
                        include: [
                            {
                                model: db.TransactionItem,
                                as: 'items',
                                include: [
                                    {
                                        model: db.LedgerHead,
                                        as: 'ledgerHead'
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        model: db.Account,
                        as: 'account'
                    },
                    {
                        model: db.LedgerHead,
                        as: 'ledgerHead'
                    }
                ]
            });

            if (!cheque) {
                console.error(`Cheque with ID ${id} not found`);
                throw new Error(`Cheque with ID ${id} not found`);
            }

            return cheque;
        } catch (error) {
            console.error(`Error getting cheque with ID ${id}:`, error);
            throw error;
        }
    }

    // Mark a cheque as cleared and update balances
    async clearCheque(id, clearingDate = new Date()) {
        return await sequelize.transaction(async (t) => {
            try {
                // First get just the cheque record with lock
                const cheque = await db.Cheque.findByPk(id, {
                    lock: true,
                    transaction: t
                });

                if (!cheque) {
                    throw new Error(`Cheque with ID ${id} not found`);
                }

                // Validate cheque status
                if (cheque.status !== 'pending') {
                    throw new Error(`Cannot clear cheque that is already ${cheque.status}`);
                }

                // Now get the associated transaction and its items separately
                const transaction = await db.Transaction.findByPk(cheque.tx_id, {
                    include: [
                        {
                            model: db.TransactionItem,
                            as: 'items'
                        }
                    ],
                    transaction: t
                });

                if (!transaction) {
                    throw new Error(`Transaction associated with cheque ${id} not found`);
                }

                // Get the source ledger heads (from where money is deducted)
                const sourceItems = transaction.items.filter(item => item.side === '-');

                // VALIDATE BANK BALANCE: Check if each source ledger has sufficient bank balance
                for (const sourceItem of sourceItems) {
                    // Get the current ledger head record
                    const ledgerHead = await db.LedgerHead.findByPk(sourceItem.ledger_head_id, {
                        transaction: t
                    });

                    if (!ledgerHead) {
                        throw new Error(`Source ledger head ID ${sourceItem.ledger_head_id} not found`);
                    }

                    // Check if we have sufficient bank balance
                    const currentBankBalance = parseFloat(ledgerHead.bank_balance);
                    const requiredAmount = parseFloat(sourceItem.amount);

                    if (currentBankBalance < requiredAmount) {
                        throw new Error(
                            `Insufficient bank funds to clear this cheque. ` +
                            `Available bank balance: ₹${currentBankBalance.toFixed(2)} ` +
                            `for ledger ${ledgerHead.name}. ` +
                            `Required: ₹${requiredAmount.toFixed(2)}`
                        );
                    }
                }

                // Update cheque status
                await cheque.update({
                    status: 'cleared',
                    clearing_date: clearingDate
                }, { transaction: t });

                // Update transaction status
                await transaction.update({
                    status: 'completed'
                }, { transaction: t });

                // Now we need to update ledger balances as if this was a normal bank debit
                // Get the target (expense) ledger head first
                const targetItem = transaction.items.find(item => item.side === '+');
                if (targetItem) {
                    await transactionService.updateLedgerHeadBalance(
                        targetItem.ledger_head_id,
                        targetItem.amount,
                        0, // Cash amount is 0 for cheques
                        targetItem.amount, // Full amount goes to bank
                        '+',
                        transaction.tx_date,
                        t
                    );
                }

                // Update source ledger heads (from where money is deducted)
                for (const sourceItem of sourceItems) {
                    await transactionService.updateLedgerHeadBalance(
                        sourceItem.ledger_head_id,
                        sourceItem.amount,
                        0, // Cash amount is 0 for cheques
                        sourceItem.amount, // Full amount comes from bank
                        '-',
                        transaction.tx_date,
                        t
                    );
                }

                // Fetch the complete updated transaction with all related data
                const updatedTransaction = await transactionService.getTransactionById(transaction.id);

                return {
                    success: true,
                    message: 'Cheque cleared successfully',
                    cheque: updatedTransaction.cheque,
                    transaction: updatedTransaction
                };
            } catch (error) {
                console.error('Error clearing cheque:', error);
                throw error;
            }
        });
    }

    // Cancel a cheque
    async cancelCheque(id, reason = '') {
        return await sequelize.transaction(async (t) => {
            try {
                // Get just the cheque with locking for update
                const cheque = await db.Cheque.findByPk(id, {
                    lock: true,
                    transaction: t
                });

                if (!cheque) {
                    throw new Error(`Cheque with ID ${id} not found`);
                }

                // Validate cheque status
                if (cheque.status !== 'pending') {
                    throw new Error(`Cannot cancel cheque that is already ${cheque.status}`);
                }

                // Get the associated transaction separately
                const transaction = await db.Transaction.findByPk(cheque.tx_id, {
                    transaction: t
                });

                if (!transaction) {
                    throw new Error(`Transaction associated with cheque ${id} not found`);
                }

                // Update cheque status and add reason if provided
                await cheque.update({
                    status: 'cancelled',
                    description: reason ? (cheque.description ? `${cheque.description} | Cancelled: ${reason}` : `Cancelled: ${reason}`) : cheque.description
                }, { transaction: t });

                // Update transaction status
                await transaction.update({
                    status: 'cancelled',
                    description: reason ? (transaction.description ? `${transaction.description} | Cancelled: ${reason}` : `Cancelled: ${reason}`) : transaction.description
                }, { transaction: t });

                // Fetch the complete updated transaction with all related data
                const updatedTransaction = await transactionService.getTransactionById(transaction.id);

                return {
                    success: true,
                    message: 'Cheque cancelled successfully',
                    cheque: updatedTransaction.cheque,
                    transaction: updatedTransaction
                };
            } catch (error) {
                console.error('Error cancelling cheque:', error);
                throw error;
            }
        });
    }

    // Calculate available bank balance for a ledger head after accounting for pending cheques
    async calculateAvailableBankBalance(ledgerHeadId, excludeTransactionId = null) {
        try {
            // Get the ledger head
            const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId);
            if (!ledgerHead) {
                throw new Error(`Ledger head ID ${ledgerHeadId} not found`);
            }

            // Build where clause for transactions
            const txWhereClause = {
                status: 'pending',
                cash_type: 'cheque'
            };

            // If we're updating a transaction, exclude it from the calculation
            if (excludeTransactionId) {
                txWhereClause.id = { [Op.ne]: excludeTransactionId };
            }

            // Get total of pending cheques for this ledger head
            const pendingCheques = await db.Transaction.findAll({
                where: txWhereClause,
                include: [
                    {
                        model: db.TransactionItem,
                        as: 'items',
                        where: {
                            ledger_head_id: ledgerHeadId,
                            side: '-'  // Only count items where this ledger is being debited
                        },
                        required: true,
                        attributes: [] // Don't select item columns, only use for joining
                    },
                    {
                        model: db.Cheque,
                        as: 'cheque',
                        where: { status: 'pending' },
                        required: true,
                        attributes: [] // Don't select cheque columns, only use for joining
                    }
                ],
                attributes: [
                    [sequelize.fn('SUM', sequelize.col('items.amount')), 'totalPending']
                ],
                raw: true
            });

            console.log('Pending cheques for ledger head:', ledgerHeadId, 'Result:', pendingCheques);

            // Safely extract the total pending amount
            let pendingTotal = 0;

            try {
                pendingTotal = parseFloat(pendingCheques[0]?.totalPending || 0);
                console.log(`Successfully calculated pending total using aggregate: ${pendingTotal}`);
            } catch (error) {
                console.error('Error parsing pendingTotal from aggregate query:', error);

                // Fallback: manually calculate by fetching all transactions and summing them
                console.log('Using fallback method to calculate pending total...');

                const pendingTransactions = await db.Transaction.findAll({
                    where: txWhereClause,
                    include: [
                        {
                            model: db.TransactionItem,
                            as: 'items',
                            where: {
                                ledger_head_id: ledgerHeadId,
                                side: '-'
                            },
                            required: true
                        },
                        {
                            model: db.Cheque,
                            as: 'cheque',
                            where: { status: 'pending' },
                            required: true
                        }
                    ]
                });

                // Manually sum the amounts
                pendingTotal = pendingTransactions.reduce((sum, tx) => {
                    // Find the relevant transaction item for this ledger head
                    const item = tx.items.find(i =>
                        i.ledger_head_id === ledgerHeadId && i.side === '-'
                    );
                    return sum + (item ? parseFloat(item.amount) : 0);
                }, 0);

                console.log(`Calculated pending total using fallback method: ${pendingTotal}`);
            }

            const currentBankBalance = parseFloat(ledgerHead.bank_balance);
            const availableBankBalance = currentBankBalance - pendingTotal;

            return {
                currentBankBalance,
                pendingTotal,
                availableBankBalance,
                ledgerHeadName: ledgerHead.name
            };
        } catch (error) {
            console.error('Error calculating available bank balance:', error);
            throw error;
        }
    }

    // Validate if there's sufficient bank balance for a new cheque
    async validateSufficientBankBalance(ledgerHeadId, amount, transactionId = null) {
        try {
            const { availableBankBalance, currentBankBalance, pendingTotal, ledgerHeadName } =
                await this.calculateAvailableBankBalance(ledgerHeadId, transactionId);

            const chequeAmount = parseFloat(amount);

            if (availableBankBalance < chequeAmount) {
                throw new Error(
                    `Insufficient bank funds. Available balance: ₹${availableBankBalance.toFixed(2)} ` +
                    `(Bank balance: ₹${currentBankBalance.toFixed(2)} - ` +
                    `Pending cheques: ₹${pendingTotal.toFixed(2)}) for ledger ${ledgerHeadName}. ` +
                    `Required: ₹${chequeAmount.toFixed(2)}`
                );
            }

            return true;
        } catch (error) {
            throw error;
        }
    }

    // Fix missing cheque records for transactions
    async fixMissingChequeRecords() {
        return await sequelize.transaction(async (t) => {
            try {
                // Find all transactions that should have cheque records but don't
                const transactions = await db.Transaction.findAll({
                    where: {
                        status: 'pending',
                        cash_type: 'cheque'
                    },
                    include: [
                        {
                            model: db.Cheque,
                            as: 'cheque',
                            required: false
                        },
                        {
                            model: db.Account,
                            as: 'account',
                            required: false
                        },
                        {
                            model: db.LedgerHead,
                            as: 'ledgerHead',
                            required: false
                        },
                        {
                            model: db.TransactionItem,
                            as: 'items',
                            required: false
                        }
                    ],
                    transaction: t
                });

                console.log(`Found ${transactions.length} transactions that need cheque records`);

                // Filter to only transactions without cheque records
                const transactionsWithoutCheques = transactions.filter(tx => !tx.cheque);
                console.log(`${transactionsWithoutCheques.length} transactions are missing cheque records`);

                // Create cheque records for these transactions
                const createdCheques = [];
                for (const tx of transactionsWithoutCheques) {
                    // Get the first source item (for ledger_head_id)
                    const sourceItem = tx.items?.find(item => item.side === '-');
                    const ledgerHeadId = sourceItem?.ledger_head_id || tx.ledger_head_id;

                    if (!ledgerHeadId) {
                        console.warn(`Cannot create cheque record for transaction ${tx.id}: missing ledger_head_id`);
                        continue;
                    }

                    // Generate a cheque number if needed
                    const chequeNumber = `AUTO-${tx.id.substring(0, 8)}`;

                    // Create the cheque record
                    try {
                        const cheque = await db.Cheque.create({
                            tx_id: tx.id,
                            account_id: tx.account_id,
                            ledger_head_id: ledgerHeadId,
                            cheque_number: chequeNumber,
                            bank_name: 'Auto-generated',
                            issue_date: tx.tx_date,
                            due_date: new Date(new Date(tx.tx_date).getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days after issue
                            status: 'pending',
                            description: `Auto-generated for transaction ${tx.id}: ${tx.description || ''}`
                        }, { transaction: t });

                        createdCheques.push(cheque);
                    } catch (error) {
                        console.error(`Error creating cheque for transaction ${tx.id}:`, error);
                    }
                }

                console.log(`Created ${createdCheques.length} new cheque records`);
                return {
                    success: true,
                    message: `Created ${createdCheques.length} new cheque records`,
                    createdCheques
                };
            } catch (error) {
                console.error('Error fixing missing cheque records:', error);
                throw error;
            }
        });
    }
}

module.exports = new ChequeService(); 