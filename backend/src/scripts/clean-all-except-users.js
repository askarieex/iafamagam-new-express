const { sequelize } = require('../models');

async function cleanAllTablesExceptUsers() {
    const transaction = await sequelize.transaction();
    
    try {
        console.log('🧹 Starting database cleanup...');
        
        // Get all table names from public schema
        const [tables] = await sequelize.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public';
        `, { transaction });
        
        // Filter out the users table and system tables
        const tablesToClean = tables
            .map(t => t.tablename)
            .filter(name => 
                name.toLowerCase() !== 'users' && 
                name.toLowerCase() !== 'sequelizemeta' &&
                !name.startsWith('pg_')
            );
        
        console.log('📋 Tables to clean:', tablesToClean);
        
        // Truncate all tables in a single statement
        if (tablesToClean.length > 0) {
            const truncateStatement = `TRUNCATE TABLE ${tablesToClean.map(t => `"${t}"`).join(', ')} CASCADE;`;
            console.log('🗑️  Cleaning tables with:', truncateStatement);
            await sequelize.query(truncateStatement, { transaction });
        }
        
        // Commit the transaction
        await transaction.commit();
        
        console.log('✅ Database cleanup completed successfully!');
        console.log('🔒 Users table was preserved.');
        
    } catch (error) {
        // Rollback on error
        await transaction.rollback();
        console.error('❌ Error during cleanup:', error);
        throw error;
        
    } finally {
        // Always close the connection
        await sequelize.close();
    }
}

// Run the cleanup if called directly
if (require.main === module) {
    cleanAllTablesExceptUsers()
        .catch(err => {
            console.error('Failed to clean database:', err);
            process.exit(1);
        });
} 