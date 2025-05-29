'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add cash_balance column
    await queryInterface.addColumn('ledger_heads', 'cash_balance', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00
    });

    // Add bank_balance column
    await queryInterface.addColumn('ledger_heads', 'bank_balance', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00
    });

    // Set existing current_balance to cash_balance for all records
    await queryInterface.sequelize.query(`
      UPDATE ledger_heads
      SET cash_balance = current_balance
      WHERE current_balance != 0
    `);
  },

  async down(queryInterface, Sequelize) {
    // Remove the columns in down migration
    await queryInterface.removeColumn('ledger_heads', 'cash_balance');
    await queryInterface.removeColumn('ledger_heads', 'bank_balance');
  }
};
