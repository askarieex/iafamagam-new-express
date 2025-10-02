const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class TransactionLog extends Model {
        static associate(models) {
            // Association with Account
            TransactionLog.belongsTo(models.Account, {
                foreignKey: 'account_id',
                as: 'account'
            });

            // Association with LedgerHead
            TransactionLog.belongsTo(models.LedgerHead, {
                foreignKey: 'ledger_head_id',
                as: 'ledgerHead'
            });

            // Association with User (creator)
            TransactionLog.belongsTo(models.User, {
                foreignKey: 'created_by',
                as: 'creator'
            });

            // Association with User (approver)
            TransactionLog.belongsTo(models.User, {
                foreignKey: 'approved_by',
                as: 'approver'
            });

            // Self-reference for corrections
            TransactionLog.belongsTo(models.TransactionLog, {
                foreignKey: 'reference_log_id',
                as: 'originalTransaction'
            });

            // Corrections referring to this transaction
            TransactionLog.hasMany(models.TransactionLog, {
                foreignKey: 'reference_log_id',
                as: 'corrections'
            });

            // Association with Booklet (optional)
            TransactionLog.belongsTo(models.Booklet, {
                foreignKey: 'booklet_id',
                as: 'booklet'
            });

            // Association with Donor (optional)
            TransactionLog.belongsTo(models.Donor, {
                foreignKey: 'donor_id',
                as: 'donor'
            });

        }

        /**
         * Check if this transaction is the original or a correction
         */
        isOriginalTransaction() {
            return this.action_type === 'CREATE' && !this.reference_log_id;
        }

        /**
         * Check if this transaction is a correction
         */
        isCorrection() {
            return this.reference_log_id !== null;
        }

        /**
         * Get effective amount (considering if this is a reversal)
         */
        getEffectiveAmount() {
            if (this.action_type === 'REVERSE' || this.action_type === 'VOID') {
                return this.tx_type === 'credit' ? -this.amount : this.amount;
            }
            return this.tx_type === 'credit' ? this.amount : -this.amount;
        }

        /**
         * Check if transaction requires approval
         */
        needsApproval() {
            return this.requires_approval && !this.approved_by;
        }

        /**
         * Get transaction status
         */
        getStatus() {
            if (this.action_type === 'VOID') return 'voided';
            if (this.needsApproval()) return 'pending_approval';
            if (this.approved_by) return 'approved';
            return 'completed';
        }

        /**
         * Get display information
         */
        getDisplayInfo() {
            const actionTypes = {
                'CREATE': 'Transaction Created',
                'CORRECT_AMOUNT': 'Amount Corrected',
                'CORRECT_DATE': 'Date Corrected',
                'REVERSE': 'Transaction Reversed',
                'VOID': 'Transaction Voided'
            };

            return {
                actionDisplay: actionTypes[this.action_type] || this.action_type,
                isOriginal: this.isOriginalTransaction(),
                isCorrection: this.isCorrection(),
                effectiveAmount: this.getEffectiveAmount(),
                status: this.getStatus(),
                formattedAmount: this.formatCurrency(this.amount),
                formattedDate: this.formatDate(this.transaction_date)
            };
        }

        /**
         * Format currency for display
         */
        formatCurrency(amount) {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                minimumFractionDigits: 2
            }).format(amount || 0);
        }

        /**
         * Format date for display
         */
        formatDate(date) {
            return new Date(date).toLocaleDateString('en-IN');
        }

        /**
         * Generate audit summary
         */
        getAuditSummary() {
            return {
                transaction_id: this.transaction_uuid,
                action: this.action_type,
                amount: this.amount,
                date: this.transaction_date,
                created_by: this.created_by,
                created_at: this.created_at,
                ip_address: this.client_ip,
                hash: this.current_hash,
                is_correction: this.isCorrection(),
                reference_transaction: this.reference_log_id
            };
        }
    }

    TransactionLog.init({
        log_id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        transaction_uuid: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: DataTypes.UUIDV4,
            unique: true
        },
        log_sequence: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        action_type: {
            type: DataTypes.ENUM('CREATE', 'CORRECT_AMOUNT', 'CORRECT_DATE', 'REVERSE', 'VOID'),
            allowNull: false,
            defaultValue: 'CREATE'
        },
        account_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'accounts',
                key: 'id'
            }
        },
        ledger_head_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'ledger_heads',
                key: 'id'
            }
        },
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            validate: {
                min: 0.01
            }
        },
        cash_amount: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0,
            validate: {
                min: 0
            }
        },
        bank_amount: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0,
            validate: {
                min: 0
            }
        },
        tx_type: {
            type: DataTypes.ENUM('credit', 'debit'),
            allowNull: false
        },
        cash_type: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        transaction_date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            validate: {
                isDate: true,
                notFuture(value) {
                    const today = new Date().toISOString().split('T')[0];
                    if (value > today) {
                        throw new Error('Transaction date cannot be in the future');
                    }
                }
            }
        },
        transaction_time: {
            type: DataTypes.TIME,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        date_override_reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
            validate: {
                notEmpty: true,
                len: [3, 1000]
            }
        },
        correction_reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        source_ledger_head_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'ledger_heads',
                key: 'id'
            }
        },
        reference_log_id: {
            type: DataTypes.BIGINT,
            allowNull: true,
            references: {
                model: 'transaction_log',
                key: 'log_id'
            }
        },
        original_log_id: {
            type: DataTypes.BIGINT,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        client_ip: {
            type: DataTypes.INET,
            allowNull: false
        },
        user_agent: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        session_id: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        previous_hash: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        current_hash: {
            type: DataTypes.STRING(64),
            allowNull: false
        },
        daily_hash: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        requires_approval: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        approval_level: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            validate: {
                min: 0,
                max: 3
            }
        },
        approved_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        approved_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        approval_notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        system_validated: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        validation_errors: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        booklet_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'booklets',
                key: 'id'
            }
        },
        donor_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'donors',
                key: 'id'
            }
        },
        receipt_number: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'TransactionLog',
        tableName: 'transaction_log',
        timestamps: false, // We manage timestamps manually
        underscored: true,
        freezeTableName: true,

        // Add hooks to prevent updates and deletes
        hooks: {
            beforeUpdate: () => {
                throw new Error('FORBIDDEN: TransactionLog records are immutable and cannot be updated');
            },
            beforeDestroy: () => {
                throw new Error('FORBIDDEN: TransactionLog records are immutable and cannot be deleted');
            }
        },

        // Indexes
        indexes: [
            {
                fields: ['account_id', 'transaction_date']
            },
            {
                fields: ['ledger_head_id', 'transaction_date']
            },
            {
                fields: ['transaction_uuid']
            },
            {
                fields: ['current_hash']
            },
            {
                fields: ['requires_approval'],
                where: {
                    requires_approval: true,
                    approved_by: null
                }
            }
        ]
    });

    return TransactionLog;
};