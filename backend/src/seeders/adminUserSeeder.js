const bcrypt = require('bcryptjs');
const { User } = require('../models');

/**
 * Seed the default admin user
 */
async function seedAdminUser() {
    try {
        // Check if admin user already exists
        const adminExists = await User.findOne({
            where: { email: 'admin@iafa.com' }
        });

        if (adminExists) {
            console.log('Admin user already exists, skipping seeding.');
            return;
        }

        // Create admin user
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        await User.create({
            name: 'Administrator',
            email: 'admin@iafa.com',
            password: hashedPassword,
            role: 'admin',
            permissions: {
                dashboard: true,
                transactions: true,
                reports: true,
                accounts: true,
                settings: true
            }
        });

        console.log('Default admin user created successfully.');
    } catch (error) {
        console.error('Error seeding admin user:', error);
    }
}

module.exports = seedAdminUser; 