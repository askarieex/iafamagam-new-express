const express = require('express');
const authController = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes
router.get('/me', protect, authController.getMe);

// Admin routes
router.post('/register-admin', protect, authorize('admin'), authController.register);

module.exports = router; 