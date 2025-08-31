const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const globalPeriodService = require('../services/globalPeriodService');

/**
 * Global Period Management Routes
 * All routes require authentication
 */

/**
 * GET /api/global-periods/current
 * Get the currently open global period
 */
router.get('/current', protect, async (req, res) => {
    try {
        const openPeriod = await globalPeriodService.getCurrentOpenPeriod();
        
        res.json({
            success: true,
            message: openPeriod ? 'Found open period' : 'No open period',
            data: openPeriod
        });

    } catch (error) {
        console.error('Error getting current open period:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving current period',
            error: error.message
        });
    }
});

/**
 * GET /api/global-periods/status/:year
 * Get period status for entire year
 */
router.get('/status/:year', protect, async (req, res) => {
    try {
        const year = parseInt(req.params.year);
        
        if (!year || year < 2000 || year > 2100) {
            return res.status(400).json({
                success: false,
                message: 'Invalid year provided'
            });
        }

        const yearStatus = await globalPeriodService.getYearStatus(year);
        
        res.json({
            success: true,
            message: `Retrieved period status for ${year}`,
            data: yearStatus
        });

    } catch (error) {
        console.error('Error getting year status:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving year status',
            error: error.message
        });
    }
});

/**
 * GET /api/global-periods/status/:year/:month
 * Get period status for specific month
 */
router.get('/status/:year/:month', protect, async (req, res) => {
    try {
        const year = parseInt(req.params.year);
        const month = parseInt(req.params.month);
        
        if (!year || year < 2000 || year > 2100) {
            return res.status(400).json({
                success: false,
                message: 'Invalid year provided'
            });
        }

        if (!month || month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                message: 'Invalid month provided'
            });
        }

        const periodStatus = await globalPeriodService.getPeriodStatus(month, year);
        
        res.json({
            success: true,
            message: `Retrieved period status for ${month}/${year}`,
            data: periodStatus
        });

    } catch (error) {
        console.error('Error getting period status:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving period status',
            error: error.message
        });
    }
});

/**
 * POST /api/global-periods/open
 * Open a global period
 */
router.post('/open', protect, async (req, res) => {
    try {
        const { month, year, notes } = req.body;
        const userId = req.user.id;

        if (!month || month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                message: 'Invalid month provided (1-12 required)'
            });
        }

        if (!year || year < 2000 || year > 2100) {
            return res.status(400).json({
                success: false,
                message: 'Invalid year provided'
            });
        }

        const result = await globalPeriodService.openPeriod(month, year, userId, notes);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        console.error('Error opening global period:', error);
        res.status(500).json({
            success: false,
            message: 'Error opening period',
            error: error.message
        });
    }
});

/**
 * POST /api/global-periods/close
 * Close the currently open global period
 */
router.post('/close', protect, async (req, res) => {
    try {
        const { notes } = req.body;
        const userId = req.user.id;

        const result = await globalPeriodService.closePeriod(userId, notes);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        console.error('Error closing global period:', error);
        res.status(500).json({
            success: false,
            message: 'Error closing period',
            error: error.message
        });
    }
});

/**
 * GET /api/global-periods/validate-date/:date
 * Check if a date is in the open period
 */
router.get('/validate-date/:date', protect, async (req, res) => {
    try {
        const { date } = req.params;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date is required'
            });
        }

        const isValid = await globalPeriodService.isDateInOpenPeriod(date);
        
        res.json({
            success: true,
            message: isValid ? 'Date is in open period' : 'Date is not in open period',
            data: {
                date,
                isInOpenPeriod: isValid
            }
        });

    } catch (error) {
        console.error('Error validating date:', error);
        res.status(500).json({
            success: false,
            message: 'Error validating date',
            error: error.message
        });
    }
});

/**
 * GET /api/global-periods/history
 * Get period history (all periods)
 */
router.get('/history', protect, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const db = require('../models');

        const periods = await db.GlobalPeriod.findAll({
            include: [
                {
                    model: db.User,
                    as: 'openedByUser',
                    attributes: ['id', 'name', 'email']
                },
                {
                    model: db.User,
                    as: 'closedByUser',
                    attributes: ['id', 'name', 'email']
                }
            ],
            order: [['year', 'DESC'], ['month', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            message: 'Retrieved period history',
            data: periods
        });

    } catch (error) {
        console.error('Error getting period history:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving period history',
            error: error.message
        });
    }
});

module.exports = router;