const db = require('../models');
const { v4: uuidv4 } = require('uuid');
const hashChainService = require('./hashChainService');
const { Op } = require('sequelize');

class ImmutableTransactionService {

    /**
     * Create a new immutable transaction (Credit)
     * @param {Object} transactionData - Transaction data
     * @param {Object} userContext - User context (id, ip, session, etc.)
     * @returns {Object} Created transaction result
     */
    async createCreditTransaction(transactionData, userContext) {
        const transaction = await db.sequelize.transaction();

        try {
            console.log('🔄 Creating immutable credit transaction...');

            // STEP 1: Validate and prepare data
            const validatedData = await this.validateAndPrepareTransaction(transactionData, 'credit');

            // STEP 2: Check date restrictions and approval requirements
            const dateValidation = await this.validateTransactionDate(validatedData.transaction_date, userContext);

            // STEP 3: Create transaction log entry
            const logEntry = await this.createTransactionLogEntry(
                validatedData,
                userContext,
                dateValidation,
                transaction
            );

            // STEP 4: Update ledger head balances
            await this.updateLedgerHeadBalance(logEntry, transaction);

            // STEP 5: Handle receipt booklet if specified
            if (logEntry.booklet_id && logEntry.receipt_number) {
                await this.handleReceiptUsage(logEntry.booklet_id, logEntry.receipt_number, transaction);
            }

            // STEP 6: Create audit trail
            await this.createAuditTrail(logEntry, userContext, transaction);

            await transaction.commit();

            console.log('✅ Immutable credit transaction created:', logEntry.transaction_uuid);

            return {
                success: true,
                transaction: {
                    uuid: logEntry.transaction_uuid,
                    log_id: logEntry.log_id,
                    amount: logEntry.amount,
                    hash: logEntry.current_hash,
                    requires_approval: logEntry.requires_approval,
                    approval_level: logEntry.approval_level
                },
                message: logEntry.requires_approval
                    ? 'Transaction created and pending approval'
                    : 'Transaction created successfully',
                warning: 'This transaction is now PERMANENTLY recorded and cannot be modified. Only corrections through approval workflow are possible.'
            };

        } catch (error) {
            await transaction.rollback();
            console.error('❌ Failed to create credit transaction:', error);
            throw error;
        }
    }

    /**
     * Create a new immutable transaction (Debit)
     * @param {Object} transactionData - Transaction data
     * @param {Object} userContext - User context
     * @returns {Object} Created transaction result
     */
    async createDebitTransaction(transactionData, userContext) {
        const dbTransaction = await db.sequelize.transaction();

        try {
            console.log('🔄 Creating immutable debit transaction...');

            // STEP 1: Validate and prepare data
            const validatedData = await this.validateAndPrepareTransaction(transactionData, 'debit');

            // STEP 2: Extract source ledger head (where money comes from)
            const sourceLedgerHeadId = transactionData.source_ledger_head_id;

            if (!sourceLedgerHeadId) {
                throw new Error('Source ledger head is required for debit transactions');
            }

            // STEP 3: Check available balance in source ledger (prevent overdrafts)
            await this.validateSufficientBalance({
                ...validatedData,
                ledger_head_id: sourceLedgerHeadId // Check source balance, not destination
            });

            // STEP 4: Check date restrictions and approval requirements
            const dateValidation = await this.validateTransactionDate(validatedData.transaction_date, userContext);

            // STEP 5: Create transaction log entry for the expense (debit head)
            const logEntry = await this.createTransactionLogEntry({
                ...validatedData,
                ledger_head_id: validatedData.ledger_head_id, // Destination (expense) ledger
                tx_type: 'debit',
                description: `${validatedData.description}`,
                source_ledger_head_id: sourceLedgerHeadId // Track source for balance deduction
            }, userContext, dateValidation, dbTransaction);

            // STEP 6: Update balances - ONLY the source credit head loses money, destination debit head tracks the expense
            // 6a. Decrease source ledger balance (money going out from credit head)
            await this.updateSourceLedgerBalance(logEntry, sourceLedgerHeadId, dbTransaction);

            // 6b. Update destination expense ledger (record the expense) - this increases the debit head balance
            await this.updateLedgerHeadBalance(logEntry, dbTransaction);

            // STEP 7: Handle receipt booklet if specified
            if (logEntry.booklet_id && logEntry.receipt_number) {
                await this.handleReceiptUsage(logEntry.booklet_id, logEntry.receipt_number, dbTransaction);
            }

            // STEP 8: Create audit trail
            await this.createAuditTrail(logEntry, userContext, dbTransaction);

            await dbTransaction.commit();

            console.log('✅ Immutable debit transaction created:', logEntry.transaction_uuid);

            return {
                success: true,
                transaction: {
                    uuid: logEntry.transaction_uuid,
                    log_id: logEntry.log_id,
                    amount: logEntry.amount,
                    hash: logEntry.current_hash,
                    requires_approval: logEntry.requires_approval,
                    approval_level: logEntry.approval_level
                },
                message: logEntry.requires_approval
                    ? 'Debit transaction created and pending approval'
                    : 'Debit transaction created successfully',
                warning: 'This transaction is now PERMANENTLY recorded and cannot be modified. Only corrections through approval workflow are possible.'
            };

        } catch (error) {
            await dbTransaction.rollback();
            console.error('❌ Failed to create debit transaction:', error);
            throw error;
        }
    }

