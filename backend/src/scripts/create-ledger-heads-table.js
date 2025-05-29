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

async function createLedgerHeadsTable() {
    try {
        // Drop ledger_heads table if it exists
        console.log('Dropping ledger_heads table if it exists...');
        await pool.query('DROP TABLE IF EXISTS ledger_heads CASCADE');
        console.log('ledger_heads table dropped');

        // Create the ledger_heads table with all required columns
        console.log('Creating ledger_heads table...');
        await pool.query(`
      CREATE TABLE ledger_heads (
        id SERIAL PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        head_type VARCHAR(10) NOT NULL CHECK (head_type IN ('debit', 'credit')),
        current_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
        console.log('ledger_heads table created successfully');

        // Check if accounts table has records
        const accountsResult = await pool.query('SELECT id FROM accounts LIMIT 1');

        if (accountsResult.rows.length > 0) {
            const accountId = accountsResult.rows[0].id;

            // Insert test ledger heads
            console.log('Inserting test ledger heads...');
            await pool.query(`
          INSERT INTO ledger_heads (account_id, name, head_type, current_balance, description)
          VALUES 
            (${accountId}, 'Office Rent', 'debit', 0.00, 'Monthly office rent expenses'),
            (${accountId}, 'Sales Revenue', 'credit', 0.00, 'Revenue from product sales')
        `);
            console.log('Test ledger heads inserted');
        } else {
            console.log('No accounts found to create test ledger heads');
        }

        // Verify it works
        console.log('Verifying ledger heads...');
        const result = await pool.query('SELECT * FROM ledger_heads');
        console.log('Ledger heads in database:', result.rows);

        console.log('Database setup completed successfully');
    } catch (error) {
        console.error('Error creating ledger_heads table:', error);
    } finally {
        // End the pool
        pool.end();
        console.log('Connection closed');
    }
}

// Run the function
createLedgerHeadsTable(); 