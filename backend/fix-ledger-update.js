const db = require('./src/models');

async function fixLedgerUpdate() {
  try {
    console.log('🔧 Fixing ledger heads dependency type...');
    
    // Update dependency_type with proper enum casting
    await db.sequelize.query(`
      UPDATE ledger_heads 
      SET dependency_type = CASE 
        WHEN head_type = 'credit' THEN 'independent'::enum_ledger_heads_dependency_type
        WHEN head_type = 'debit' THEN 'expense'::enum_ledger_heads_dependency_type
        ELSE 'independent'::enum_ledger_heads_dependency_type
      END
    `);
    
    console.log('✅ Updated dependency_type with proper casting');
    
    // Create dependencies table if it doesn't exist
    const queryInterface = db.sequelize.getQueryInterface();
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
          allowNull: true
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
      
      console.log('✅ Created ledger_head_dependencies table');
      
      // Add indexes
      await queryInterface.addIndex('ledger_head_dependencies', ['credit_head_id']);
      await queryInterface.addIndex('ledger_head_dependencies', ['debit_head_id']);
      
      console.log('✅ Added indexes to dependencies table');
    }
    
    // Update Islamic categories
    const updates = [
      { pattern: 'donation', category: 'General Donation', restricted: false },
      { pattern: 'zakat', category: 'Zakat', restricted: true },
      { pattern: 'imam', category: 'Sahm-e-Imam', restricted: true },
      { pattern: 'sadat', category: 'Sahm-e-Sadat', restricted: true },
      { pattern: 'fee', category: 'Fees', restricted: false }
    ];
    
    for (const update of updates) {
      await db.sequelize.query(`
        UPDATE ledger_heads 
        SET 
          islamic_category = :category,
          is_restricted = :restricted
        WHERE LOWER(name) LIKE :pattern
      `, {
        replacements: {
          pattern: `%${update.pattern}%`,
          category: update.category,
          restricted: update.restricted
        }
      });
    }
    
    // Set defaults for remaining heads
    await db.sequelize.query(`
      UPDATE ledger_heads 
      SET islamic_category = CASE 
        WHEN dependency_type = 'expense' THEN 'Expense'
        ELSE 'General'
      END
      WHERE islamic_category IS NULL
    `);
    
    console.log('✅ Updated Islamic categories');
    
    // Show summary
    const summary = await db.sequelize.query(`
      SELECT 
        dependency_type,
        head_type,
        islamic_category,
        is_restricted,
        COUNT(*) as count
      FROM ledger_heads 
      GROUP BY dependency_type, head_type, islamic_category, is_restricted
      ORDER BY dependency_type, head_type
    `, { type: db.Sequelize.QueryTypes.SELECT });
    
    console.log('\n📊 Updated Ledger Heads Summary:');
    console.table(summary);
    
    console.log('🎉 Ledger heads enhancement completed successfully!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    throw error;
  }
}

fixLedgerUpdate()
  .then(() => {
    console.log('✅ Fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fix failed:', error);
    process.exit(1);
  });