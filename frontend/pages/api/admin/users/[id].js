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

        const { id } = req.query;
        
        // Handle different HTTP methods
        switch (req.method) {
            case 'GET':
                return getUserById(req, res, id);
            case 'PATCH':
                return updateUser(req, res, id);
            case 'DELETE':
                return deleteUser(req, res, id);
            default:
                return res.status(405).json({ 
                    success: false, 
                    message: 'Method not allowed' 
                });
        }
    } catch (error) {
        console.error('Error handling user request:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error processing user request' 
        });
    }
}

// GET a single user by ID
async function getUserById(req, res, id) {
    try {
        // In a real app, you would fetch the user from your database
        // Mock user for development
        const user = {
            id: parseInt(id),
            name: `User ${id}`,
            email: `user${id}@example.com`,
            role: 'user',
            permissions: {
                dashboard: true,
                transactions: id % 2 === 0, // Just for demo variation
                reports: true,
                accounts: id % 3 === 0, // Just for demo variation
                settings: false
            }
        };

        // If user is special ID 1, make it the admin
        if (id === '1') {
            user.name = 'Administrator';
            user.email = 'admin@iafa.com';
            user.role = 'admin';
            user.permissions = {
                dashboard: true,
                transactions: true,
                reports: true,
                accounts: true,
                settings: true
            };
        }

        return res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching user'
        });
    }
}

// PATCH to update a user (permissions)
async function updateUser(req, res, id) {
    try {
        const { permissions } = req.body;

        // Validate input
        if (!permissions) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // In a real app, you would update the user in your database
        // For now we just return success
        return res.status(200).json({
            success: true,
            message: 'User permissions updated successfully',
            data: {
                id: parseInt(id),
                permissions
            }
        });
    } catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({
            success: false,
            message: 'Error updating user'
        });
    }
}

// DELETE a user
async function deleteUser(req, res, id) {
    try {
        // Check if trying to delete admin
        if (id === '1') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete admin user'
            });
        }

        // In a real app, you would delete the user from your database
        // For now we just return success
        return res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({
            success: false,
            message: 'Error deleting user'
        });
    }
} 