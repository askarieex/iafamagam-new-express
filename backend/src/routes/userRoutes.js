const express = require('express');
const userController = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { User } = require('../models');

const router = express.Router();

// Public route for debugging
router.get('/debug', async (req, res) => {
    try {
        console.log('Fetching all users for debug purposes');
        const users = await User.findAll({
            attributes: ['id', 'name', 'email', 'role', 'createdAt']
        });

        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching users'
        });
    }
});

// All routes below are protected and require admin access
router.use(protect);
router.use(authorize('admin'));

// User management routes
router.get('/', userController.getUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.patch('/:id/permissions', userController.updatePermissions);
router.delete('/:id', userController.deleteUser);

// Admin route to get a specific user
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching user'
        });
    }
});

module.exports = router; 