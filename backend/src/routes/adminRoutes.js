const express = require('express');
const userController = require('../controllers/userController');
const balanceRecalculationController = require('../controllers/balanceRecalculationController');
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

// Balance recalculation routes
router.post('/recalculate-balances', balanceRecalculationController.recalculateAllBalances);
router.post('/recalculate-balances/:accountId', balanceRecalculationController.recalculateAccountBalances);
router.get('/validate-balances', balanceRecalculationController.validateBalances);
router.post('/recalculate-balance/:ledgerHeadId', balanceRecalculationController.recalculateLedgerHeadBalance);

module.exports = router; 