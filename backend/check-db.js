const db = require('./src/models');

async function checkDatabase() {
    try {
        console.log('🔍 Checking database structure...');

        // Get all tables
        const tables = await db.sequelize.getQueryInterface().showAllTables();
        console.log('📋 Existing tables:', tables);

        // Check if specific tables exist
        const requiredTables = ['users', 'accounts', 'accounting_periods'];
        for (const table of requiredTables) {
            if (tables.includes(table)) {
                console.log(`✅ ${table} - exists`);
            } else {
                console.log(`❌ ${table} - missing`);
            }
        }

        // Check for the enum type
        try {
            const result = await db.sequelize.query(
                "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_accounting_periods_status')",
                { type: db.sequelize.QueryTypes.SELECT }
            );
            console.log('🔧 enum_accounting_periods_status exists:', result[0].exists);
        } catch (error) {
            console.log('❌ Error checking enum:', error.message);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Database check failed:', error);
        process.exit(1);
    }
}

checkDatabase();