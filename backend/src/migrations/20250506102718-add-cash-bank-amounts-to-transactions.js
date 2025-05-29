'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add cash_amount column
    await queryInterface.addColumn('transactions', 'cash_amount', {
      type: Sequelize.DECIMAL(14, 2),
      allowNull: true,
      defaultValue: 0
    });

    // Add bank_amount column
    await queryInterface.addColumn('transactions', 'bank_amount', {
      type: Sequelize.DECIMAL(14, 2),
      allowNull: true,
      defaultValue: 0
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove columns if needed to rollback
    await queryInterface.removeColumn('transactions', 'cash_amount');
    await queryInterface.removeColumn('transactions', 'bank_amount');
  }
};
