const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Get JWT secret from config or use a default
const JWT_SECRET = process.env.JWT_SECRET || 'iafa-jwt-secret-key';

/**
 * Auth middleware to protect routes
 */
exports.protect = async (req, res, next) => {
    let token;

    // Check if token is in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        // Extract token from Bearer token
        token = req.headers.authorization.split(' ')[1];
        
        // Make sure token exists and is trimmed
        if (token) {
            token = token.trim();
        }
        
        console.log('Token extracted from authorization header:', token ? `${token.substring(0, 15)}...` : 'none');
    }
    // Check if token is in cookies (alternative approach)
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token.trim();
        console.log('Token extracted from cookies');
    }

    // Check if token exists
    if (!token) {
        console.log('No token provided in request');
        return res.status(401).json({
            success: false,
            message: 'Not authorized, no token provided'
        });
    }

    try {
        // Verify token
        console.log('Verifying token...');
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Token decoded successfully:', {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
        });

        // Get user from token
        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password'] }  // Don't return password
        });

        // Check if user exists
        if (!user) {
            console.log(`User with ID ${decoded.id} not found in database`);
            return res.status(401).json({
                success: false,
                message: 'Not authorized, user not found'
            });
        }

        console.log(`User found: ${user.name} (${user.email}), role: ${user.role}`);

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
            console.log('User not found in request - protect middleware might not have run');
            return res.status(401).json({
                success: false,
                message: 'Not authorized, please login'
            });
        }

        // Convert roles to array if it's a single role
        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        console.log('Authorize middleware checking roles:', {
            userRole: req.user.role,
            allowedRoles,
            hasAccess: allowedRoles.includes(req.user.role)
        });

        // Check if user role is in allowed roles
        if (!allowedRoles.includes(req.user.role)) {
            console.log(`Access denied: User role ${req.user.role} not in allowed roles [${allowedRoles.join(', ')}]`);
            return res.status(403).json({
                success: false,
                message: `User role ${req.user.role} is not authorized to access this resource`
            });
        }

        console.log(`Access granted: User role ${req.user.role} has required permission`);
        next();
    };
}; 