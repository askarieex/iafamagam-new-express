const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Account extends Model {
    static associate(models) {
      // Define associations if needed in the future
    }
  }

  Account.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    opening_balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    closing_balance: {
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
    last_closed_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Last day of the most recently closed accounting period'
    }
  }, {
    sequelize,
    modelName: 'Account',
    tableName: 'accounts',
    timestamps: true,
    underscored: true,
    freezeTableName: true
  });

  return Account;
}; 