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