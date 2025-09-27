'use strict';

/**
 * Migration: Add cash_amount and bank_amount to monthly_balance_summaries
 *
 * This migration adds cash_amount and bank_amount fields to track the
 * cash and bank components of ledger head balances for monthly reports.
 * This fixes the issue where debit transactions weren't properly showing
 * cash/bank breakdowns in the Financial Report.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add cash_amount column
    await queryInterface.addColumn('monthly_balance_summaries', 'cash_amount', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Cash amount portion of the closing balance'
    });

    // Add bank_amount column
    await queryInterface.addColumn('monthly_balance_summaries', 'bank_amount', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Bank amount portion of the closing balance'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the added columns
    await queryInterface.removeColumn('monthly_balance_summaries', 'cash_amount');
    await queryInterface.removeColumn('monthly_balance_summaries', 'bank_amount');
  }
};