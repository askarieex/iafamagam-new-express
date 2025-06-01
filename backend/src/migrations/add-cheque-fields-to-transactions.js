'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add the cheque fields to the transactions table
        await queryInterface.addColumn('transactions', 'cheque_number', {
            type: Sequelize.STRING,
            allowNull: true
        });

        await queryInterface.addColumn('transactions', 'bank_name', {
            type: Sequelize.STRING,
            allowNull: true
        });

        await queryInterface.addColumn('transactions', 'issue_date', {
            type: Sequelize.DATEONLY,
            allowNull: true
        });

        await queryInterface.addColumn('transactions', 'due_date', {
            type: Sequelize.DATEONLY,
            allowNull: true
        });
    },

    down: async (queryInterface, Sequelize) => {
        // Remove the columns
        await queryInterface.removeColumn('transactions', 'cheque_number');
        await queryInterface.removeColumn('transactions', 'bank_name');
        await queryInterface.removeColumn('transactions', 'issue_date');
        await queryInterface.removeColumn('transactions', 'due_date');
    }
}; 