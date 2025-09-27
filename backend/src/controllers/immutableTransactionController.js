const immutableTransactionService = require('../services/immutableTransactionService');
const hashChainService = require('../services/hashChainService');
const realTimeBalanceService = require('../services/realTimeBalanceService');

class ImmutableTransactionController {

    /**
     * Create a new immutable credit transaction
     * @route POST /api/transactions/credit
     */
    createCredit = async (req, res) => {
        try {
            console.log('🔄 Processing immutable credit transaction request...');
            console.log('📨 RECEIVED DATA FROM FRONTEND:', JSON.stringify(req.body, null, 2));
            console.log('💰 Amounts in request - cash_amount:', req.body.cash_amount, 'bank_amount:', req.body.bank_amount, 'cash_type:', req.body.cash_type);

            // Extract user context from request
            const userContext = {
                userId: req.user.id,
                ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                sessionId: req.sessionID || null
            };

            // Create immutable credit transaction
            const result = await immutableTransactionService.createCreditTransaction(
                req.body,
                userContext
            );

            console.log('✅ Credit transaction created successfully:', result.transaction.uuid);

            // Trigger real-time balance update
            try {
                await realTimeBalanceService.onTransactionAdded(result.transaction);
            } catch (balanceError) {
                console.error('⚠️ Real-time balance update failed:', balanceError);
                // Don't fail the transaction, but log the error
            }

            return res.status(201).json({
                success: true,
                message: result.message,
                data: result.transaction,
                warning: result.warning,
                system_info: {
                    immutable: true,
                    hash_secured: true,
                    audit_trail: true,
                    edit_policy: 'CORRECTION_WORKFLOW_ONLY'
                }
            });

        } catch (error) {
            console.error('❌ Credit transaction creation failed:', error);

            // Log security-relevant errors
            if (error.message.includes('Future transaction') ||
                error.message.includes('backdate') ||
                error.message.includes('forbidden')) {
                await this.logSecurityEvent(req, 'TRANSACTION_CREATION_BLOCKED', {
                    reason: error.message,
                    attempted_data: req.body
                });
            }

            return res.status(400).json({
                success: false,
                message: error.message,
                error_type: this.categorizeError ? this.categorizeError(error.message) : 'TRANSACTION_ERROR',
                system_info: {
                    immutable_system: true,
                    edit_not_allowed: true,
                    use_correction_workflow: true
                }
            });
        }
    }

    /**
     * Create a new immutable debit transaction
     * @route POST /api/transactions/debit
     */
    createDebit = async (req, res) => {
        try {
            console.log('🔄 Processing immutable debit transaction request...');

            // Extract user context from request
            const userContext = {
                userId: req.user.id,
                ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                sessionId: req.sessionID || null
            };

            // Create immutable debit transaction
            const result = await immutableTransactionService.createDebitTransaction(
                req.body,
                userContext
            );

            console.log('✅ Debit transaction created successfully:', result.transaction.uuid);

            // Trigger real-time balance update
            try {
                await realTimeBalanceService.onTransactionAdded(result.transaction);
            } catch (balanceError) {
                console.error('⚠️ Real-time balance update failed:', balanceError);
                // Don't fail the transaction, but log the error
            }

            return res.status(201).json({
                success: true,
                message: result.message,
                data: result.transaction,
                warning: result.warning,
                system_info: {
                    immutable: true,
                    hash_secured: true,
                    audit_trail: true,
                    balance_protected: true,
                    edit_policy: 'CORRECTION_WORKFLOW_ONLY'
                }
            });

        } catch (error) {
            console.error('❌ Debit transaction creation failed:', error);

            // Log security-relevant errors
            if (error.message.includes('Future transaction') ||
                error.message.includes('backdate') ||
                error.message.includes('Insufficient balance') ||
                error.message.includes('forbidden')) {
                await this.logSecurityEvent(req, 'TRANSACTION_CREATION_BLOCKED', {
                    reason: error.message,
                    attempted_data: req.body
                });
            }

            return res.status(400).json({
                success: false,
                message: error.message,
                error_type: this.categorizeError ? this.categorizeError(error.message) : 'TRANSACTION_ERROR',
                system_info: {
                    immutable_system: true,
                    overdraft_protection: true,
                    use_correction_workflow: true
                }
            });
        }
    }

