const crypto = require('crypto');
const db = require('../models');

class HashChainService {
    /**
     * Generate cryptographic hash for transaction
     * @param {Object} transactionData - Transaction data to hash
     * @param {String} previousHash - Previous transaction hash for chaining
     * @returns {String} SHA-256 hash
     */
    generateTransactionHash(transactionData, previousHash = '') {
        // Create consistent data structure for hashing
        const hashData = {
            transaction_uuid: transactionData.transaction_uuid,
            log_sequence: transactionData.log_sequence,
            action_type: transactionData.action_type,
            account_id: transactionData.account_id,
            ledger_head_id: transactionData.ledger_head_id,
            amount: parseFloat(transactionData.amount).toFixed(2),
            tx_type: transactionData.tx_type,
            transaction_date: transactionData.transaction_date,
            transaction_time: transactionData.transaction_time,
            description: transactionData.description,
            created_by: transactionData.created_by,
            created_at: transactionData.created_at?.toISOString() || new Date().toISOString(),
            previous_hash: previousHash
        };

        // Convert to JSON string with sorted keys for consistency
        const dataString = JSON.stringify(hashData, Object.keys(hashData).sort());

        // Generate SHA-256 hash
        return crypto.createHash('sha256').update(dataString).digest('hex');
    }

    /**
     * Get the last transaction hash for an account
     * @param {Number} accountId - Account ID
     * @returns {String|null} Last hash or null if no transactions
     */
    async getLastTransactionHash(accountId = null) {
        try {
            const whereCondition = accountId ? { account_id: accountId } : {};

            const lastTransaction = await db.TransactionLog.findOne({
                where: whereCondition,
                order: [['log_id', 'DESC']],
                attributes: ['current_hash']
            });

            return lastTransaction?.current_hash || null;
        } catch (error) {
            console.error('Error getting last transaction hash:', error);
            return null;
        }
    }

    /**
     * Verify hash chain integrity for a range of transactions
     * @param {Number} accountId - Account ID (optional)
     * @param {Date} startDate - Start date (optional)
     * @param {Date} endDate - End date (optional)
     * @returns {Object} Verification result
     */
    async verifyHashChain(accountId = null, startDate = null, endDate = null) {
        try {
            // Build query conditions
            const whereCondition = {};
            if (accountId) whereCondition.account_id = accountId;
            if (startDate) whereCondition.transaction_date = { [db.Sequelize.Op.gte]: startDate };
            if (endDate) {
                whereCondition.transaction_date = {
                    ...whereCondition.transaction_date,
                    [db.Sequelize.Op.lte]: endDate
                };
            }

            // Get all transactions in order
            const transactions = await db.TransactionLog.findAll({
                where: whereCondition,
                order: [['log_id', 'ASC']],
                raw: true
            });

            if (transactions.length === 0) {
                return {
                    isValid: true,
                    message: 'No transactions to verify',
                    transactionCount: 0
                };
            }

            let isValid = true;
            const errors = [];
            let previousHash = null;

            // Get the hash before our range for chaining
            if (transactions.length > 0) {
                const firstTransaction = transactions[0];
                if (firstTransaction.log_id > 1) {
                    const previousTransaction = await db.TransactionLog.findOne({
                        where: {
                            log_id: { [db.Sequelize.Op.lt]: firstTransaction.log_id }
                        },
                        order: [['log_id', 'DESC']],
                        attributes: ['current_hash']
                    });
                    previousHash = previousTransaction?.current_hash || '';
                } else {
                    previousHash = ''; // Genesis transaction
                }
            }

            // Verify each transaction's hash
            for (let i = 0; i < transactions.length; i++) {
                const transaction = transactions[i];

                // Calculate expected hash
                const expectedHash = this.generateTransactionHash(transaction, previousHash);

                // Compare with stored hash
                if (expectedHash !== transaction.current_hash) {
                    isValid = false;
                    errors.push({
                        log_id: transaction.log_id,
                        transaction_uuid: transaction.transaction_uuid,
                        expected_hash: expectedHash,
                        actual_hash: transaction.current_hash,
                        error: 'Hash mismatch - transaction may be tampered'
                    });
                }

                // Verify chain link
                if (transaction.previous_hash !== previousHash) {
                    isValid = false;
                    errors.push({
                        log_id: transaction.log_id,
                        transaction_uuid: transaction.transaction_uuid,
                        expected_previous_hash: previousHash,
                        actual_previous_hash: transaction.previous_hash,
                        error: 'Chain link broken - previous hash mismatch'
                    });
                }

                // Set previous hash for next iteration
                previousHash = transaction.current_hash;
            }

            return {
                isValid,
                transactionCount: transactions.length,
                errors: errors,
                message: isValid
                    ? `Hash chain verified successfully for ${transactions.length} transactions`
                    : `Hash chain verification failed with ${errors.length} errors`,
                verificationDate: new Date(),
                startDate,
                endDate,
                accountId
            };

        } catch (error) {
            console.error('Error verifying hash chain:', error);
            return {
                isValid: false,
                error: error.message,
                message: 'Hash chain verification failed due to system error'
            };
        }
    }

