const { User } = require('../models');
const bcrypt = require('bcryptjs');

/**
 * @desc    Get all users
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
exports.getUsers = async (req, res) => {
    try {
        // Fetch all users except passwords
        const users = await User.findAll({
            attributes: { exclude: ['password'] }
        });

        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
};

/**
 * @desc    Get a user by ID
 * @route   GET /api/admin/users/:id
 * @access  Private/Admin
 */
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: { exclude: ['password'] }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user'
        });
    }
};

/**
 * @desc    Create a new user
 * @route   POST /api/admin/users
 * @access  Private/Admin
 */
exports.createUser = async (req, res) => {
    try {
        const { name, email, password, role, permissions } = req.body;

        // Check if user already exists
        const userExists = await User.findOne({ where: { email } });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and password are required'
            });
        }

        // Create user - password will be hashed by model hooks
        const user = await User.create({
            name,
            email,
            password,
            role: role || 'user',
            permissions: permissions || {
                dashboard: true,
                transactions: false,
                reports: false,
                accounts: false,
                settings: false
            }
        });

        // Return user without password
        const userData = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            permissions: user.permissions
        };

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: userData
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create user',
            error: error.message
        });
    }
};

/**
 * @desc    Update a user
 * @route   PUT /api/admin/users/:id
 * @access  Private/Admin
 */
exports.updateUser = async (req, res) => {
    try {
        const { name, email, password, role, permissions } = req.body;
        const userId = req.params.id;

        // Find user
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent modification of the main admin user except by themselves
        if (user.email === 'admin@iafa.com' && req.user.id !== user.id) {
            return res.status(403).json({
                success: false,
                message: 'Cannot modify the main administrator account'
            });
        }

        // Update user data
        if (name) user.name = name;
        if (email) user.email = email;
        if (role) user.role = role;
        if (permissions) user.permissions = permissions;

        // Update password if provided - will be hashed by model hooks
        if (password) {
            user.password = password;
        }

        await user.save();

        // Return updated user without password
        const userData = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            permissions: user.permissions
        };

        res.json({
            success: true,
            message: 'User updated successfully',
            data: userData
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user',
            error: error.message
        });
    }
};

/**
 * @desc    Update user permissions
 * @route   PATCH /api/admin/users/:id/permissions
 * @access  Private/Admin
 */
exports.updatePermissions = async (req, res) => {
    try {
        const { permissions } = req.body;
        const userId = req.params.id;

        if (!permissions) {
            return res.status(400).json({
                success: false,
                message: 'Permissions are required'
            });
        }

        // Find user
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Absolutely prevent modification of the main admin user
        if (user.email === 'admin@iafa.com') {
            return res.status(403).json({
                success: false,
                message: 'Cannot modify the main administrator account permissions'
            });
        }

        // Update permissions
        user.permissions = permissions;
        await user.save();

        res.json({
            success: true,
            message: 'User permissions updated successfully',
            data: {
                id: user.id,
                permissions: user.permissions
            }
        });
    } catch (error) {
        console.error('Error updating user permissions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user permissions',
            error: error.message
        });
    }
};

/**
 * @desc    Delete a user
 * @route   DELETE /api/admin/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;

        // Find user
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Absolutely prevent deletion of the main admin user
        if (user.email === 'admin@iafa.com') {
            return res.status(403).json({
                success: false,
                message: 'Cannot delete the main administrator account'
            });
        }

        await user.destroy();

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user',
            error: error.message
        });
    }
}; 