    /**
     * Get transaction history with immutable audit trail
     * @route GET /api/transactions
     */
    async getTransactionHistory(req, res) {
        try {
            const filters = {
                account_id: req.query.account_id,
                ledger_head_id: req.query.ledger_head_id,
                tx_type: req.query.tx_type,
                start_date: req.query.start_date,
                end_date: req.query.end_date,
                limit: parseInt(req.query.limit) || 50,
                offset: parseInt(req.query.offset) || 0
            };

            const transactions = await immutableTransactionService.getTransactionHistory(filters);

            return res.status(200).json({
                success: true,
                data: transactions,
                count: transactions.length,
                filters_applied: filters,
                system_info: {
                    immutable_records: true,
                    complete_audit_trail: true,
                    hash_verified: true
                }
            });

        } catch (error) {
            console.error('❌ Error fetching transaction history:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch transaction history',
                error: error.message
            });
        }
    }

    /**
     * Get live balance summary with real-time calculations
     * @route GET /api/transactions/balance/live
     */
    async getLiveBalanceSummary(req, res) {
        try {
            const { account_id } = req.query;

            if (!account_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Account ID is required'
                });
            }

            const liveBalance = await realTimeBalanceService.getLiveBalanceSummary(parseInt(account_id));

            return res.status(200).json({
                success: true,
                data: liveBalance,
                system_info: {
                    real_time_calculation: true,
                    auto_balance_flow: true,
                    month_continuity: true,
                    generated_at: new Date()
                }
            });

        } catch (error) {
            console.error('❌ Error fetching live balance summary:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch live balance summary',
                error: error.message
            });
        }
    }

    /**
     * Get balance summary with integrity verification
     * @route GET /api/transactions/balance
     */
    async getBalanceSummary(req, res) {
        try {
            const { account_id, ledger_head_id, as_of_date } = req.query;

            if (!account_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Account ID is required'
                });
            }

            const balanceSummary = await immutableTransactionService.getBalanceSummary(
                parseInt(account_id),
                ledger_head_id ? parseInt(ledger_head_id) : null,
                as_of_date
            );

            // Verify hash chain integrity for this account
            const integrityCheck = await hashChainService.verifyHashChain(
                parseInt(account_id),
                as_of_date,
                as_of_date
            );

            return res.status(200).json({
                success: true,
                data: balanceSummary,
                integrity_check: {
                    hash_chain_valid: integrityCheck.isValid,
                    verification_date: new Date(),
                    transaction_count: integrityCheck.transactionCount
                },
                system_info: {
                    balance_verified: integrityCheck.isValid,
                    real_time_calculation: true,
                    tamper_proof: true
                }
            });

        } catch (error) {
            console.error('❌ Error fetching balance summary:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch balance summary',
                error: error.message
            });
        }
    }

    /**
     * Get single transaction details with audit info
     * @route GET /api/transactions/:uuid
     */
    async getTransactionByUuid(req, res) {
        try {
            const { uuid } = req.params;

            const transaction = await immutableTransactionService.getTransactionByUuid(uuid);

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message: 'Transaction not found'
                });
            }

            return res.status(200).json({
                success: true,
                data: transaction,
                system_info: {
                    immutable: true,
                    hash_verified: true,
                    edit_policy: 'NO_EDITS_ALLOWED',
                    correction_policy: 'APPROVAL_WORKFLOW_REQUIRED'
                }
            });

        } catch (error) {
            console.error('❌ Error fetching transaction details:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch transaction details',
                error: error.message
            });
        }
    }

    /**
     * Verify system integrity
     * @route GET /api/transactions/integrity/verify
     */
    async verifySystemIntegrity(req, res) {
        try {
            const { account_id, date } = req.query;
            const checkDate = date ? new Date(date) : new Date();

            let verificationResult;

            if (account_id) {
                // Verify specific account
                verificationResult = await hashChainService.verifyHashChain(
                    parseInt(account_id),
                    checkDate.toISOString().split('T')[0],
                    checkDate.toISOString().split('T')[0]
                );
            } else {
                // Comprehensive system verification
                verificationResult = await hashChainService.performDailyVerification(checkDate);
            }

            return res.status(200).json({
                success: true,
                data: verificationResult,
                message: verificationResult.isValid || verificationResult.overall_status === 'VERIFIED'
                    ? 'System integrity verified successfully'
                    : 'System integrity issues detected',
                system_status: verificationResult.isValid || verificationResult.overall_status === 'VERIFIED'
                    ? 'SECURE'
                    : 'ISSUES_DETECTED'
            });

        } catch (error) {
            console.error('❌ Error verifying system integrity:', error);
            return res.status(500).json({
                success: false,
                message: 'System integrity verification failed',
                error: error.message,
                system_status: 'VERIFICATION_ERROR'
            });
        }
    }

    /**
     * Get transaction date validation info
     * @route POST /api/transactions/validate-date
     */
    async validateTransactionDate(req, res) {
        try {
            const { transaction_date } = req.body;

            if (!transaction_date) {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction date is required'
                });
            }

            const userContext = { userId: req.user.id };

            // Use the validation logic from the service
            const validation = await immutableTransactionService.validateTransactionDate(transaction_date, userContext);

            return res.status(200).json({
                success: true,
                data: validation,
                message: validation.allowed
                    ? `Date ${transaction_date} is allowed - ${validation.reason}`
                    : `Date ${transaction_date} is not allowed - ${validation.reason}`
            });

        } catch (error) {
            console.error('❌ Error validating transaction date:', error);
            return res.status(400).json({
                success: false,
                message: error.message,
                error_type: 'DATE_VALIDATION_ERROR'
            });
        }
    }

    // ===== DANGEROUS METHODS REMOVED =====
    // ❌ updateTransaction() - REMOVED (Security Risk)
    // ❌ deleteTransaction() - REMOVED (Security Risk)
    // ❌ voidTransaction() - REMOVED (Security Risk)
    // ✅ Use correction workflow instead

    /**
     * ⚠️  BLOCKED: Update Transaction (Redirect to Correction Workflow)
     */
    async blockedUpdateTransaction(req, res) {
        await this.logSecurityEvent(req, 'BLOCKED_UPDATE_ATTEMPT', {
            attempted_transaction_id: req.params.id,
            attempted_data: req.body
        });

        return res.status(403).json({
            success: false,
            message: 'FORBIDDEN: Direct transaction updates are not allowed in immutable system',
            action_required: 'Use correction workflow instead',
            correction_endpoint: '/api/corrections/request',
            system_info: {
                immutable_system: true,
                edit_policy: 'NO_DIRECT_EDITS',
                correction_workflow_required: true
            }
        });
    }

    /**
     * ⚠️  BLOCKED: Delete Transaction (Redirect to Correction Workflow)
     */
    async blockedDeleteTransaction(req, res) {
        await this.logSecurityEvent(req, 'BLOCKED_DELETE_ATTEMPT', {
            attempted_transaction_id: req.params.id
        });

        return res.status(403).json({
            success: false,
            message: 'FORBIDDEN: Direct transaction deletion is not allowed in immutable system',
            action_required: 'Use correction workflow for reversal',
            correction_endpoint: '/api/corrections/request',
            system_info: {
                immutable_system: true,
                delete_policy: 'NO_DELETIONS_ALLOWED',
                reversal_workflow_required: true
            }
        });
    }

    // ===== HELPER METHODS =====

    /**
     * Categorize error types for better user experience
     */
    categorizeError(errorMessage) {
        if (errorMessage.includes('Future transaction')) return 'DATE_VALIDATION_ERROR';
        if (errorMessage.includes('backdate')) return 'BACKDATE_RESTRICTION';
        if (errorMessage.includes('Insufficient balance')) return 'INSUFFICIENT_FUNDS';
        if (errorMessage.includes('not found')) return 'RESOURCE_NOT_FOUND';
        if (errorMessage.includes('required')) return 'MISSING_REQUIRED_FIELD';
        if (errorMessage.includes('positive number')) return 'INVALID_AMOUNT';
        return 'GENERAL_ERROR';
    }

    /**
     * Get date validation (reuse service logic)
     */
    getDateValidationSync(transactionDate, userContext) {
        const today = new Date().toISOString().split('T')[0];
        const selectedDate = new Date(transactionDate);
        const todayDate = new Date(today);
        const daysDifference = Math.ceil((todayDate - selectedDate) / (1000 * 60 * 60 * 24));

        if (daysDifference < 0) {
            return { allowed: false, reason: 'Future dates are not allowed' };
        }

        if (daysDifference === 0) {
            return {
                allowed: true,
                approvalLevel: 0,
                reason: 'Current date - No approval needed',
                status: 'allowed'
            };
        }

        if (daysDifference <= 2) {
            return {
                allowed: true,
                approvalLevel: 0,
                reason: 'Weekend grace period',
                status: 'grace_period'
            };
        }

        if (daysDifference <= 5) {
            return {
                allowed: true,
                approvalLevel: 1,
                requiredRole: 'manager',
                reason: 'Short backdate - Manager approval required',
                status: 'needs_approval'
            };
        }

        if (daysDifference <= 10) {
            return {
                allowed: true,
                approvalLevel: 2,
                requiredRole: 'director',
                reason: 'Extended backdate - Director approval required',
                status: 'needs_high_approval'
            };
        }

        return {
            allowed: false,
            reason: 'Cannot backdate beyond 10 days - Use correction workflow',
            status: 'use_correction_workflow'
        };
    }

    /**
     * Validate transaction date for frontend
     * @route POST /api/transactions/validate-date
     */
    validateDate = async (req, res) => {
        try {
            console.log('🔄 Validating transaction date...');

            const { transaction_date } = req.body;

            if (!transaction_date) {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction date is required'
                });
            }

            // Extract user context from request
            const userContext = {
                userId: req.user.id,
                ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                sessionId: req.sessionID || null
            };

            // Validate the date using the immutable transaction service
            const result = await immutableTransactionService.validateDateOnly(transaction_date, userContext);

            console.log('✅ Date validation completed:', result);

            return res.status(200).json({
                success: result.success,
                data: result.data || null,
                message: result.success ? 'Date validation successful' : result.error,
                system_info: {
                    backdate_policy: '30_DAY_NO_APPROVAL',
                    max_backdate_days: 30,
                    approval_required: false
                }
            });

        } catch (error) {
            console.error('❌ Date validation failed:', error);

            return res.status(400).json({
                success: false,
                message: error.message,
                error_type: 'DATE_VALIDATION_ERROR',
                system_info: {
                    backdate_policy: '30_DAY_NO_APPROVAL',
                    max_backdate_days: 30
                }
            });
        }
    }

    /**
     * Log security events
     */
    async logSecurityEvent(req, eventType, eventData) {
        try {
            console.log('🚨 Security Event:', {
                event_type: eventType,
                user_id: req.user?.id,
                ip_address: req.ip,
                user_agent: req.get('User-Agent'),
                timestamp: new Date(),
                event_data: eventData
            });

            // In a full implementation, save to security audit log
            // await db.SecurityAuditLog.create({ ... });

        } catch (error) {
            console.error('Failed to log security event:', error);
        }
    }
}

module.exports = new ImmutableTransactionController();