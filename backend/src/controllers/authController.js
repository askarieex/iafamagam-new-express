const { User } = require('../models');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const bcrypt = require('bcryptjs');

// Get JWT secret from config or use a default
const JWT_SECRET = process.env.JWT_SECRET || 'iafa-jwt-secret-key';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '1d';

/**
 * Register a new user
 */
exports.register = async (req, res) => {
    try {
        const { name, email, password, role = 'user' } = req.body;

        console.log(`Attempting to register user: ${email}`);

        // Check if user already exists
        const existingUser = await User.findOne({ where: { email } });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role
        });

        console.log(`User registration successful: ${email} (${user.id})`);

        // Return jwt token
        const token = generateToken(user);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`Login attempt for: ${email}`);

        // Special handling for admin login
        if (email === 'admin@iafa.com' && password === 'admin123') {
            console.log('Admin login detected, using direct credential check');

            // Find or create admin user
            let adminUser = await User.findOne({ where: { email: 'admin@iafa.com' } });

            if (!adminUser) {
                console.log('Creating admin user in database...');
                // Create admin user if it doesn't exist
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash('admin123', salt);

                adminUser = await User.create({
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
                console.log('Admin user created successfully with ID:', adminUser.id);
            } else {
                console.log('Found existing admin user with ID:', adminUser.id);
            }

            // Generate token for admin
            const token = jwt.sign(
                {
                    id: adminUser.id,
                    name: adminUser.name,
                    email: adminUser.email,
                    role: 'admin'
                },
                JWT_SECRET,
                { expiresIn: '30d' }
            );

            console.log('Admin login successful, returning token');

            return res.json({
                success: true,
                data: {
                    id: adminUser.id,
                    name: adminUser.name,
                    email: adminUser.email,
                    role: 'admin',
                    permissions: {
                        dashboard: true,
                        transactions: true,
                        reports: true,
                        accounts: true,
                        settings: true
                    },
                    token
                }
            });
        }

        // Regular user login process
        console.log('Processing regular user login');

        // Find user by email
        const user = await User.findOne({ where: { email } });

        // Check if user exists
        if (!user) {
            console.log(`User not found with email: ${email}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        console.log(`User found: ${user.name} (ID: ${user.id})`);

        // Check password
        console.log('Comparing password...');

        // Use enhanced password comparison with detailed logging
        const isMatch = await comparePasswords(password, user.password, user.id, user.email);

        if (!isMatch) {
            console.log('Password does not match');
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        console.log('Password validated successfully');

        // Create user data for token
        const userData = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            permissions: user.permissions || {
                dashboard: true,
                transactions: false,
                reports: false,
                accounts: false,
                settings: false
            }
        };

        // Generate token
        const token = jwt.sign(
            {
                id: userData.id,
                name: userData.name,
                email: userData.email,
                role: userData.role
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        console.log(`Login successful for user: ${userData.email} with role: ${userData.role}`);

        // Return successful response
        res.json({
            success: true,
            data: {
                ...userData,
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
};

/**
 * Get current user profile
 */
exports.getMe = async (req, res) => {
    try {
        // User is already attached to request by auth middleware
        const user = req.user;

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching user profile'
        });
    }
};

/**
 * Generate JWT token
 */
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
};

// Compare passwords with detailed logging for debugging
const comparePasswords = async (plainPassword, hashedPassword, userId, email) => {
    console.log(`Detailed password check for user ${email} (${userId}):`);
    console.log(`- Password length: ${plainPassword.length}`);
    console.log(`- Hashed password in DB (first 15 chars): ${hashedPassword.substring(0, 15)}...`);

    try {
        const result = await bcrypt.compare(plainPassword, hashedPassword);
        console.log(`- Password comparison result: ${result ? 'MATCH' : 'NO MATCH'}`);
        return result;
    } catch (error) {
        console.error('Error during password comparison:', error);
        return false;
    }
};

/**
 * @desc    Reset user password (admin function)
 * @route   POST /api/auth/reset-password
 * @access  Private/Admin
 */
exports.resetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Email and new password are required'
            });
        }

        // Find user by email
        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update user password
        user.password = hashedPassword;
        await user.save();

        console.log(`Password reset successful for user: ${email}`);

        res.json({
            success: true,
            message: 'Password reset successful'
        });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during password reset'
        });
    }
};

/**
 * @desc    Reset password for a new user (public endpoint for testing)
 * @route   POST /api/auth/public-reset
 * @access  Public
 */
exports.publicPasswordReset = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Email and new password are required'
            });
        }

        // Find user by email
        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Only allow this for non-admin users in development
        if (user.role === 'admin' && process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                success: false,
                message: 'Cannot reset admin password through public endpoint'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update user password
        user.password = hashedPassword;
        await user.save();

        console.log(`Public password reset successful for user: ${email}`);

        res.json({
            success: true,
            message: 'Password reset successful'
        });
    } catch (error) {
        console.error('Public password reset error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during password reset'
        });
    }
}; 