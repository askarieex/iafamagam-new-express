const bcrypt = require('bcryptjs');
const { User } = require('../models');

/**
 * Fix the admin user password using the correct hashing method
 * This script directly updates the database record
 */
async function fixAdminPassword() {
    try {
        // Find the admin user
        const adminUser = await User.findOne({
            where: { email: 'admin@iafa.com' }
        });

        if (!adminUser) {
            console.log('Admin user not found. Creating new admin user...');

            // Create admin user if it doesn't exist
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

            console.log('Admin user created successfully');
        } else {
            console.log('Admin user found. Updating password...');

            // Update password using sequelize's raw query to bypass hooks
            // This ensures we have direct control over the hashing process
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);

            // Update using sequelize direct query
            await User.sequelize.query(
                'UPDATE "Users" SET "password" = ? WHERE "email" = ?',
                {
                    replacements: [hashedPassword, 'admin@iafa.com'],
                    type: User.sequelize.QueryTypes.UPDATE
                }
            );

            console.log('Admin password updated with properly hashed password');

            // Verify the password works
            const updatedAdmin = await User.findOne({
                where: { email: 'admin@iafa.com' }
            });

            const isValid = await bcrypt.compare('admin123', updatedAdmin.password);
            console.log('Verification test - Password valid:', isValid);
        }

        console.log('You can now log in with:');
        console.log('Email: admin@iafa.com');
        console.log('Password: admin123');

        process.exit(0);
    } catch (error) {
        console.error('Error fixing admin password:', error);
        process.exit(1);
    }
}

// Run the function
fixAdminPassword(); 