'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('Transactions', 'status', {
            type: Sequelize.ENUM('pending', 'completed', 'cancelled'),
            defaultValue: 'completed',
            allowNull: false
        });

        // Update all existing transactions to have 'completed' status
        await queryInterface.sequelize.query(
            `UPDATE "Transactions" SET status = 'completed' WHERE status IS NULL`
        );
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('Transactions', 'status');
