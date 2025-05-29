const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');

async function cleanDatabase() {
    try {
        // Check if accounts table exists
        const tables = await sequelize.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
            { type: QueryTypes.SELECT }
        );

        console.log('Existing tables:', tables.map(t => t.table_name));

        // Drop accounts table if it exists
        await sequelize.query('DROP TABLE IF EXISTS accounts CASCADE');
        console.log('Accounts table dropped successfully');

        // Exit the process
        process.exit(0);
    } catch (error) {
        console.error('Error cleaning database:', error);
        process.exit(1);
    }
}

// Run the function
cleanDatabase(); 