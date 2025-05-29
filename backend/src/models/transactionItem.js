const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class TransactionItem extends Model {
        static associate(models) {
            // Define associations
            TransactionItem.belongsTo(models.Transaction, {
                foreignKey: 'transaction_id',
                as: 'transaction'
            });

            TransactionItem.belongsTo(models.LedgerHead, {
                foreignKey: 'ledger_head_id',
                as: 'ledgerHead'
            });
        }
    }

    TransactionItem.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        transaction_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'transactions',
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
            type: DataTypes.DECIMAL(14, 2),
            allowNull: false,
            validate: {
                isDecimal: true,
                min: 0.01
            }
        },
        side: {
            type: DataTypes.CHAR(1),
            allowNull: false,
            validate: {
                isIn: [['+', '-']]
            }
        }
    }, {
        sequelize,
        modelName: 'TransactionItem',
        tableName: 'transaction_items',
        timestamps: true,
        underscored: true
    });

    return TransactionItem;
}; 