    /**
     * Validate and prepare transaction data
     * @param {Object} data - Raw transaction data
     * @param {String} txType - Transaction type (credit/debit)
     * @returns {Object} Validated and prepared data
     */
    async validateAndPrepareTransaction(data, txType) {
        // Required field validation
        const requiredFields = ['account_id', 'ledger_head_id', 'amount', 'cash_type', 'description'];
        for (const field of requiredFields) {
            if (!data[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Amount validation
        const amount = parseFloat(data.amount);
        if (isNaN(amount) || amount <= 0) {
            throw new Error('Amount must be a positive number');
        }

        // Validate account exists
        const account = await db.Account.findByPk(data.account_id);
        if (!account) {
            throw new Error('Account not found');
        }

        // Validate ledger head exists and matches type
        const ledgerHead = await db.LedgerHead.findByPk(data.ledger_head_id);
        if (!ledgerHead) {
            throw new Error('Ledger head not found');
        }

        if (ledgerHead.head_type !== txType) {
            throw new Error(`Ledger head type mismatch. Expected: ${txType}, Got: ${ledgerHead.head_type}`);
        }

        // Set transaction date (default to today if not provided)
        const transactionDate = data.transaction_date || new Date().toISOString().split('T')[0];

        // Validate and set cash/bank amounts based on payment method
        let cashAmount = 0;
        let bankAmount = 0;

        if (data.cash_type === 'cash') {
            cashAmount = amount;
            bankAmount = 0;
        } else if (['bank', 'upi', 'card', 'netbank', 'cheque'].includes(data.cash_type)) {
            cashAmount = 0;
            bankAmount = amount;
        } else if (data.cash_type === 'both' || data.cash_type === 'multiple' || data.cash_type === 'mixed') {
            cashAmount = parseFloat(data.cash_amount || 0);
            bankAmount = parseFloat(data.bank_amount || 0);
            console.log(`🔄 MIXED/BOTH/MULTIPLE payment detected: cash_type="${data.cash_type}", cashAmount=${cashAmount}, bankAmount=${bankAmount}`);

            // Validate that cash + bank equals total amount
            if (Math.abs((cashAmount + bankAmount) - amount) > 0.01) {
                throw new Error(`Cash (₹${cashAmount}) + Bank (₹${bankAmount}) = ₹${cashAmount + bankAmount} does not equal total amount ₹${amount}`);
            }
        } else {
            // Default to bank for unknown payment types
            cashAmount = 0;
            bankAmount = amount;
        }

        return {
            account_id: parseInt(data.account_id),
            ledger_head_id: parseInt(data.ledger_head_id),
            amount: amount,
            cash_amount: cashAmount,
            bank_amount: bankAmount,
            tx_type: txType,
            cash_type: data.cash_type,
            transaction_date: transactionDate,
            transaction_time: new Date().toTimeString().split(' ')[0],
            description: data.description.trim(),
            booklet_id: data.booklet_id ? parseInt(data.booklet_id) : null,
            receipt_number: data.receipt_number ? parseInt(data.receipt_number) : null,
            donor_id: data.donor_id ? parseInt(data.donor_id) : null
        };
    }

    /**
     * Validate transaction date and determine approval requirements
     * @param {String} transactionDate - Transaction date
     * @param {Object} userContext - User context
     * @returns {Object} Date validation result
     */
    async validateTransactionDate(transactionDate, userContext) {
        const today = new Date().toISOString().split('T')[0];

        // Convert date format if needed (DD/MM/YYYY to YYYY-MM-DD)
        let normalizedDate = transactionDate;
        if (transactionDate && transactionDate.includes('/')) {
            const parts = transactionDate.split('/');
            if (parts.length === 3) {
                // Assume DD/MM/YYYY format
                normalizedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }

        const selectedDate = new Date(normalizedDate);
        const todayDate = new Date(today);

        // Check if date is valid after parsing
        if (isNaN(selectedDate.getTime())) {
            throw new Error('Invalid date format. Please use YYYY-MM-DD or DD/MM/YYYY format.');
        }

        const daysDifference = Math.ceil((todayDate - selectedDate) / (1000 * 60 * 60 * 24));

        // Future dates are never allowed
        if (daysDifference < 0) {
            throw new Error('Future transaction dates are not allowed');
        }

        // Current date - no approval needed
        if (daysDifference === 0) {
            return {
                allowed: true,
                approvalLevel: 0,
                reason: 'Current date transaction',
                status: 'allowed'
            };
        }

        // Weekend grace period (1-2 days back from Monday)
        if (daysDifference <= 2 && this.isWeekendGracePeriod(transactionDate, today)) {
            return {
                allowed: true,
                approvalLevel: 0,
                reason: 'Weekend grace period',
                dateOverrideReason: 'Weekend work entry delay',
                status: 'grace_period'
            };
        }

        // Short backdate (3-5 days) - Manager approval required
        if (daysDifference <= 5) {
            return {
                allowed: true,
                approvalLevel: 1,
                requiredRole: 'manager',
                reason: 'Short backdate with manager approval',
                dateOverrideReason: 'Business delay justification required',
                status: 'needs_approval'
            };
        }

        // Extended backdate (6-10 days) - Director approval required
        if (daysDifference <= 10) {
            return {
                allowed: true,
                approvalLevel: 2,
                requiredRole: 'director',
                reason: 'Extended backdate with director approval',
                dateOverrideReason: 'Extended business delay with strong justification',
                status: 'needs_high_approval'
            };
        }

        // Beyond 10 days - Not allowed for backdating
        throw new Error(`Cannot backdate beyond 10 days. Use correction workflow instead for transactions older than 10 days.`);
    }

    /**
     * Check if date falls within weekend grace period
     */
    isWeekendGracePeriod(transactionDate, currentDate) {
        const txDate = new Date(transactionDate);
        const currentDay = new Date(currentDate).getDay(); // 0 = Sunday, 1 = Monday
        const txDay = txDate.getDay();

        // Allow Monday entry for Friday/Saturday/Sunday work
        return currentDay === 1 && (txDay === 5 || txDay === 6 || txDay === 0);
    }

    /**
     * Validate sufficient balance for debit transactions
     */
    async validateSufficientBalance(transactionData) {
        // For debit transactions, check the source ledger head balance
        const sourceLedgerHeadId = transactionData.source_ledger_head_id || transactionData.ledger_head_id;
        const currentBalance = await this.calculateCurrentBalance(
            transactionData.account_id,
            sourceLedgerHeadId
        );

        if (currentBalance < transactionData.amount) {
            throw new Error(`Insufficient balance. Available: ₹${currentBalance.toFixed(2)}, Required: ₹${transactionData.amount.toFixed(2)}`);
        }
    }

    /**
     * Get ledger head name by ID
     */
    async getLedgerHeadName(ledgerHeadId) {
        try {
            const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId);
            return ledgerHead ? ledgerHead.name : `Unknown Ledger (${ledgerHeadId})`;
        } catch (error) {
            return `Ledger ${ledgerHeadId}`;
        }
    }

    /**
     * Create immutable transaction log entry
     */
    async createTransactionLogEntry(transactionData, userContext, dateValidation, transaction) {
        // Use provided transaction_uuid or generate a new one
        const transactionUuid = transactionData.transaction_uuid || uuidv4();

        // Calculate log_sequence for this transaction UUID
        let logSequence = 1;
        if (transactionData.transaction_uuid) {
            // If we have a shared UUID, get the next sequence number
            const existingEntries = await db.TransactionLog.findAll({
                where: { transaction_uuid: transactionData.transaction_uuid },
                transaction
            });
            logSequence = existingEntries.length + 1;
        }

        // Get previous hash for chain
        const previousHash = await hashChainService.getLastTransactionHash(transactionData.account_id) || '';

        // Clean up invalid booklet/receipt data that would cause foreign key errors
        const cleanedData = { ...transactionData };

        // If booklet_id is provided, verify it exists in the database
        if (cleanedData.booklet_id) {
            try {
                const bookletExists = await db.Booklet.findByPk(cleanedData.booklet_id, { transaction });
                if (!bookletExists) {
                    console.warn(`Booklet ID ${cleanedData.booklet_id} not found, removing from transaction data`);
                    delete cleanedData.booklet_id;
                    delete cleanedData.receipt_number;
                }
            } catch (error) {
                console.warn(`Error checking booklet ID ${cleanedData.booklet_id}, removing from transaction data:`, error.message);
                delete cleanedData.booklet_id;
                delete cleanedData.receipt_number;
            }
        }

        // Prepare log entry data
        const logData = {
            transaction_uuid: transactionUuid,
            log_sequence: logSequence,
            action_type: 'CREATE',
            ...cleanedData,
            created_at: new Date(),
            created_by: userContext.userId,
            client_ip: userContext.ipAddress,
            user_agent: userContext.userAgent,
            session_id: userContext.sessionId,
            previous_hash: previousHash,
            requires_approval: dateValidation.approvalLevel > 0,
            approval_level: dateValidation.approvalLevel,
            date_override_reason: dateValidation.dateOverrideReason || null
        };

        // Generate cryptographic hash
        logData.current_hash = hashChainService.generateTransactionHash(logData, previousHash);

        // Create the immutable log entry
        const logEntry = await db.TransactionLog.create(logData, { transaction });

        return logEntry;
    }

    /**
     * Update source ledger head balance (for debit transactions)
     * This decreases the balance of the source ledger (where money comes from)
     */
    async updateSourceLedgerBalance(logEntry, sourceLedgerHeadId, transaction) {
        try {
            console.log(`🔄 Updating SOURCE ledger head balance for ledger_head_id: ${sourceLedgerHeadId}, amount: ${logEntry.amount}`);

            // Get the source ledger head
            const sourceLedgerHead = await db.LedgerHead.findByPk(sourceLedgerHeadId, { transaction });

            if (!sourceLedgerHead) {
                throw new Error(`Source ledger head not found: ${sourceLedgerHeadId}`);
            }

            // Calculate cash and bank portions for deduction
            const amountToDeduct = parseFloat(logEntry.amount || 0);
            let cashToDeduct = 0;
            let bankToDeduct = 0;

            if (logEntry.cash_type === 'cash') {
                cashToDeduct = amountToDeduct;
                bankToDeduct = 0;
            } else if (['bank', 'upi', 'card', 'netbank', 'cheque'].includes(logEntry.cash_type)) {
                cashToDeduct = 0;
                bankToDeduct = amountToDeduct;
            } else if (logEntry.cash_type === 'both' || logEntry.cash_type === 'multiple') {
                cashToDeduct = parseFloat(logEntry.cash_amount || 0);
                bankToDeduct = parseFloat(logEntry.bank_amount || 0);
            } else {
                // Default to bank for unknown payment types
                cashToDeduct = 0;
                bankToDeduct = amountToDeduct;
            }

            // Calculate new balances
            const newCurrentBalance = parseFloat(sourceLedgerHead.current_balance || 0) - amountToDeduct;
            const newCashBalance = parseFloat(sourceLedgerHead.cash_balance || 0) - cashToDeduct;
            const newBankBalance = parseFloat(sourceLedgerHead.bank_balance || 0) - bankToDeduct;

            // Validate sufficient balance
            if (newCurrentBalance < -0.01) {
                throw new Error(`Insufficient total balance in ${sourceLedgerHead.name}. Required: ₹${amountToDeduct.toFixed(2)}, Available: ₹${sourceLedgerHead.current_balance}`);
            }
            if (newCashBalance < -0.01 && cashToDeduct > 0) {
                throw new Error(`Insufficient cash balance in ${sourceLedgerHead.name}. Required: ₹${cashToDeduct.toFixed(2)}, Available: ₹${sourceLedgerHead.cash_balance}`);
            }
            if (newBankBalance < -0.01 && bankToDeduct > 0) {
                throw new Error(`Insufficient bank balance in ${sourceLedgerHead.name}. Required: ₹${bankToDeduct.toFixed(2)}, Available: ₹${sourceLedgerHead.bank_balance}`);
            }

            // Update the source ledger head
            await sourceLedgerHead.update({
                current_balance: Math.round(newCurrentBalance * 100) / 100,
                cash_balance: Math.round(newCashBalance * 100) / 100,
                bank_balance: Math.round(newBankBalance * 100) / 100
            }, { transaction });

            console.log(`✅ Source ledger head balance updated: ${sourceLedgerHead.name} - New balance: ₹${newCurrentBalance.toFixed(2)} (Cash: ₹${newCashBalance.toFixed(2)}, Bank: ₹${newBankBalance.toFixed(2)})`);

        } catch (error) {
            console.error('❌ Error updating source ledger head balance:', error);
            throw error;
        }
    }

    /**
     * Update ledger head balance directly
     * This is the main balance update logic for the immutable system
     */
    async updateLedgerHeadBalance(logEntry, transaction) {
        try {
            console.log(`🔄 Updating ledger head balance for ledger_head_id: ${logEntry.ledger_head_id}, amount: ${logEntry.amount}, type: ${logEntry.tx_type}`);

            // Get the current ledger head
            const ledgerHead = await db.LedgerHead.findByPk(logEntry.ledger_head_id, { transaction });

            if (!ledgerHead) {
                throw new Error(`Ledger head not found: ${logEntry.ledger_head_id}`);
            }

            // Calculate cash and bank portions based on payment method
            const totalAmount = parseFloat(logEntry.amount || 0);
            let cashAmount = 0;
            let bankAmount = 0;

            // Use the cash_amount and bank_amount from logEntry if available (they should be set from validateAndPrepareTransaction)
            if (logEntry.cash_amount !== undefined && logEntry.bank_amount !== undefined) {
                cashAmount = parseFloat(logEntry.cash_amount || 0);
                bankAmount = parseFloat(logEntry.bank_amount || 0);
                console.log(`Using logEntry amounts - Cash: ₹${cashAmount}, Bank: ₹${bankAmount}`);
            } else {
                // Fallback calculation if not present
                if (logEntry.cash_type === 'cash') {
                    cashAmount = totalAmount;
                    bankAmount = 0;
                } else if (['bank', 'upi', 'card', 'netbank', 'cheque'].includes(logEntry.cash_type)) {
                    cashAmount = 0;
                    bankAmount = totalAmount;
                } else if (logEntry.cash_type === 'both' || logEntry.cash_type === 'multiple' || logEntry.cash_type === 'mixed') {
                    cashAmount = parseFloat(logEntry.cash_amount || 0);
                    bankAmount = parseFloat(logEntry.bank_amount || 0);
                    console.log(`🔄 FALLBACK: Processing ${logEntry.cash_type} payment - Cash: ${cashAmount}, Bank: ${bankAmount}`);
                } else {
                    // Default to bank for unknown payment types
                    cashAmount = 0;
                    bankAmount = totalAmount;
                }
                console.log(`Using fallback calculation - Cash: ₹${cashAmount}, Bank: ₹${bankAmount}`);
            }

            // Calculate balance change based on transaction type and ledger head type
            let balanceChange = 0;
            let cashChange = 0;
            let bankChange = 0;

            if (ledgerHead.head_type === 'credit') {
                // For credit ledger heads: credit transactions increase balance, debit transactions decrease balance
                if (logEntry.tx_type === 'credit') {
                    balanceChange = totalAmount;
                    cashChange = cashAmount;
                    bankChange = bankAmount;
                } else {
                    // This shouldn't happen in normal operations for credit heads
                    balanceChange = -totalAmount;
                    cashChange = -cashAmount;
                    bankChange = -bankAmount;
                }
            } else if (ledgerHead.head_type === 'debit') {
                // For debit ledger heads: debit transactions increase the expense total
                if (logEntry.tx_type === 'debit') {
                    balanceChange = totalAmount;
                    // For debit heads, we don't track cash/bank breakdown in the same way
                    // The cash/bank comes from the source, but we record the expense total
                    cashChange = 0; // Debit heads don't accumulate cash
                    bankChange = 0; // Debit heads don't accumulate bank funds
                } else {
                    // This shouldn't happen in normal operations for debit heads
                    balanceChange = -totalAmount;
                    cashChange = 0;
                    bankChange = 0;
                }
            }

            // Update balances
            const newCurrentBalance = parseFloat(ledgerHead.current_balance || 0) + balanceChange;
            const newCashBalance = parseFloat(ledgerHead.cash_balance || 0) + cashChange;
            const newBankBalance = parseFloat(ledgerHead.bank_balance || 0) + bankChange;

            // Update the ledger head with new balances
            const updateData = {
                current_balance: Math.round(newCurrentBalance * 100) / 100,
                cash_balance: Math.round(newCashBalance * 100) / 100,
                bank_balance: Math.round(newBankBalance * 100) / 100
            };

            console.log(`🔄 Updating ledger head ${ledgerHead.id} with:`, updateData);

            await ledgerHead.update(updateData, { transaction });

            console.log(`✅ Ledger head balance updated: ${ledgerHead.name} (${ledgerHead.head_type})`);
            console.log(`   Previous: Total=₹${parseFloat(ledgerHead.current_balance || 0).toFixed(2)}, Cash=₹${parseFloat(ledgerHead.cash_balance || 0).toFixed(2)}, Bank=₹${parseFloat(ledgerHead.bank_balance || 0).toFixed(2)}`);
            console.log(`   Change: Cash=₹${cashChange.toFixed(2)}, Bank=₹${bankChange.toFixed(2)}`);
            console.log(`   New: Total=₹${newCurrentBalance.toFixed(2)}, Cash=₹${newCashBalance.toFixed(2)}, Bank=₹${newBankBalance.toFixed(2)}`);

        } catch (error) {
            console.error('❌ Error updating ledger head balance:', error);
            throw error;
        }
    }

    /**
     * Update balance snapshots
     */
    async updateBalanceSnapshots(logEntry, dbTransaction) {
        const snapshotDate = logEntry.transaction_date;

        // Get or create balance snapshot for today
        let snapshot = await db.BalanceSnapshot.findOne({
            where: {
                snapshot_date: snapshotDate,
                account_id: logEntry.account_id,
                ledger_head_id: logEntry.ledger_head_id
            },
            transaction: dbTransaction
        });

        const balanceChange = logEntry.tx_type === 'credit' ? parseFloat(logEntry.amount || 0) : -parseFloat(logEntry.amount || 0);

        if (snapshot) {
            // Update existing snapshot
            const newClosingBalance = parseFloat(snapshot.closing_balance || 0) + balanceChange;
            const newTransactionCount = snapshot.transaction_count + 1;
            const newCredits = parseFloat(snapshot.total_credits || 0) + (logEntry.tx_type === 'credit' ? parseFloat(logEntry.amount || 0) : 0);
            const newDebits = parseFloat(snapshot.total_debits || 0) + (logEntry.tx_type === 'debit' ? parseFloat(logEntry.amount || 0) : 0);

            await snapshot.update({
                closing_balance: newClosingBalance,
                cash_balance: newClosingBalance, // Simplified - in real system, track cash/bank separately
                transaction_count: newTransactionCount,
                total_credits: newCredits,
                total_debits: newDebits,
                calculation_hash: hashChainService.generateArrayHash([{
                    closing_balance: newClosingBalance,
                    transaction_count: newTransactionCount,
                    total_credits: newCredits,
                    total_debits: newDebits
                }]),
                source_transactions_hash: logEntry.current_hash
            }, { transaction: dbTransaction });

        } else {
            // Create new snapshot
            const previousBalance = await this.getPreviousBalance(
                logEntry.account_id,
                logEntry.ledger_head_id,
                snapshotDate
            );

            const newSnapshot = {
                snapshot_date: snapshotDate,
                account_id: logEntry.account_id,
                ledger_head_id: logEntry.ledger_head_id,
                opening_balance: previousBalance,
                closing_balance: previousBalance + balanceChange,
                cash_balance: previousBalance + balanceChange,
                bank_balance: 0,
                total_credits: logEntry.tx_type === 'credit' ? parseFloat(logEntry.amount || 0) : 0,
                total_debits: logEntry.tx_type === 'debit' ? parseFloat(logEntry.amount || 0) : 0,
                transaction_count: 1,
                calculation_hash: hashChainService.generateArrayHash([{
                    opening_balance: previousBalance,
                    closing_balance: previousBalance + balanceChange,
                    amount: logEntry.amount
                }]),
                source_transactions_hash: logEntry.current_hash
            };

            await db.BalanceSnapshot.create(newSnapshot, { transaction: dbTransaction });
        }
    }

    /**
     * Handle receipt booklet usage
     */
    async handleReceiptUsage(bookletId, receiptNumber, transaction) {
        try {
            console.log(`📝 Handling receipt usage: Booklet ${bookletId}, Receipt ${receiptNumber}`);

            // Get booklet and update pages_left
            const booklet = await db.Booklet.findByPk(bookletId, { transaction });
            if (!booklet) {
                throw new Error(`Booklet not found: ${bookletId}`);
            }

            // Remove the used receipt number from pages_left
            const updatedPagesLeft = booklet.pages_left.filter(page => page !== receiptNumber);

            await booklet.update({
                pages_left: updatedPagesLeft
            }, { transaction });

            console.log(`✅ Receipt ${receiptNumber} marked as used in booklet ${bookletId}`);

        } catch (error) {
            console.error('❌ Error handling receipt usage:', error);
            throw error;
        }
    }

    /**
     * Create audit trail entry
     */
    async createAuditTrail(logEntry, userContext, transaction) {
        // This could be expanded to create detailed audit logs
        console.log(`📝 Audit: Transaction ${logEntry.transaction_uuid} created by user ${userContext.userId}`);

        // In a full implementation, you might want to create an audit log entry here
        // await db.AuditLog.create({ ... }, { transaction });
    }

    /**
     * Calculate current balance for account/ledger head
     */
    async calculateCurrentBalance(accountId, ledgerHeadId, asOfDate = null) {
        // If we need historical balance (as of specific date), calculate from transaction logs
        if (asOfDate) {
            const whereCondition = {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                transaction_date: { [Op.lte]: asOfDate }
            };

            const result = await db.TransactionLog.sum('amount', {
                where: {
                    ...whereCondition,
                    tx_type: 'credit'
                }
            });

            const credits = result || 0;

            const debits = await db.TransactionLog.sum('amount', {
                where: {
                    ...whereCondition,
                    tx_type: 'debit'
                }
            }) || 0;

            return credits - debits;
        }

        // For current balance, get it directly from ledger head (more efficient)
        const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId);
        if (!ledgerHead) {
            throw new Error(`Ledger head not found: ${ledgerHeadId}`);
        }

        return parseFloat(ledgerHead.current_balance) || 0;
    }

    /**
     * Get previous balance for balance snapshot
     */
    async getPreviousBalance(accountId, ledgerHeadId, date) {
        const previousSnapshot = await db.BalanceSnapshot.findOne({
            where: {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                snapshot_date: { [Op.lt]: date }
            },
            order: [['snapshot_date', 'DESC']]
        });

        return previousSnapshot ? parseFloat(previousSnapshot.closing_balance) : 0;
    }

    /**
     * Get transactions for display
     */
    async getTransactionHistory(filters = {}) {
        const whereCondition = {};

        if (filters.account_id) whereCondition.account_id = filters.account_id;
        if (filters.ledger_head_id) whereCondition.ledger_head_id = filters.ledger_head_id;
        if (filters.tx_type) whereCondition.tx_type = filters.tx_type;
        if (filters.start_date) {
            whereCondition.transaction_date = { [Op.gte]: filters.start_date };
        }
        if (filters.end_date) {
            whereCondition.transaction_date = {
                ...whereCondition.transaction_date,
                [Op.lte]: filters.end_date
            };
        }

        const transactions = await db.TransactionLog.findAll({
            where: whereCondition,
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                },
                {
                    model: db.LedgerHead,
                    as: 'ledgerHead',
                    attributes: ['id', 'name', 'head_type']
                },
                {
                    model: db.User,
                    as: 'creator',
                    attributes: ['id', 'name', 'email']
                }
            ],
            order: [
                ['transaction_date', 'DESC'],
                ['transaction_time', 'DESC'],
                ['log_id', 'DESC']
            ],
            limit: filters.limit || 50,
            offset: filters.offset || 0
        });

        return transactions.map(tx => ({
            ...tx.toJSON(),
            display_info: tx.getDisplayInfo(),
            audit_summary: tx.getAuditSummary()
        }));
    }

