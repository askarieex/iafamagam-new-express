'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add source_ledger_head_id column to track which ledger is the source for debit transactions
    await queryInterface.addColumn('transaction_log', 'source_ledger_head_id', {
      type: Sequelize.INTEGER,
      allowNull: true, // Can be null for credit transactions
      references: {
        model: 'ledger_heads',
        key: 'id'
      },
      comment: 'For debit transactions, tracks which credit ledger the money comes from'
    });

    // Add index for performance when querying source deductions
    await queryInterface.addIndex('transaction_log', ['source_ledger_head_id', 'transaction_date'], {
      name: 'idx_tx_log_source_ledger_date'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the index first
    await queryInterface.removeIndex('transaction_log', 'idx_tx_log_source_ledger_date');

    // Remove the column
    await queryInterface.removeColumn('transaction_log', 'source_ledger_head_id');
  }
};