const { User } = require('../models');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Get JWT secret from config or use a default
const JWT_SECRET = config.jwtSecret || 'your-jwt-secret-key';
const JWT_EXPIRES = config.jwtExpires || '1h';

/**
 * Register a new user
 */
exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Check if user already exists
        const userExists = await User.findOne({ where: { email } });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Only allow admin creation if explicitly set by another admin
        // For first user creation, this check can be bypassed (with special setup)
        if (role === 'admin') {
            // Check if requester is admin (except for first user)
            const userCount = await User.count();
            if (userCount > 0) {
                // If users exist, only admin can create another admin
                if (!req.user || req.user.role !== 'admin') {
                    return res.status(403).json({
                        success: false,
                        message: 'Only administrators can create admin accounts'
                    });
                }
            }
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password, // Will be hashed by model hook
            role: role || 'user'
        });

        // Generate token
        const token = generateToken(user);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                token
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error occurred during registration'
        });
    }
};

/**
 * Login user
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Find user
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Verify password
        const isPasswordValid = await user.validatePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate token
        const token = generateToken(user);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error occurred during login'
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
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        {
            expiresIn: JWT_EXPIRES
        }
    );
}; 