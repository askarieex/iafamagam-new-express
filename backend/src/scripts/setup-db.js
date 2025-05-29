const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'iafa_software',
  password: String(process.env.DB_PASSWORD || 'your_password'),
  port: parseInt(process.env.DB_PORT || '5432', 10),
};

console.log('Connecting to database...');

// Create a new pool instance
const pool = new Pool(dbConfig);

// SQL for creating tables
const createTableSQL = `
-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  account_type VARCHAR(50) NOT NULL, -- 'general', 'stm', 'trust', 'imdad'
  opening_balance NUMERIC(14,2) DEFAULT 0.00,
  closing_balance NUMERIC(14,2) DEFAULT 0.00,
  cash_balance NUMERIC(14,2) DEFAULT 0.00,
  bank_balance NUMERIC(14,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create ledgers table
CREATE TABLE IF NOT EXISTS ledgers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'debit' or 'credit'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id),
  ledger_id INTEGER REFERENCES ledgers(id),
  amount DECIMAL(15, 2) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'debit' or 'credit'
  description TEXT,
  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cheques table
CREATE TABLE IF NOT EXISTS cheques (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id),
  cheque_number VARCHAR(50) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'cleared', 'cancelled'
  issue_date DATE NOT NULL,
  clearing_date DATE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default accounts if they don't exist
INSERT INTO accounts (name, account_type, opening_balance, closing_balance, cash_balance, bank_balance)
SELECT 'General Account', 'general', 183904.39, 183904.39, 13458, 170446.4
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE name = 'General Account');

INSERT INTO accounts (name, account_type, opening_balance, closing_balance, cash_balance, bank_balance)
SELECT 'Shoba Taleem E Murwaja', 'stm', 314503, 314503, 1500, 313003
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE name = 'Shoba Taleem E Murwaja');

INSERT INTO accounts (name, account_type, opening_balance, closing_balance, cash_balance, bank_balance)
SELECT 'Sahm E Imam & Sehm E Sadat', 'trust', 356321.15, 356321.15, 67042.06, 289279.08
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE name = 'Sahm E Imam & Sehm E Sadat');

INSERT INTO accounts (name, account_type, opening_balance, closing_balance, cash_balance, bank_balance)
SELECT 'Shoba Imdad Ul Mustahiqeen', 'imdad', 801306.7, 801306.7, 401942, 399364.71
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE name = 'Shoba Imdad Ul Mustahiqeen');

-- Insert default ledgers if they don't exist
INSERT INTO ledgers (name, type)
SELECT 'Debit Ledgerhead', 'debit'
WHERE NOT EXISTS (SELECT 1 FROM ledgers WHERE name = 'Debit Ledgerhead');

INSERT INTO ledgers (name, type)
SELECT 'Credit Ledgerhead', 'credit'
WHERE NOT EXISTS (SELECT 1 FROM ledgers WHERE name = 'Credit Ledgerhead');
`;

// Execute the SQL query
pool.query(createTableSQL)
  .then(() => {
    console.log('Tables created successfully!');
    console.log('Default data inserted!');
    console.log('Database setup complete.');
    pool.end();
  })
  .catch((err) => {
    console.error('Error executing SQL:', err);
    pool.end();
  }); 