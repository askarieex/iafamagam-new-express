const path = require('path');
const { Sequelize } = require('sequelize');
const migration = require('./src/migrations/20250530_update_cheques_transaction_id');

// Get config based on environment
const env = process.env.NODE_ENV || 'development';
const config = require('./config/config.json')[env];

// Create database connection using config
const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
        host: config.host,
        dialect: config.dialect,
        logging: console.log
    }
);

// Set up the queryInterface
const queryInterface = sequelize.getQueryInterface();

async function runMigration() {
    try {
        console.log('Running migration to update cheques.transaction_id from INTEGER to UUID...');
        await migration.up(queryInterface, Sequelize);
        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

runMigration(); 