    /**
     * Get balance summary
     */
    async getBalanceSummary(accountId, ledgerHeadId = null, asOfDate = null) {
        const date = asOfDate || new Date().toISOString().split('T')[0];

        if (ledgerHeadId) {
            // Single ledger head balance
            const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId);
            if (!ledgerHead) {
                throw new Error(`Ledger head not found: ${ledgerHeadId}`);
            }

            const balance = await this.calculateCurrentBalance(accountId, ledgerHeadId, date);
            return {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                ledger_head_name: ledgerHead.name,
                head_type: ledgerHead.head_type,
                balance,
                cash_balance: parseFloat(ledgerHead.cash_balance) || 0,
                bank_balance: parseFloat(ledgerHead.bank_balance) || 0,
                as_of_date: date
            };
        } else {
            // All ledger heads for account
            const ledgerHeads = await db.LedgerHead.findAll({
                where: { account_id: accountId },
                order: [['head_type', 'ASC'], ['name', 'ASC']]
            });

            const balances = await Promise.all(
                ledgerHeads.map(async (lh) => ({
                    ledger_head_id: lh.id,
                    ledger_head_name: lh.name,
                    head_type: lh.head_type,
                    balance: parseFloat(lh.current_balance) || 0,
                    cash_balance: parseFloat(lh.cash_balance) || 0,
                    bank_balance: parseFloat(lh.bank_balance) || 0
                }))
            );

            // Calculate totals properly for Islamic accounting
            const creditTotal = balances
                .filter(lh => lh.head_type === 'credit')
                .reduce((sum, lh) => sum + lh.balance, 0);

            const debitTotal = balances
                .filter(lh => lh.head_type === 'debit')
                .reduce((sum, lh) => sum + lh.balance, 0);

            return {
                account_id: accountId,
                as_of_date: date,
                ledger_heads: balances,
                credit_total: creditTotal,
                debit_total: debitTotal,
                net_balance: creditTotal - debitTotal
            };
        }
    }

    /**
     * Handle receipt usage - remove from booklet's available pages
     */
    async handleReceiptUsage(bookletId, receiptNumber, transaction) {
        const booklet = await db.Booklet.findByPk(bookletId, { transaction });

        if (!booklet) {
            throw new Error(`Booklet ${bookletId} not found`);
        }

        // Validate that the receipt number is available
        if (!booklet.pages_left || !booklet.pages_left.includes(receiptNumber)) {
            throw new Error(`Receipt ${receiptNumber} is not available in booklet ${bookletId}`);
        }

        // Remove the used receipt from pages_left
        const updatedPagesLeft = booklet.pages_left.filter(page => page !== receiptNumber);

        // Update booklet
        await booklet.update({
            pages_left: updatedPagesLeft,
            is_active: updatedPagesLeft.length > 0 // Mark inactive if no pages left
        }, { transaction });

        console.log(`✅ Receipt ${receiptNumber} used from booklet ${bookletId}. ${updatedPagesLeft.length} receipts remaining.`);
    }
}

module.exports = new ImmutableTransactionService();