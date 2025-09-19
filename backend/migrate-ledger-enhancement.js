const db = require('./src/models');

async function runEnhancedLedgerMigration() {
  try {
    console.log('🚀 Running Enhanced Ledger Heads Migration...');
    
    const queryInterface = db.sequelize.getQueryInterface();
    
    // Check if columns already exist
    const tableDesc = await queryInterface.describeTable('ledger_heads');
    console.log('Current table structure:', Object.keys(tableDesc));
    
    // Add new columns one by one
    if (!tableDesc.dependency_type) {
      await queryInterface.addColumn('ledger_heads', 'dependency_type', {
        type: db.Sequelize.ENUM('independent', 'dependent', 'expense'),
        allowNull: false,
        defaultValue: 'independent'
      });
      console.log('✅ Added dependency_type column');
    }
    
    if (!tableDesc.is_restricted) {
      await queryInterface.addColumn('ledger_heads', 'is_restricted', {
        type: db.Sequelize.BOOLEAN,
        defaultValue: false
      });
      console.log('✅ Added is_restricted column');
    }
    
    if (!tableDesc.islamic_category) {
      await queryInterface.addColumn('ledger_heads', 'islamic_category', {
        type: db.Sequelize.STRING(100),
        allowNull: true
      });
      console.log('✅ Added islamic_category column');
    }
    
    if (!tableDesc.spending_rules) {
      await queryInterface.addColumn('ledger_heads', 'spending_rules', {
        type: db.Sequelize.TEXT,
        allowNull: true
      });
      console.log('✅ Added spending_rules column');
    }
    
    if (!tableDesc.is_active) {
      await queryInterface.addColumn('ledger_heads', 'is_active', {
        type: db.Sequelize.BOOLEAN,
        defaultValue: true
      });
      console.log('✅ Added is_active column');
    }
    
    if (!tableDesc.sort_order) {
      await queryInterface.addColumn('ledger_heads', 'sort_order', {
        type: db.Sequelize.INTEGER,
        defaultValue: 0
      });
      console.log('✅ Added sort_order column');
    }
    
    // Create dependencies table
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('ledger_head_dependencies')) {
      await queryInterface.createTable('ledger_head_dependencies', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: db.Sequelize.INTEGER
        },
        credit_head_id: {
          type: db.Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'ledger_heads',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        debit_head_id: {
          type: db.Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'ledger_heads',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        restriction_type: {
          type: db.Sequelize.ENUM('allowed', 'prohibited', 'conditional'),
          allowNull: false,
          defaultValue: 'allowed'
        },
        conditions: {
          type: db.Sequelize.TEXT,
          allowNull: true
        },
        max_percentage: {
          type: db.Sequelize.DECIMAL(5, 2),
          allowNull: true
        },
        notes: {
          type: db.Sequelize.TEXT,
          allowNull: true
        },
        created_by: {
          type: db.Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id'
          }
        },
        is_active: {
          type: db.Sequelize.BOOLEAN,
          defaultValue: true
        },
        createdAt: {
          allowNull: false,
          type: db.Sequelize.DATE
        },
        updatedAt: {
          allowNull: false,
          type: db.Sequelize.DATE
        }
      });
      
      // Add indexes
      await queryInterface.addIndex('ledger_head_dependencies', ['credit_head_id']);
      await queryInterface.addIndex('ledger_head_dependencies', ['debit_head_id']);
      
      console.log('✅ Created ledger_head_dependencies table with indexes');
    }
    
    // Update existing records with appropriate categories
    console.log('📝 Updating existing ledger heads with Islamic categories...');
    
    // First, set dependency_type based on head_type
    await queryInterface.sequelize.query(`
      UPDATE ledger_heads 
      SET dependency_type = CASE 
        WHEN head_type = 'credit' THEN 'independent'
        WHEN head_type = 'debit' THEN 'expense'
        ELSE 'independent'
      END
      WHERE dependency_type = 'independent' AND head_type IS NOT NULL
    `);
    
    // Set Islamic categories based on names
    const categoryUpdates = [
      { pattern: '%donation%', category: 'General Donation', restricted: false },
      { pattern: '%zakat%', category: 'Zakat', restricted: true },
      { pattern: '%sahm%imam%', category: 'Sahm-e-Imam', restricted: true },
      { pattern: '%sahm%sadat%', category: 'Sahm-e-Sadat', restricted: true },
      { pattern: '%fee%', category: 'Fees', restricted: false },
      { pattern: '%cc%', category: 'Coaching Center', restricted: false },
      { pattern: '%dd%', category: 'General', restricted: false }
    ];
    
    for (const update of categoryUpdates) {
      await queryInterface.sequelize.query(`
        UPDATE ledger_heads 
        SET 
          islamic_category = :category,
          is_restricted = :restricted
        WHERE LOWER(name) LIKE :pattern AND islamic_category IS NULL
      `, {
        replacements: {
          pattern: update.pattern,
          category: update.category,
          restricted: update.restricted
        }
      });
    }
    
    // Set default category for remaining heads
    await queryInterface.sequelize.query(`
      UPDATE ledger_heads 
      SET islamic_category = CASE 
        WHEN head_type = 'debit' THEN 'Expense'
        ELSE 'General'
      END
      WHERE islamic_category IS NULL
    `);
    
    console.log('✅ Updated existing ledger heads with Islamic categories');
    console.log('🎉 Enhanced Ledger Heads Migration Completed Successfully!');
    
    // Show summary
    const summary = await queryInterface.sequelize.query(`
      SELECT 
        dependency_type,
        islamic_category,
        is_restricted,
        COUNT(*) as count
      FROM ledger_heads 
      GROUP BY dependency_type, islamic_category, is_restricted
      ORDER BY dependency_type, islamic_category
    `, { type: db.Sequelize.QueryTypes.SELECT });
    
    console.log('\n📊 Migration Summary:');
    console.table(summary);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
runEnhancedLedgerMigration()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });