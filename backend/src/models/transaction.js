const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class Transaction extends Model {
        static associate(models) {
            // Define associations
            Transaction.belongsTo(models.Account, {
                foreignKey: 'account_id',
                as: 'account'
            });

            Transaction.belongsTo(models.LedgerHead, {
                foreignKey: 'ledger_head_id',
                as: 'ledgerHead'
            });

            Transaction.belongsTo(models.Donor, {
                foreignKey: 'donor_id',
                as: 'donor'
            });

            Transaction.belongsTo(models.Booklet, {
                foreignKey: 'booklet_id',
                as: 'booklet'
            });

            Transaction.hasMany(models.TransactionItem, {
                foreignKey: 'transaction_id',
                as: 'items'
            });
        }
    }

    Transaction.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
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
        donor_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'donors',
                key: 'id'
            }
        },
        booklet_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'booklets',
                key: 'id'
            }
        },
        receipt_no: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        amount: {
            type: DataTypes.DECIMAL(14, 2),
            allowNull: false,
            validate: {
                isDecimal: true,
                min: 0.01
            }
        },
        cash_amount: {
            type: DataTypes.DECIMAL(14, 2),
            allowNull: true,
            defaultValue: 0,
            validate: {
                isDecimal: true
            }
        },
        bank_amount: {
            type: DataTypes.DECIMAL(14, 2),
            allowNull: true,
            defaultValue: 0,
            validate: {
                isDecimal: true
            }
        },
        tx_type: {
            type: DataTypes.ENUM('credit', 'debit'),
            allowNull: false,
            validate: {
                isIn: [['credit', 'debit']]
            }
        },
        cash_type: {
            type: DataTypes.ENUM('cash', 'bank', 'upi', 'card', 'netbank', 'cheque', 'multiple'),
            allowNull: false,
            validate: {
                isIn: [['cash', 'bank', 'upi', 'card', 'netbank', 'cheque', 'multiple']]
            }
        },
        tx_date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'Transaction',
        tableName: 'transactions',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['booklet_id', 'receipt_no'],
                name: 'unique_booklet_receipt'
            }
        ]
    });

    return Transaction;
}; 