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

async function createBankAccountsTable() {
    try {
        // Drop bank_accounts table if it exists
        console.log('Dropping bank_accounts table if it exists...');
        await pool.query('DROP TABLE IF EXISTS bank_accounts CASCADE');
        console.log('bank_accounts table dropped');

        // Create the bank_accounts table with all required columns
        console.log('Creating bank_accounts table...');
        await pool.query(`
      CREATE TABLE bank_accounts (
        id SERIAL PRIMARY KEY,
        bank_name VARCHAR(255) NOT NULL,
        acc_number VARCHAR(255) NOT NULL,
        ifsc VARCHAR(255),
        bank_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
        console.log('bank_accounts table created successfully');

        // Insert a test bank account
        console.log('Inserting test bank account...');
        await pool.query(`
      INSERT INTO bank_accounts (bank_name, acc_number, ifsc, bank_balance)
      VALUES ('State Bank of India', 'SBI123456789', 'SBIN0001234', 1000.00)
    `);
        console.log('Test bank account inserted');

        // Verify it works
        console.log('Verifying bank account...');
        const result = await pool.query('SELECT * FROM bank_accounts');
        console.log('Bank accounts in database:', result.rows);

        console.log('Database setup completed successfully');
    } catch (error) {
        console.error('Error creating bank_accounts table:', error);
    } finally {
        // End the pool
        pool.end();
        console.log('Connection closed');
    }
}

// Run the function
createBankAccountsTable(); 