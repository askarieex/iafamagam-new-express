'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Create ledger_head_dependencies table if it doesn't exist
      const dependencyTableExists = await queryInterface.showAllTables().then(tables => 
        tables.includes('ledger_head_dependencies'));
      
      if (!dependencyTableExists) {
        await queryInterface.createTable('ledger_head_dependencies', {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
          },
          credit_head_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: 'ledger_heads',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          debit_head_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: 'ledger_heads',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          restriction_type: {
            type: Sequelize.ENUM('allowed', 'prohibited', 'conditional'),
            allowNull: false,
            defaultValue: 'allowed'
          },
          conditions: {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'JSON string containing conditional rules'
          },
          max_percentage: {
            type: Sequelize.DECIMAL(5, 2),
            allowNull: true,
            validate: {
              min: 0,
              max: 100
            },
            comment: 'Maximum percentage of credit head balance that can fund this debit head'
          },
          notes: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          created_by: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
              model: 'users',
              key: 'id'
            },
            onUpdate: 'SET NULL',
            onDelete: 'SET NULL'
          },
          is_active: {
            type: Sequelize.BOOLEAN,
            defaultValue: true
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('NOW')
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('NOW')
          }
        }, { transaction });

        // Create indexes for better performance
        await queryInterface.addIndex('ledger_head_dependencies', 
          ['credit_head_id', 'debit_head_id'], 
          { 
            unique: true, 
            name: 'unique_credit_debit_dependency',
            transaction 
          }
        );

        await queryInterface.addIndex('ledger_head_dependencies', 
          ['credit_head_id'], 
          { 
            name: 'idx_credit_head_dependencies',
            transaction 
          }
        );

        await queryInterface.addIndex('ledger_head_dependencies', 
          ['debit_head_id'], 
          { 
            name: 'idx_debit_head_dependencies',
            transaction 
          }
        );
      }

      // Check if ledger_heads table has new columns, add if missing
      const ledgerHeadsDesc = await queryInterface.describeTable('ledger_heads');
      
      if (!ledgerHeadsDesc.dependency_type) {
        await queryInterface.addColumn('ledger_heads', 'dependency_type', {
          type: Sequelize.ENUM('independent', 'dependent', 'expense'),
          allowNull: false,
          defaultValue: 'independent',
          comment: 'Type of dependency: independent (can fund any), dependent (restricted), expense (expenditure head)'
        }, { transaction });
      }

      if (!ledgerHeadsDesc.is_restricted) {
        await queryInterface.addColumn('ledger_heads', 'is_restricted', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          comment: 'Whether this head has Islamic spending restrictions'
        }, { transaction });
      }

      if (!ledgerHeadsDesc.islamic_category) {
        await queryInterface.addColumn('ledger_heads', 'islamic_category', {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: 'Islamic category for proper fund management'
        }, { transaction });
      }

      if (!ledgerHeadsDesc.spending_rules) {
        await queryInterface.addColumn('ledger_heads', 'spending_rules', {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Specific rules for spending from this head (for restricted funds)'
        }, { transaction });
      }

      if (!ledgerHeadsDesc.is_active) {
        await queryInterface.addColumn('ledger_heads', 'is_active', {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        }, { transaction });
      }

      if (!ledgerHeadsDesc.sort_order) {
        await queryInterface.addColumn('ledger_heads', 'sort_order', {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          comment: 'Order for displaying ledger heads'
        }, { transaction });
      }

      // Update existing ledger heads with proper dependency types
      await queryInterface.bulkUpdate('ledger_heads', {
        dependency_type: 'expense'
      }, {
        head_type: 'debit'
      }, { transaction });

      await queryInterface.bulkUpdate('ledger_heads', {
        dependency_type: 'independent'
      }, {
        head_type: 'credit',
        dependency_type: null
      }, { transaction });

      // Set Islamic categories based on existing data
      const islamicCategoryUpdates = [
        // Credit heads
        { pattern: '%donation%', category: 'General Donation', type: 'credit' },
        { pattern: '%sahm%imam%', category: 'Sahm-e-Imam', type: 'credit' },
        { pattern: '%sahm%sadat%', category: 'Sahm-e-Sadat', type: 'credit' },
        { pattern: '%zakat%', category: 'Zakat', type: 'credit' },
        { pattern: '%fee%', category: 'Fees', type: 'credit' },
        
        // Debit heads
        { pattern: '%salary%', category: 'Salaries', type: 'debit' },
        { pattern: '%expense%', category: 'Expense', type: 'debit' },
        { pattern: '%utility%', category: 'Utilities', type: 'debit' },
        { pattern: '%education%', category: 'Education', type: 'debit' },
        { pattern: '%religious%', category: 'Religious', type: 'debit' }
      ];

      for (const update of islamicCategoryUpdates) {
        await queryInterface.sequelize.query(
          `UPDATE ledger_heads 
           SET islamic_category = :category 
           WHERE LOWER(name) LIKE :pattern 
           AND head_type = :type 
           AND islamic_category IS NULL`,
          {
            replacements: {
              category: update.category,
              pattern: update.pattern,
              type: update.type
            },
            transaction
          }
        );
      }

      // Set default categories for remaining heads
      await queryInterface.bulkUpdate('ledger_heads', {
        islamic_category: 'General'
      }, {
        head_type: 'credit',
        islamic_category: null
      }, { transaction });

      await queryInterface.bulkUpdate('ledger_heads', {
        islamic_category: 'Expense'
      }, {
        head_type: 'debit',
        islamic_category: null
      }, { transaction });

      // Mark restricted funds based on Islamic categories
      const restrictedCategories = ['Sahm-e-Imam', 'Sahm-e-Sadat', 'Zakat'];
      for (const category of restrictedCategories) {
        await queryInterface.bulkUpdate('ledger_heads', {
          is_restricted: true,
          dependency_type: 'dependent'
        }, {
          islamic_category: category
        }, { transaction });
      }

      // Create default dependency rules for restricted funds
      const restrictedHeads = await queryInterface.sequelize.query(
        `SELECT id, name, islamic_category FROM ledger_heads 
         WHERE is_restricted = true AND head_type = 'credit'`,
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      const expenseHeads = await queryInterface.sequelize.query(
        `SELECT id, name, islamic_category FROM ledger_heads 
         WHERE head_type = 'debit'`,
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      // Create specific dependency rules based on Islamic principles
      const dependencyRules = [];
      
      for (const creditHead of restrictedHeads) {
        for (const debitHead of expenseHeads) {
          let restrictionType = 'prohibited'; // Default to prohibited for restricted funds
          let notes = '';

          // Define Islamic spending rules
          if (creditHead.islamic_category === 'Zakat') {
            // Zakat can only be spent on specific categories
            if (['Religious', 'Education'].includes(debitHead.islamic_category)) {
              restrictionType = 'allowed';
              notes = 'Zakat funds can be used for religious and educational purposes';
            }
          } else if (creditHead.islamic_category === 'Sahm-e-Imam') {
            // Sahm-e-Imam has specific usage rules
            if (['Religious', 'Education', 'Salaries'].includes(debitHead.islamic_category)) {
              restrictionType = 'conditional';
              notes = 'Sahm-e-Imam usage subject to religious authority approval';
            }
          } else if (creditHead.islamic_category === 'Sahm-e-Sadat') {
            // Sahm-e-Sadat for descendants of Prophet
            if (['Religious', 'Education'].includes(debitHead.islamic_category)) {
              restrictionType = 'conditional';
              notes = 'Sahm-e-Sadat for supporting Sadat families and religious activities';
            }
          }

          if (restrictionType !== 'prohibited') {
            dependencyRules.push({
              credit_head_id: creditHead.id,
              debit_head_id: debitHead.id,
              restriction_type: restrictionType,
              notes: notes,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            });
          }
        }
      }

      // Insert dependency rules in batches to avoid overwhelming the database
      if (dependencyRules.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < dependencyRules.length; i += batchSize) {
          const batch = dependencyRules.slice(i, i + batchSize);
          await queryInterface.bulkInsert('ledger_head_dependencies', batch, { 
            transaction,
            ignoreDuplicates: true 
          });
        }
      }

      await transaction.commit();
      console.log('Enhanced ledger system migration completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove added columns from ledger_heads
      const ledgerHeadsDesc = await queryInterface.describeTable('ledger_heads');
      
      const columnsToRemove = ['dependency_type', 'is_restricted', 'islamic_category', 'spending_rules', 'is_active', 'sort_order'];
      
      for (const column of columnsToRemove) {
        if (ledgerHeadsDesc[column]) {
          await queryInterface.removeColumn('ledger_heads', column, { transaction });
        }
      }

      // Drop the dependencies table
      await queryInterface.dropTable('ledger_head_dependencies', { transaction });

      await transaction.commit();
      console.log('Enhanced ledger system migration rolled back successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('Migration rollback failed:', error);
      throw error;
    }
  }
};