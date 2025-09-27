/**
 * Monthly Report Routes
 *
 * API routes for monthly financial reporting functionality
 */

const express = require('express');
const router = express.Router();
const monthlyReportController = require('../controllers/simpleMonthlyReportController');

// Auth middleware is applied at the app level in app.js, so not needed here

// Core routes
router.get('/monthly/:year/:month/:accountId', monthlyReportController.generateMonthlyReport);
router.get('/available-months/:accountId', monthlyReportController.getAvailableMonths);

// Export router
module.exports = router;