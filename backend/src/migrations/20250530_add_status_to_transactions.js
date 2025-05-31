'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // First check if the status ENUM type exists
      try {
        await queryInterface.sequelize.query(`
          CREATE TYPE enum_transactions_status AS ENUM ('pending', 'completed', 'cancelled');
        `);
        console.log('Created enum_transactions_status type');
      } catch (error) {
        console.log('Status ENUM type may already exist:', error.message);
      }
      
      // Check if the column already exists
      const tableInfo = await queryInterface.describeTable('transactions');
      if (!tableInfo.status) {
        // Add the status column
        await queryInterface.addColumn('transactions', 'status', {
          type: Sequelize.ENUM('pending', 'completed', 'cancelled'),
          defaultValue: 'completed',
          allowNull: false
        });
        console.log('Added status column to transactions table');
      } else {
        console.log('Status column already exists in transactions table');
      }
      
      // Update existing transactions with pending cheques to have status = 'pending'
      await queryInterface.sequelize.query(`
        UPDATE transactions t
        SET status = 'pending'
        FROM cheques c
        WHERE t.id = c.tx_id
        AND c.status = 'pending'
      `);
      console.log('Updated transactions status for pending cheques');
      
      console.log('Migration completed successfully');
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Check if the column exists before removing it
      const tableInfo = await queryInterface.describeTable('transactions');
      if (tableInfo.status) {
        // First remove the column
        await queryInterface.removeColumn('transactions', 'status');
        console.log('Removed status column from transactions table');
      }
      
      // We don't drop the ENUM type as it might be used elsewhere
      
      console.log('Down migration completed');
    } catch (error) {
      console.error('Down migration error:', error);
      throw error;
    }
  }
}; 