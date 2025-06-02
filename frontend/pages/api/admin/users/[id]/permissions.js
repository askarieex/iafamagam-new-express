import { verifyAdmin } from '../../../../../lib/auth';

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

        // Only allow PATCH method for permissions endpoint
        if (req.method !== 'PATCH') {
            return res.status(405).json({
                success: false,
                message: 'Method not allowed'
            });
        }

        return updatePermissions(req, res, id);
    } catch (error) {
        console.error('Error handling permissions request:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error processing permissions request'
        });
    }
}

// PATCH to update a user's permissions
async function updatePermissions(req, res, id) {
    try {
        const { permissions } = req.body;

        // Validate input
        if (!permissions || typeof permissions !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Invalid permissions format'
            });
        }

        // Validate expected permission keys
        const validPermissionKeys = ['dashboard', 'transactions', 'reports', 'accounts', 'settings'];
        const permissionKeys = Object.keys(permissions);

        // Check if all provided keys are valid
        const hasInvalidKeys = permissionKeys.some(key => !validPermissionKeys.includes(key));
        if (hasInvalidKeys) {
            return res.status(400).json({
                success: false,
                message: 'Invalid permission keys provided'
            });
        }

        // Check if trying to update admin user
        if (id === '1') {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify admin permissions'
            });
        }

        // In a real app, you would update the permissions in your database
        // For now we just return success with the updated permissions
        return res.status(200).json({
            success: true,
            message: 'User permissions updated successfully',
            data: {
                id: parseInt(id),
                permissions
            }
        });
    } catch (error) {
        console.error('Error updating permissions:', error);
        return res.status(500).json({
            success: false,
            message: 'Error updating permissions'
        });
    }
} 