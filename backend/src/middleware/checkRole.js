/**
 * Middleware to check if user has required role
 * @param {string|string[]} roles - Role or array of roles allowed to access
 */
const checkRole = (roles) => {
    return (req, res, next) => {
        // Check if req.user exists (auth middleware should run first)
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

module.exports = checkRole; 