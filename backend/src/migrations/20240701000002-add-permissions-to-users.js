'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('Users', 'permissions', {
            type: Sequelize.JSON,
            allowNull: true,
            defaultValue: {
                dashboard: true,
                transactions: true,
                reports: true,
                accounts: false,
                settings: false
            }
        });

        // Update the default admin to have all permissions
        await queryInterface.sequelize.query(`
      UPDATE "Users" 
      SET permissions = '{"dashboard":true,"transactions":true,"reports":true,"accounts":true,"settings":true}'
      WHERE email = 'admin@iafa.com';
    `);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('Users', 'permissions');
    }
}; 