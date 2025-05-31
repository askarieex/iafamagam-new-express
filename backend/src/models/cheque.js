'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class Cheque extends Model {
        static associate(models) {
            Cheque.belongsTo(models.Transaction, {
                foreignKey: 'tx_id',
                as: 'transaction'
            });

            Cheque.belongsTo(models.Account, {
                foreignKey: 'account_id',
                as: 'account'
            });

            Cheque.belongsTo(models.LedgerHead, {
                foreignKey: 'ledger_head_id',
                as: 'ledgerHead'
            });
        }
    }

    Cheque.init({
        tx_id: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true,
            references: {
                model: 'transactions',
                key: 'id'
            }
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
        cheque_number: {
            type: DataTypes.STRING,
            allowNull: false
        },
        bank_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        issue_date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        due_date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('pending', 'cleared', 'cancelled'),
            defaultValue: 'pending',
            allowNull: false
        },
        clearing_date: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'Cheque',
        tableName: 'cheques',
        timestamps: true,
        underscored: true
    });

    return Cheque;
}; 