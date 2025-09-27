'use strict';

/**
 * Migration: Create monthly_balance_summaries table
 *
 * This table stores opening and closing balance references for each ledger head
 * on a monthly basis to enable efficient monthly report generation while
 * maintaining balance continuity across months.
 *
 * Key Features:
 * - Tracks opening and closing balances for each ledger head per month
 * - Supports the real-time monthly reporting system
 * - Handles balance continuity for month-to-month transitions
 * - Provides reference points for backdated transaction recalculation
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('monthly_balance_summaries', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      ledger_head_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ledger_heads',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Reference to the ledger head'
      },
      account_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'accounts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Reference to the account'
      },
      month_year: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'First day of the month (e.g., 2024-04-01 for April 2024)'
      },
      opening_balance: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Balance at the start of the month'
      },
      closing_balance: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Balance at the end of the month'
      },
      total_credits: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total credit transactions during the month'
      },
      total_debits: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total debit transactions during the month'
      },
      transaction_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of transactions during the month'
      },
      is_finalized: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this month has been finalized (locked)'
      },
      last_calculated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this balance was last calculated'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create indexes only if they don't exist
    try {
      // Create unique constraint to ensure one balance summary per ledger head per account per month
      await queryInterface.addIndex('monthly_balance_summaries', {
        fields: ['ledger_head_id', 'account_id', 'month_year'],
        unique: true,
        name: 'unique_monthly_balance_summary'
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }

    try {
      // Create index for efficient querying by account and month
      await queryInterface.addIndex('monthly_balance_summaries', {
        fields: ['account_id', 'month_year'],
        name: 'idx_account_month'
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }

    try {
      // Create index for efficient querying by ledger head
      await queryInterface.addIndex('monthly_balance_summaries', {
        fields: ['ledger_head_id'],
        name: 'idx_ledger_head'
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }

    try {
      // Create index for finalized status queries
      await queryInterface.addIndex('monthly_balance_summaries', {
        fields: ['is_finalized'],
        name: 'idx_finalized_status'
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('monthly_balance_summaries');
  }
};