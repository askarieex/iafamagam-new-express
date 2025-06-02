'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('accounts', 'last_closed_date', {
            type: Sequelize.DATEONLY,
            allowNull: true,
            comment: 'Last day of the most recently closed accounting period'
        });

        console.log('Added last_closed_date column to accounts table');
        return Promise.resolve();
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('accounts', 'last_closed_date');
        console.log('Removed last_closed_date column from accounts table');
        return Promise.resolve();
    }
}; 