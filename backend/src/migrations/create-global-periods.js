'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('global_periods', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      month: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 12
        },
        comment: 'Month (1-12)'
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 2000,
          max: 2100
        },
        comment: 'Year (e.g., 2025)'
      },
      status: {
        type: Sequelize.ENUM('open', 'closed'),
        allowNull: false,
        defaultValue: 'closed',
        comment: 'Global period status - affects all accounts simultaneously'
      },
      opened_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when period was opened'
      },
      closed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when period was closed'
      },
      opened_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'User who opened this period'
      },
      closed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'User who closed this period'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Optional notes about period opening/closing'
      },
      auto_opened: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'True if period was auto-opened by system'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes
    await queryInterface.addIndex('global_periods', ['month', 'year'], {
      unique: true,
      name: 'unique_global_period'
    });

    await queryInterface.addIndex('global_periods', ['status'], {
      name: 'idx_global_status'
    });

    await queryInterface.addIndex('global_periods', ['status', 'month', 'year'], {
      name: 'idx_global_status_period'
    });

    // Insert current month as open if no periods exist
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    await queryInterface.bulkInsert('global_periods', [{
      month: currentMonth,
      year: currentYear,
      status: 'open',
      opened_at: now,
      auto_opened: true,
      notes: 'Auto-opened current period during system initialization',
      createdAt: now,
      updatedAt: now
    }]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('global_periods');
  }
};