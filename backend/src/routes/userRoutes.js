const express = require('express');
const userController = require('../controllers/userController');
const { User } = require('../models');

const router = express.Router();

// Public route for debugging - removed for security
// Health check route - no authentication needed
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'User routes are working',
        timestamp: new Date().toISOString()
    });
});

// User profile routes - authenticated user can only access their own profile
router.get('/profile', async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findByPk(userId, {
            attributes: ['id', 'name', 'email', 'role', 'permissions', 'createdAt']
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
        console.error('Error fetching user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching user profile'
        });
    }
});

// Update current user's own profile
router.put('/profile', async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, email, currentPassword, newPassword } = req.body;

        // Find the user
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update basic info
        if (name) user.name = name;
        if (email) user.email = email;

        // Password update if provided
        if (currentPassword && newPassword) {
            const isMatch = await user.validatePassword(currentPassword);
            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password is incorrect'
                });
            }

            // Just set the password - the model hooks will handle hashing
            user.password = newPassword;
        }

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                permissions: user.permissions
            }
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating profile'
        });
    }
});

module.exports = router; 