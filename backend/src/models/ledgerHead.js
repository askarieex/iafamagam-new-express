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