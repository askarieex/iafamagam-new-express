'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new fields to ledger_heads table for Islamic accounting dependencies
    await queryInterface.addColumn('ledger_heads', 'dependency_type', {
      type: Sequelize.ENUM('independent', 'dependent', 'expense'),
      allowNull: false,
      defaultValue: 'independent',
      comment: 'Independent: general funds, Dependent: restricted funds, Expense: debit heads'
    });

    await queryInterface.addColumn('ledger_heads', 'is_restricted', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      comment: 'True for Sahm-e-Imam, Zakat, etc. that have spending restrictions'
    });

    await queryInterface.addColumn('ledger_heads', 'islamic_category', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Category like Sahm-e-Imam, Sahm-e-Sadat, Zakat, General, etc.'
    });

    await queryInterface.addColumn('ledger_heads', 'spending_rules', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'JSON or text describing spending rules and restrictions'
    });

    await queryInterface.addColumn('ledger_heads', 'is_active', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      comment: 'Whether this ledger head is active'
    });

    await queryInterface.addColumn('ledger_heads', 'sort_order', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      comment: 'Display order in lists'
    });

    // Create ledger head dependencies table for credit-debit relationships
    await queryInterface.createTable('ledger_head_dependencies', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      credit_head_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ledger_heads',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Credit head that can fund the debit head'
      },
      debit_head_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ledger_heads',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Debit head that can be funded by the credit head'
      },
      restriction_type: {
        type: Sequelize.ENUM('allowed', 'prohibited', 'conditional'),
        allowNull: false,
        defaultValue: 'allowed',
        comment: 'Type of relationship between credit and debit heads'
      },
      conditions: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Conditions for conditional relationships'
      },
      max_percentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Maximum percentage of credit head that can be used for this debit head'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Additional notes about this dependency relationship'
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether this dependency rule is active'
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

    // Add indexes for performance
    await queryInterface.addIndex('ledger_head_dependencies', ['credit_head_id'], {
      name: 'idx_credit_head_dependencies'
    });

    await queryInterface.addIndex('ledger_head_dependencies', ['debit_head_id'], {
      name: 'idx_debit_head_dependencies'
    });

    await queryInterface.addIndex('ledger_head_dependencies', ['credit_head_id', 'debit_head_id'], {
      unique: true,
      name: 'unique_credit_debit_dependency'
    });

    await queryInterface.addIndex('ledger_heads', ['dependency_type'], {
      name: 'idx_ledger_dependency_type'
    });

    await queryInterface.addIndex('ledger_heads', ['is_active'], {
      name: 'idx_ledger_is_active'
    });

    // Insert some common Islamic accounting categories
    const now = new Date();
    
    // Update existing heads to have proper dependency types based on their current head_type
    await queryInterface.sequelize.query(`
      UPDATE ledger_heads 
      SET 
        dependency_type = CASE 
          WHEN head_type = 'credit' THEN 'independent'
          WHEN head_type = 'debit' THEN 'expense'
          ELSE 'independent'
        END,
        islamic_category = CASE 
          WHEN LOWER(name) LIKE '%donation%' THEN 'General Donation'
          WHEN LOWER(name) LIKE '%zakat%' THEN 'Zakat'
          WHEN LOWER(name) LIKE '%sahm%imam%' THEN 'Sahm-e-Imam'
          WHEN LOWER(name) LIKE '%sahm%sadat%' THEN 'Sahm-e-Sadat'
          WHEN LOWER(name) LIKE '%fee%' THEN 'Fees'
          WHEN head_type = 'debit' THEN 'Expense'
          ELSE 'General'
        END,
        is_restricted = CASE 
          WHEN LOWER(name) LIKE '%sahm%' THEN true
          WHEN LOWER(name) LIKE '%zakat%' THEN true
          ELSE false
        END,
        updated_at = '${now.toISOString()}'
    `);

  },

  async down(queryInterface, Sequelize) {
    // Drop the dependencies table
    await queryInterface.dropTable('ledger_head_dependencies');

    // Remove added columns from ledger_heads
    await queryInterface.removeColumn('ledger_heads', 'sort_order');
    await queryInterface.removeColumn('ledger_heads', 'is_active');
    await queryInterface.removeColumn('ledger_heads', 'spending_rules');
    await queryInterface.removeColumn('ledger_heads', 'islamic_category');
    await queryInterface.removeColumn('ledger_heads', 'is_restricted');
    await queryInterface.removeColumn('ledger_heads', 'dependency_type');
  }
};