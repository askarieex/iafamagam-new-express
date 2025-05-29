const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class MonthlyLedgerBalance extends Model {
        static associate(models) {
            // Define associations
            MonthlyLedgerBalance.belongsTo(models.Account, {
                foreignKey: 'account_id',
                as: 'account'
            });

            MonthlyLedgerBalance.belongsTo(models.LedgerHead, {
                foreignKey: 'ledger_head_id',
                as: 'ledgerHead'
            });
        }
    }

    MonthlyLedgerBalance.init({
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
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
        month: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 12
            }
        },
        year: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        opening_balance: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        receipts: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Credits for the month'
        },
        payments: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Debits for the month'
        },
        closing_balance: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Calculated as opening_balance + receipts - payments'
        },
        cash_in_hand: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        cash_in_bank: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        sequelize,
        modelName: 'MonthlyLedgerBalance',
        tableName: 'monthly_ledger_balances',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['account_id', 'ledger_head_id', 'month', 'year'],
                name: 'monthly_ledger_balances_unique_constraint'
            }
        ]
    });

    return MonthlyLedgerBalance;
}; 