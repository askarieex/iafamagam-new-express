// Script to add the last_closed_date column to the accounts table
const { sequelize } = require('./src/models');

async function addColumn() {
  try {
    console.log('Adding last_closed_date column to accounts table...');
    
    // Check if column exists first
    const [checkResults] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='accounts' AND column_name='last_closed_date'
    `);
    
    if (checkResults.length > 0) {
      console.log('Column last_closed_date already exists.');
      return;
    }

    // Add the column
    await sequelize.query(`
      ALTER TABLE accounts 
      ADD COLUMN last_closed_date DATE NULL
    `);
    
    console.log('Column last_closed_date added successfully!');
  } catch (error) {
    console.error('Error adding column:', error);
  } finally {
    await sequelize.close();
  }
}

addColumn(); 