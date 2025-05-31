'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // First, try to add the ENUM type if it doesn't exist
      try {
        await queryInterface.sequelize.query(`
          CREATE TYPE enum_transactions_status AS ENUM ('pending', 'completed', 'cancelled');
        `);
      } catch (error) {
        // If the type already exists, this will error, which is fine
        console.log('Status ENUM type may already exist, proceeding...');
      }

      // Try to add the column directly
      try {
        console.log('Adding status column to transactions table...');
        await queryInterface.addColumn('transactions', 'status', {
          type: Sequelize.ENUM('pending', 'completed', 'cancelled'),
          defaultValue: 'completed',
          allowNull: false
        });

        // Update existing transactions that might be cheque transactions
        await queryInterface.sequelize.query(`
          UPDATE transactions 
          SET status = 'pending'
          WHERE cash_type = 'cheque'
        `);

        console.log('Successfully added status column to transactions table');
      } catch (error) {
        console.error('Error adding status column:', error.message);
        console.log('Status column may already exist, continuing...');
      }
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Try to remove the column directly
      try {
        console.log('Removing status column from transactions table...');
        await queryInterface.removeColumn('transactions', 'status');
        console.log('Successfully removed status column');
      } catch (error) {
        console.error('Error removing status column:', error.message);
      }
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  }
};
