const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const config = require('./config/config.json')['development'];

async function runSqlFix() {
  const client = new Client({
    user: config.username,
    host: config.host,
    database: config.database,
    password: config.password,
    port: 5432
  });

  try {
    // Connect to the database
    await client.connect();
    console.log('Connected to database');

    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'fix-cheque-model.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // Execute the SQL
    console.log('Executing SQL fix...');
    await client.query(sqlContent);
    console.log('SQL executed successfully');

  } catch (error) {
    console.error('Error executing SQL:', error);
  } finally {
    // Close the connection
    await client.end();
    console.log('Connection closed');
  }
}

runSqlFix(); 