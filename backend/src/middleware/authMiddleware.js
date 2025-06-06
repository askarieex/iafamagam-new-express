const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Get JWT secret from config or use a default
const JWT_SECRET = process.env.JWT_SECRET || 'iafa-jwt-secret-key';

/**
 * Auth middleware to protect routes
 */
exports.protect = async (req, res, next) => {
    let token;

    try {
        // Check if token is in headers
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1]?.trim();
        }
        // Check if token is in cookies (alternative approach)
        else if (req.cookies && req.cookies.token) {
            token = req.cookies.token.trim();
        }

        // Check if token exists
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in.'
            });
        }

        let decoded;
        try {
            // Verify token
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (tokenError) {
            // Handle token verification errors silently without full stack trace logging
            if (tokenError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token has expired. Please log in again.'
                });
            } else if (tokenError.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid token format'
                });
            } else {
                // For other jwt errors, just log the error name
                console.error('JWT Error:', tokenError.name);
                return res.status(401).json({
                    success: false,
                    message: 'Authentication failed'
                });
            }
        }

        // Check if required fields exist in token
        if (!decoded.id) {
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication token'
            });
        }

        // Get user from token
        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password'] }  // Don't return password
        });

        // Check if user exists
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User no longer exists'
            });
        }

        // Attach user to request object
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message || error);

        return res.status(401).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

/**
 * Middleware to check if user has required role or permission
 * @param {string|string[]} rolesOrPermissions - Role or permission or array of roles/permissions allowed to access
 */
exports.authorize = (rolesOrPermissions) => {
    return (req, res, next) => {
        // Check if req.user exists (protect middleware should run first)
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized, please login'
            });
        }

        // Convert to array if it's a single role/permission
        const allowedValues = Array.isArray(rolesOrPermissions) ? rolesOrPermissions : [rolesOrPermissions];

        // Check if user role is in allowed roles
        if (allowedValues.includes(req.user.role)) {
            return next(); // If user has the required role, allow access
        }

        // If user doesn't have the required role, check permissions
        if (req.user.permissions) {
            // Check if any of the required permissions match
            for (const value of allowedValues) {
                if (req.user.permissions[value] === true) {
                    return next(); // User has the permission, allow access
                }
            }
        }

        // If we got here, user has neither the required role nor permission
        return res.status(403).json({
            success: false,
            message: `Access denied: Requires ${allowedValues.join(' or ')} role or permission`
        });
    };
}; 