const { Pool } = require('pg');
require('dotenv').config();

// Create a new pool with the connection parameters
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'iafaSoftware',
    password: 'AskerY786.@',
    port: 5432
});

console.log('Connecting to database...');

async function fixDatabase() {
    try {
        // Drop accounts table if it exists
        console.log('Dropping accounts table if it exists...');
        await pool.query('DROP TABLE IF EXISTS accounts CASCADE');
        console.log('Accounts table dropped');

        // Create the accounts table with all required columns
        console.log('Creating accounts table...');
        await pool.query(`
      CREATE TABLE accounts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        opening_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        closing_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        cash_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        bank_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
        console.log('Accounts table created successfully');

        // Insert a test account
        console.log('Inserting test account...');
        await pool.query(`
      INSERT INTO accounts (name, opening_balance, closing_balance, cash_balance, bank_balance)
      VALUES ('Test Account', 1000.00, 1000.00, 500.00, 500.00)
    `);
        console.log('Test account inserted');

        // Verify it works
        console.log('Verifying account...');
        const result = await pool.query('SELECT * FROM accounts');
        console.log('Accounts in database:', result.rows);

        console.log('Database fix completed successfully');
    } catch (error) {
        console.error('Error fixing database:', error);
    } finally {
        // End the pool
        pool.end();
        console.log('Connection closed');
    }
}

// Run the function
fixDatabase(); 