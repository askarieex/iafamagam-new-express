'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        try {
            // Add index on tx_date for improved performance when querying historical transactions
            await queryInterface.addIndex('transactions', ['tx_date'], {
                name: 'idx_transactions_tx_date'
            });

            // Also add composite index on account_id and tx_date for snapshot queries
            await queryInterface.addIndex('transactions', ['account_id', 'tx_date'], {
                name: 'idx_transactions_account_tx_date'
            });

            console.log('Successfully added indexes for transaction date queries');
        } catch (error) {
            console.error('Error adding tx_date indexes:', error);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        try {
            // Remove the indexes
            await queryInterface.removeIndex('transactions', 'idx_transactions_tx_date');
            await queryInterface.removeIndex('transactions', 'idx_transactions_account_tx_date');
            
            console.log('Successfully removed tx_date indexes');
        } catch (error) {
            console.error('Error removing tx_date indexes:', error);
            throw error;
        }
    }
}; 