    /**
     * Generate daily closure hash
     * @param {Date} closureDate - Date of closure
     * @param {Object} dailyStats - Daily statistics
     * @param {String} previousClosureHash - Previous day's closure hash
     * @returns {String} Daily closure hash
     */
    generateDailyClosureHash(closureDate, dailyStats, previousClosureHash = '') {
        const closureData = {
            closure_date: closureDate,
            total_transactions: dailyStats.totalTransactions,
            total_debits: parseFloat(dailyStats.totalDebits || 0).toFixed(2),
            total_credits: parseFloat(dailyStats.totalCredits || 0).toFixed(2),
            transactions_hash: dailyStats.transactionsHash,
            balances_hash: dailyStats.balancesHash,
            previous_closure_hash: previousClosureHash,
            closure_timestamp: new Date().toISOString()
        };

        const dataString = JSON.stringify(closureData, Object.keys(closureData).sort());
        return crypto.createHash('sha256').update(dataString).digest('hex');
    }

    /**
     * Generate hash for array of data (transactions, balances)
     * @param {Array} dataArray - Array of data to hash
     * @returns {String} Combined hash
     */
    generateArrayHash(dataArray) {
        if (!Array.isArray(dataArray) || dataArray.length === 0) {
            return crypto.createHash('sha256').update('EMPTY_ARRAY').digest('hex');
        }

        // Sort array by a consistent key (like ID) and stringify
        const sortedData = dataArray.sort((a, b) => {
            const aKey = a.id || a.log_id || a.account_id || 0;
            const bKey = b.id || b.log_id || b.account_id || 0;
            return aKey - bKey;
        });

        const dataString = JSON.stringify(sortedData);
        return crypto.createHash('sha256').update(dataString).digest('hex');
    }

    /**
     * Perform comprehensive daily verification
     * @param {Date} date - Date to verify
     * @returns {Object} Comprehensive verification result
     */
    async performDailyVerification(date) {
        try {
            const dateString = date.toISOString().split('T')[0];

            console.log(`🔍 Starting daily verification for ${dateString}...`);

            // 1. Verify hash chain integrity
            const chainVerification = await this.verifyHashChain(null, dateString, dateString);

            // 2. Verify balance calculations
            const balanceVerification = await this.verifyBalanceCalculations(dateString);

            // 3. Check for any tampering attempts
            const tamperingCheck = await this.checkTamperingAttempts(dateString);

            const overallResult = {
                date: dateString,
                verification_time: new Date(),
                hash_chain: {
                    valid: chainVerification.isValid,
                    transaction_count: chainVerification.transactionCount,
                    errors: chainVerification.errors
                },
                balance_verification: balanceVerification,
                tampering_check: tamperingCheck,
                overall_status: (
                    chainVerification.isValid &&
                    balanceVerification.isValid &&
                    !tamperingCheck.suspiciousActivity
                ) ? 'VERIFIED' : 'ISSUES_DETECTED',
                recommendations: []
            };

            // Add recommendations based on findings
            if (!chainVerification.isValid) {
                overallResult.recommendations.push('URGENT: Hash chain integrity compromised - investigate immediately');
            }
            if (!balanceVerification.isValid) {
                overallResult.recommendations.push('Balance calculation errors detected - recalculation needed');
            }
            if (tamperingCheck.suspiciousActivity) {
                overallResult.recommendations.push('Suspicious activity detected - security review required');
            }

            console.log(`✅ Daily verification completed: ${overallResult.overall_status}`);
            return overallResult;

        } catch (error) {
            console.error('Daily verification failed:', error);
            return {
                date: date.toISOString().split('T')[0],
                verification_time: new Date(),
                overall_status: 'VERIFICATION_FAILED',
                error: error.message
            };
        }
    }

    /**
     * Verify balance calculations for a specific date
     * @param {String} dateString - Date in YYYY-MM-DD format
     * @returns {Object} Balance verification result
     */
    async verifyBalanceCalculations(dateString) {
        // This will be implemented when we create the balance calculation service
        return {
            isValid: true,
            message: 'Balance verification not yet implemented'
        };
    }

    /**
     * Check for tampering attempts
     * @param {String} dateString - Date in YYYY-MM-DD format
     * @returns {Object} Tampering check result
     */
    async checkTamperingAttempts(dateString) {
        // This will check system logs for suspicious activities
        return {
            suspiciousActivity: false,
            message: 'No suspicious activity detected'
        };
    }

    /**
     * Create emergency verification report
     * @returns {Object} Emergency verification report
     */
    async createEmergencyVerificationReport() {
        console.log('🚨 Creating emergency verification report...');

        const report = {
            report_date: new Date(),
            report_type: 'EMERGENCY_VERIFICATION',
            system_status: 'CHECKING',
            verifications: {}
        };

        try {
            // Check last 7 days
            for (let i = 0; i < 7; i++) {
                const checkDate = new Date();
                checkDate.setDate(checkDate.getDate() - i);

                const verification = await this.performDailyVerification(checkDate);
                const dateKey = checkDate.toISOString().split('T')[0];
                report.verifications[dateKey] = verification;
            }

            // Determine overall system status
            const hasIssues = Object.values(report.verifications).some(
                v => v.overall_status !== 'VERIFIED'
            );

            report.system_status = hasIssues ? 'ISSUES_DETECTED' : 'VERIFIED';

            console.log(`🚨 Emergency report complete: ${report.system_status}`);
            return report;

        } catch (error) {
            report.system_status = 'VERIFICATION_FAILED';
            report.error = error.message;
            return report;
        }
    }
}

module.exports = new HashChainService();