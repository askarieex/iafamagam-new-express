const bcrypt = require('bcryptjs');
const { User } = require('../models');

/**
 * Update the admin user password
 */
async function updateAdminPassword() {
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

            console.log('Admin user created successfully with email: admin@iafa.com and password: admin123');
        } else {
            // Update existing admin password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);

            adminUser.password = hashedPassword;
            await adminUser.save();

            console.log('Admin password updated successfully to: admin123');
        }

        console.log('You can now log in with:');
        console.log('Email: admin@iafa.com');
        console.log('Password: admin123');

        process.exit(0);
    } catch (error) {
        console.error('Error updating admin password:', error);
        process.exit(1);
    }
}

// Run the function
updateAdminPassword(); 