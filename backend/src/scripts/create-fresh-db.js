const { Client } = require('pg');
require('dotenv').config();

// Connect to PostgreSQL default database for admin operations
const adminClient = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres', // Default admin database
    password: 'AskerY786.@',
    port: 5432
});

async function createFreshDatabase() {
    console.log('Starting database creation script...');

    try {
        // Connect to postgres admin database
        console.log('Connecting to PostgreSQL...');
        await adminClient.connect();
        console.log('Connected to PostgreSQL');

        // Drop the existing database if it exists
        try {
            // Disconnect all users from the database
            console.log('Disconnecting all users from existing database...');
            await adminClient.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = 'iafaSoftware'
        AND pid <> pg_backend_pid();
      `);
            console.log('Users disconnected');

            // Drop the database
            console.log('Dropping existing database...');
            await adminClient.query('DROP DATABASE IF EXISTS "iafaSoftware";');
            console.log('Existing database dropped');
        } catch (error) {
            console.log('Note: Could not drop database (it may not exist yet):', error.message);
        }

        // Create a new database
        console.log('Creating fresh database...');
        await adminClient.query('CREATE DATABASE "iafaSoftware";');
        console.log('Fresh database "iafaSoftware" created successfully');

        console.log('Database creation completed');
    } catch (error) {
        console.error('Error in database creation process:', error);
    } finally {
        // Close the admin connection
        await adminClient.end();
        console.log('Database connection closed');
    }
}

// Run the function
createFreshDatabase(); 