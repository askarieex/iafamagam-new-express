const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class BankAccount extends Model {
        static associate(models) {
            // Define associations if needed in the future
        }
    }

    BankAccount.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        bank_name: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        acc_number: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        ifsc: {
            type: DataTypes.STRING,
            allowNull: true
        },
        bank_balance: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00
        }
    }, {
        sequelize,
        modelName: 'BankAccount',
        tableName: 'bank_accounts',
        timestamps: true,
        underscored: true,
        freezeTableName: true
    });

    return BankAccount;
}; 