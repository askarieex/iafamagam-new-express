const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');

async function createAccountsTable() {
  console.log('Starting script to create accounts table');

  try {
    // Test connection
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('Database connection is OK');

    // Drop table if exists
    console.log('Dropping accounts table if it exists...');
    await sequelize.query('DROP TABLE IF EXISTS accounts CASCADE');
    console.log('Previous accounts table dropped (if existed)');

    // Create the accounts table with the exact columns we need
    console.log('Creating new accounts table...');
    await sequelize.query(`
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

    // Insert a test account to verify it works
    console.log('Inserting test account...');
    await sequelize.query(`
      INSERT INTO accounts (name, opening_balance, closing_balance, cash_balance, bank_balance)
      VALUES ('Test Account', 1000, 1000, 500, 500)
    `);
    console.log('Test account inserted successfully');

    // Verify account was created
    console.log('Verifying account was created...');
    const result = await sequelize.query(`
      SELECT * FROM accounts
    `, { type: QueryTypes.SELECT });

    console.log('Accounts in database:', result);

    console.log('Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating accounts table:', error);
    process.exit(1);
  }
}

// Run the function
console.log('Script started');
createAccountsTable(); 