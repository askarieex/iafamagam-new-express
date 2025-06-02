const jwt = require('jsonwebtoken');
const { User } = require('../models');
const config = require('../config/config');

// Get JWT secret from config or use a default
const JWT_SECRET = config.jwtSecret || 'your-jwt-secret-key';

/**
 * Auth middleware to protect routes
 */
exports.protect = async (req, res, next) => {
    let token;

    // Check if token is in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        // Extract token from Bearer token
        token = req.headers.authorization.split(' ')[1];
    }
    // Check if token is in cookies (alternative approach)
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    // Check if token exists
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized, no token provided'
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Get user from token
        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password'] }  // Don't return password
        });

        // Check if user exists
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized, user not found'
            });
        }

        // Attach user to request object
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({
            success: false,
            message: 'Not authorized, invalid token'
        });
    }
};

/**
 * Middleware to check if user has required role
 * @param {string|string[]} roles - Role or array of roles allowed to access
 */
exports.authorize = (roles) => {
    return (req, res, next) => {
        // Check if req.user exists (protect middleware should run first)
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized, please login'
            });
        }

        // Convert roles to array if it's a single role
        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        // Check if user role is in allowed roles
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role ${req.user.role} is not authorized to access this resource`
            });
        }

        next();
    };
}; 