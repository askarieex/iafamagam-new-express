'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('accounts', 'last_closed_date', {
            type: Sequelize.DATEONLY,
            allowNull: true,
            comment: 'Last day of the most recently closed accounting period'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('accounts', 'last_closed_date');
    }
}; 