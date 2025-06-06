const express = require('express');
const authController = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { User } = require('../models');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Special test route for password fix
router.post('/test-user', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        let user = await User.findOne({ where: { email } });

        if (user) {
            // If user exists, try to log in
            const isValid = await bcrypt.compare(password, user.password);

            return res.json({
                success: true,
                message: 'User exists',
                login: isValid ? 'successful' : 'failed',
                hash: user.password.substring(0, 20) + '...',
                rawPasswordLength: password.length,
                hashLength: user.password.length
            });
        }

        // Create a new user with manual hashing
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = await User.create({
            name: 'Test User',
            email,
            password: hashedPassword, // Store pre-hashed password to bypass hooks
            role: 'user'
        });

        res.json({
            success: true,
            message: 'Test user created',
            email: user.email,
            hash: hashedPassword.substring(0, 20) + '...',
            id: user.id
        });
    } catch (error) {
        console.error('Test user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error in test user route',
            error: error.message
        });
    }
});

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/public-reset', authController.publicPasswordReset);

// Protected routes
router.get('/me', protect, authController.getMe);

// Admin routes
router.post('/register-admin', protect, authorize('admin'), authController.register);
router.post('/reset-password', protect, authorize('admin'), authController.resetPassword);

module.exports = router; 