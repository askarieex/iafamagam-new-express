'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if cash_balance column exists before adding
    const tableDesc = await queryInterface.describeTable('ledger_heads');

    if (!tableDesc.cash_balance) {
      await queryInterface.addColumn('ledger_heads', 'cash_balance', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      });
    }

    if (!tableDesc.bank_balance) {
      await queryInterface.addColumn('ledger_heads', 'bank_balance', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      });
    }

    // Set existing current_balance to cash_balance for all records (only if column was just created)
    if (!tableDesc.cash_balance) {
      await queryInterface.sequelize.query(`
        UPDATE ledger_heads
        SET cash_balance = current_balance
        WHERE current_balance != 0
      `);
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove the columns in down migration
    await queryInterface.removeColumn('ledger_heads', 'cash_balance');
    await queryInterface.removeColumn('ledger_heads', 'bank_balance');
  }
};
