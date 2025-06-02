import { verifyAdmin } from '../../../../lib/auth';

export default async function handler(req, res) {
    try {
        // Verify the request is coming from an admin
        const admin = await verifyAdmin(req);

        if (!admin) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized. Admin access required.'
            });
        }

        // Handle different HTTP methods
        switch (req.method) {
            case 'GET':
                return getUsers(req, res);
            case 'POST':
                return createUser(req, res);
            default:
                return res.status(405).json({
                    success: false,
                    message: 'Method not allowed'
                });
        }
    } catch (error) {
        console.error('Error handling users request:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error processing users request'
        });
    }
}

// GET all users
async function getUsers(req, res) {
    try {
        // In a real app, you would fetch users from your database
        // Mock users for development
        const users = [
            {
                id: 1,
                name: 'Administrator',
                email: 'admin@iafa.com',
                role: 'admin',
                permissions: {
                    dashboard: true,
                    transactions: true,
                    reports: true,
                    accounts: true,
                    settings: true
                }
            },
            {
                id: 2,
                name: 'Regular User',
                email: 'user@example.com',
                role: 'user',
                permissions: {
                    dashboard: true,
                    transactions: true,
                    reports: true,
                    accounts: false,
                    settings: false
                }
            },
            {
                id: 3,
                name: 'Report Viewer',
                email: 'reports@example.com',
                role: 'user',
                permissions: {
                    dashboard: true,
                    transactions: false,
                    reports: true,
                    accounts: false,
                    settings: false
                }
            }
        ];

        return res.status(200).json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching users'
        });
    }
}

// POST to create a new user
async function createUser(req, res) {
    try {
        const { name, email, password, role, permissions } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Validate email format
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        // Validate role
        if (role && !['admin', 'user'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role'
            });
        }

        // In a real app, you would:
        // 1. Hash the password
        // 2. Check if email exists
        // 3. Create the user in your database
        // For now, just return success with mock data

        // Mock the created user with an ID
        const newUser = {
            id: Date.now(), // Mock ID generation
            name,
            email,
            role: role || 'user',
            permissions: permissions || {
                dashboard: true,
                transactions: false,
                reports: false,
                accounts: false,
                settings: false
            }
        };

        return res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: newUser
        });
    } catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({
            success: false,
            message: 'Error creating user'
        });
    }
} 