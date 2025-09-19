const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class LedgerHead extends Model {
        static associate(models) {
            // Define association with Account
            LedgerHead.belongsTo(models.Account, {
                foreignKey: 'account_id',
                as: 'account'
            });

            // Add association with Transaction
            LedgerHead.hasMany(models.Transaction, {
                foreignKey: 'ledger_head_id',
                as: 'transactions'
            });

            // Dependencies where this is the credit head
            LedgerHead.hasMany(models.LedgerHeadDependency, {
                foreignKey: 'credit_head_id',
                as: 'creditDependencies'
            });

            // Dependencies where this is the debit head
            LedgerHead.hasMany(models.LedgerHeadDependency, {
                foreignKey: 'debit_head_id',
                as: 'debitDependencies'
            });

            // Many-to-many relationship: debit heads this credit can fund
            LedgerHead.belongsToMany(models.LedgerHead, {
                through: models.LedgerHeadDependency,
                foreignKey: 'credit_head_id',
                otherKey: 'debit_head_id',
                as: 'fundableDebitHeads'
            });

            // Many-to-many relationship: credit heads that can fund this debit
            LedgerHead.belongsToMany(models.LedgerHead, {
                through: models.LedgerHeadDependency,
                foreignKey: 'debit_head_id', 
                otherKey: 'credit_head_id',
                as: 'fundingCreditHeads'
            });
        }

        /**
         * Get Islamic category display name
         */
        getIslamicCategoryDisplay() {
            const categoryMap = {
                'Sahm-e-Imam': 'سہم امام',
                'Sahm-e-Sadat': 'سہم سادات',
                'Zakat': 'زکوٰۃ',
                'General Donation': 'عام چندہ',
                'Fees': 'فیس',
                'Expense': 'اخراجات',
                'General': 'عام'
            };
            return categoryMap[this.islamic_category] || this.islamic_category;
        }

        /**
         * Get dependency type display
         */
        getDependencyTypeDisplay() {
            const typeMap = {
                'independent': 'Independent Fund',
                'dependent': 'Restricted Fund',
                'expense': 'Expense Head'
            };
            return typeMap[this.dependency_type] || this.dependency_type;
        }

        /**
         * Check if this credit head can fund a specific debit head
         */
        async canFund(debitHeadId, amount = 0) {
            if (this.head_type !== 'credit') {
                return { allowed: false, reason: 'Only credit heads can fund expenses' };
            }

            return await this.sequelize.models.LedgerHeadDependency.canCreditFundDebit(
                this.id, 
                debitHeadId, 
                amount
            );
        }

        /**
         * Get all debit heads this credit head can fund
         */
        async getFundableDebitHeads() {
            if (this.head_type !== 'credit') {
                return [];
            }

            return await this.sequelize.models.LedgerHeadDependency.getDebitHeadsForCredit(this.id);
        }

        /**
         * Get all credit heads that can fund this debit head
         */
        async getFundingCreditHeads() {
            if (this.head_type !== 'debit') {
                return [];
            }

            return await this.sequelize.models.LedgerHeadDependency.getCreditHeadsForDebit(this.id);
        }

        /**
         * Get balance breakdown
         */
        getBalanceBreakdown() {
            return {
                total: parseFloat(this.current_balance) || 0,
                cash: parseFloat(this.cash_balance) || 0,
                bank: parseFloat(this.bank_balance) || 0,
                percentage: {
                    cash: this.current_balance > 0 ? (this.cash_balance / this.current_balance * 100) : 0,
                    bank: this.current_balance > 0 ? (this.bank_balance / this.current_balance * 100) : 0
                }
            };
        }
    }

    LedgerHead.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        account_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'accounts',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        head_type: {
            type: DataTypes.ENUM('debit', 'credit'),
            allowNull: false,
            validate: {
                isIn: [['debit', 'credit']]
            }
        },
        current_balance: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        cash_balance: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        bank_balance: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        dependency_type: {
            type: DataTypes.ENUM('independent', 'dependent', 'expense'),
            allowNull: false,
            defaultValue: 'independent',
            validate: {
                isIn: [['independent', 'dependent', 'expense']]
            }
        },
        is_restricted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        islamic_category: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        spending_rules: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        sort_order: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        sequelize,
        modelName: 'LedgerHead',
        tableName: 'ledger_heads',
        timestamps: true,
        underscored: true,
        freezeTableName: true
    });

    return LedgerHead;
}; 