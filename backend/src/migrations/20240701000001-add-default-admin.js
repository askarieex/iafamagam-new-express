'use strict';
const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Hash the admin password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        // Insert default admin user
        await queryInterface.bulkInsert('Users', [{
            name: 'Administrator',
            email: 'admin@iafa.com',
            password: hashedPassword,
            role: 'admin',
            createdAt: new Date(),
            updatedAt: new Date()
        }], {});

        console.log('Default admin user created: admin@iafa.com / admin123');
    },

    async down(queryInterface, Sequelize) {
        // Remove the default admin user
        await queryInterface.bulkDelete('Users', { email: 'admin@iafa.com' }, {});
    }
}; 