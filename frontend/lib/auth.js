import jwt from 'jsonwebtoken';

// Secret key for JWT (should be in env var in production)
const JWT_SECRET = process.env.JWT_SECRET || 'iafa-jwt-secret-key';

/**
 * Verify JWT token from authorization header
 * @param {Object} req - Express/Next.js request object
 * @returns {Object|null} decoded user data or null
 */
export const verifyToken = (req) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return null;
        }

        // Verify the token
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (error) {
        console.error('Token verification error:', error);
        return null;
    }
};

/**
 * Verify user from request
 * @param {Object} req - Express/Next.js request object
 * @returns {Object|null} User data or null
 */
export const verifyUser = (req) => {
    try {
        const user = verifyToken(req);
        return user;
    } catch (error) {
        console.error('User verification error:', error);
        return null;
    }
};

/**
 * Verify admin user from request
 * @param {Object} req - Express/Next.js request object
 * @returns {Object|null} Admin user data or null
 */
export const verifyAdmin = (req) => {
    try {
        const user = verifyToken(req);

        // Check if user exists and has admin role
        if (user && user.role === 'admin') {
            return user;
        }

        return null;
    } catch (error) {
        console.error('Admin verification error:', error);
        return null;
    }
};

/**
 * Generate JWT token for user
 * @param {Object} userData - User data to encode in token
 * @returns {String} JWT token
 */
export const generateToken = (userData) => {
    // Don't include sensitive data in the token
    const { password, ...userDataWithoutPassword } = userData;

    // Set expiration to 30 days
    const token = jwt.sign(
        userDataWithoutPassword,
        JWT_SECRET,
        { expiresIn: '30d' }
    );

    return token;
};

/**
 * Check if user has permission to access a specific page
 * @param {Object} user - User object with permissions
 * @param {String} page - Page name to check permission for
 * @returns {Boolean} True if user has permission, false otherwise
 */
export const hasPagePermission = (user, page) => {
    // Admin has access to all pages
    if (user && user.role === 'admin') {
        return true;
    }

    // Check specific page permission
    return user &&
        user.permissions &&
        user.permissions[page] === true;
}; 