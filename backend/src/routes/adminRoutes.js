const express = require('express');
const userController = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes are protected and require admin access
router.use(protect);
router.use(authorize('admin'));

// Admin user management routes
router.get('/users', userController.getUsers);
router.get('/users/:id', userController.getUserById);
router.post('/users', userController.createUser);
router.put('/users/:id', userController.updateUser);
router.patch('/users/:id/permissions', userController.updatePermissions);
router.delete('/users/:id', userController.deleteUser);

module.exports = router; 