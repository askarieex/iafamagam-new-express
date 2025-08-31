/**
 * Manual script to create accounting_periods table
 * Run this if the migration conflicts with existing schema
 */

const db = require('./src/models');

async function createAccountingPeriodsTable() {
    try {
        console.log('🔄 Creating accounting_periods table...');

        // Check if table already exists
        const tableExists = await db.sequelize.getQueryInterface().showAllTables()
            .then(tables => tables.includes('accounting_periods'));

        if (tableExists) {
            console.log('✅ accounting_periods table already exists');
            return true;
        }

        // Create the table using the migration
        const migration = require('./src/migrations/create-accounting-periods.js');
        await migration.up(db.sequelize.getQueryInterface(), db.Sequelize);

        console.log('✅ accounting_periods table created successfully');
        return true;

    } catch (error) {
        console.error('❌ Error creating accounting_periods table:', error);
        return false;
    }
}

// Run the function
createAccountingPeriodsTable()
    .then((success) => {
        if (success) {
            console.log('🎉 Setup completed successfully');
        } else {
            console.log('❌ Setup failed');
        }
        process.exit(success ? 0 : 1);
    })
    .catch((error) => {
        console.error('❌ Unexpected error:', error);
        process.exit(1);
    });