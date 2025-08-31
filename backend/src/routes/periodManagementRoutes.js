const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const periodService = require('../services/periodManagementService');
const db = require('../models');

// Get the currently open period for an account
// GET /api/periods/current-open?account_id=1
router.get('/current-open', protect, async (req, res) => {
    try {
        const { account_id } = req.query;

        if (!account_id) {
            return res.status(400).json({
                success: false,
                message: 'Account ID is required'
            });
        }

        const openPeriod = await periodService.getCurrentOpenPeriod(parseInt(account_id));

        res.json({
            success: true,
            data: openPeriod,
            message: openPeriod ? 'Open period found' : 'No open period found'
        });

    } catch (error) {
        console.error('Error getting current open period:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get current open period',
            error: error.message
        });
    }
});

// Get period statuses for a specific account and year
// GET /api/periods/year-status?account_id=1&year=2025
router.get('/year-status', protect, async (req, res) => {
    try {
        const { account_id, year } = req.query;

        if (!account_id || !year) {
            return res.status(400).json({
                success: false,
                message: 'Account ID and year are required'
            });
        }

        // Get all periods for this account and year
        const periods = await db.AccountingPeriod.findAll({
            where: {
                account_id: parseInt(account_id),
                year: parseInt(year)
            },
            order: [['month', 'ASC']]
        });

        // Create a status object for all 12 months
        const monthStatuses = {};
        for (let month = 1; month <= 12; month++) {
            monthStatuses[month] = false; // Default to closed
        }

        // Set actual statuses from database
        periods.forEach(period => {
            monthStatuses[period.month] = period.status === 'open';
        });

        res.json({
            success: true,
            data: {
                account_id: parseInt(account_id),
                year: parseInt(year),
                periods: monthStatuses
            },
            message: `Period statuses for ${year}`
        });

    } catch (error) {
        console.error('Error getting year period statuses:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get year period statuses',
            error: error.message
        });
    }
});

// Get all open periods across all accounts
// GET /api/periods/all-open
router.get('/all-open', protect, async (req, res) => {
    try {
        const openPeriods = await periodService.getAllOpenPeriods();

        res.json({
            success: true,
            data: openPeriods,
            count: openPeriods.length,
            message: `Found ${openPeriods.length} open periods`
        });

    } catch (error) {
        console.error('Error getting all open periods:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get open periods',
            error: error.message
        });
    }
});

// Check if a specific date is within an open period
// GET /api/periods/validate-date?account_id=1&date=2025-08-15
router.get('/validate-date', protect, async (req, res) => {
    try {
        const { account_id, date } = req.query;

        if (!account_id || !date) {
            return res.status(400).json({
                success: false,
                message: 'Account ID and date are required'
            });
        }

        const isValid = await periodService.isDateInOpenPeriod(parseInt(account_id), date);
        const openPeriod = await periodService.getCurrentOpenPeriod(parseInt(account_id));

        res.json({
            success: true,
            data: {
                isValid,
                date,
                openPeriod: openPeriod ? {
                    month: openPeriod.month,
                    year: openPeriod.year,
                    displayName: openPeriod.getDisplayName()
                } : null
            },
            message: isValid ? 'Date is valid for transaction' : 'Date is not within an open accounting period'
        });

    } catch (error) {
        console.error('Error validating date:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate date',
            error: error.message
        });
    }
});

// Get specific period information
// GET /api/periods/get?account_id=1&month=8&year=2025
router.get('/get', protect, async (req, res) => {
    try {
        const { account_id, month, year } = req.query;

        if (!account_id || !month || !year) {
            return res.status(400).json({
                success: false,
                message: 'Account ID, month, and year are required'
            });
        }

        const period = await periodService.getPeriod(
            parseInt(account_id), 
            parseInt(month), 
            parseInt(year)
        );

        res.json({
            success: true,
            data: period,
            message: period ? 'Period found' : 'Period not found'
        });

    } catch (error) {
        console.error('Error getting period:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get period',
            error: error.message
        });
    }
});

// Open an accounting period
// POST /api/periods/open
// Body: { account_id, month, year, notes?, force_open? }
router.post('/open', protect, authorize('admin'), async (req, res) => {
    try {
        const { account_id, month, year, notes, force_open } = req.body;

        if (!account_id || !month || !year) {
            return res.status(400).json({
                success: false,
                message: 'Account ID, month, and year are required'
            });
        }

        const result = await periodService.openPeriod(
            parseInt(account_id),
            parseInt(month),
            parseInt(year),
            {
                userId: req.user.id,
                notes: notes || null,
                isAutoOpened: false,
                forceOpen: force_open || false
            }
        );

        // Log audit trail for force open operations
        if (force_open && result.success) {
            console.log(`🔐 AUDIT: User ${req.user.id} (${req.user.email}) force-opened period ${month}/${year} for account ${account_id} at ${new Date().toISOString()}`);
            
            // Create audit log entry if available
            try {
                await db.AuditLog.create({
                    user_id: req.user.id,
                    action: 'FORCE_OPEN_PERIOD',
                    entity_type: 'accounting_period',
                    entity_id: result.period.id,
                    old_values: null,
                    new_values: {
                        account_id: parseInt(account_id),
                        month: parseInt(month),
                        year: parseInt(year),
                        force_opened: true,
                        multiple_periods_open: result.multipleOpenPeriods ? result.multipleOpenPeriods.length : 1
                    },
                    ip_address: req.ip,
                    user_agent: req.get('User-Agent')
                });
            } catch (auditError) {
                console.warn('Failed to create audit log entry:', auditError.message);
            }
        }

        res.status(result.success ? 200 : 400).json(result);

    } catch (error) {
        console.error('Error opening period:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to open period',
            error: error.message
        });
    }
});

// Close an accounting period
// POST /api/periods/close
// Body: { account_id, month, year, notes? }
router.post('/close', protect, authorize('admin'), async (req, res) => {
    try {
        const { account_id, month, year, notes } = req.body;

        if (!account_id || !month || !year) {
            return res.status(400).json({
                success: false,
                message: 'Account ID, month, and year are required'
            });
        }

        const result = await periodService.closePeriod(
            parseInt(account_id),
            parseInt(month),
            parseInt(year),
            {
                userId: req.user.id,
                notes: notes || null
            }
        );

        res.status(result.success ? 200 : 400).json(result);

    } catch (error) {
        console.error('Error closing period:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to close period',
            error: error.message
        });
    }
});

// Get period history for an account
// GET /api/periods/history?account_id=1&limit=12
router.get('/history', protect, async (req, res) => {
    try {
        const { account_id, limit = 12 } = req.query;

        if (!account_id) {
            return res.status(400).json({
                success: false,
                message: 'Account ID is required'
            });
        }

        const history = await periodService.getPeriodHistory(
            parseInt(account_id),
            parseInt(limit)
        );

        res.json({
            success: true,
            data: history,
            count: history.length,
            message: `Found ${history.length} periods in history`
        });

    } catch (error) {
        console.error('Error getting period history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get period history',
            error: error.message
        });
    }
});

// Auto-ensure current period is open (used by transaction services)
// POST /api/periods/auto-ensure-open
// Body: { account_id }
router.post('/auto-ensure-open', protect, async (req, res) => {
    try {
        const { account_id } = req.body;

        if (!account_id) {
            return res.status(400).json({
                success: false,
                message: 'Account ID is required'
            });
        }

        const result = await periodService.autoEnsureCurrentPeriodOpen(parseInt(account_id));

        res.json(result);

    } catch (error) {
        console.error('Error auto-ensuring period:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to auto-ensure period',
            error: error.message
        });
    }
});

// Migrate existing period data from old system
// POST /api/periods/migrate-data
router.post('/migrate-data', protect, authorize('admin'), async (req, res) => {
    try {
        console.log('Starting period data migration...');
        
        const result = await periodService.migrateExistingPeriodData();

        res.json({
            success: result.success,
            data: result,
            message: `Migration completed: ${result.migratedCount} periods migrated, ${result.existingCount} already existed`
        });

    } catch (error) {
        console.error('Error migrating period data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to migrate period data',
            error: error.message
        });
    }
});

// Validate period consistency across the system
// GET /api/periods/validate-consistency
router.get('/validate-consistency', protect, authorize('admin'), async (req, res) => {
    try {
        console.log('Starting period consistency validation...');
        
        const result = await periodService.validatePeriodConsistency();

        res.json({
            success: result.success,
            data: result,
            message: result.isConsistent 
                ? 'All periods are consistent' 
                : `Found ${result.inconsistencies.length} inconsistencies`
        });

    } catch (error) {
        console.error('Error validating period consistency:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate period consistency',
            error: error.message
        });
    }
});

// Get valid months that can be opened for backdating (only immediate previous month)
// GET /api/periods/valid-months?account_id=1
router.get('/valid-months', protect, async (req, res) => {
    try {
        const { account_id } = req.query;

        if (!account_id) {
            return res.status(400).json({
                success: false,
                message: 'Account ID is required'
            });
        }

        const result = await periodService.getValidPreviousMonth(parseInt(account_id));

        res.json({
            success: true,
            data: {
                validMonth: result.validMonth,
                validYear: result.validYear,
                displayName: result.displayName,
                isCurrentMonth: result.isCurrentMonth,
                canOpenBack: result.canOpenBack,
                reason: result.reason
            },
            message: result.canOpenBack 
                ? `Can open ${result.displayName} for backdating` 
                : `Cannot open back periods: ${result.reason}`
        });

    } catch (error) {
        console.error('Error getting valid months:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get valid months',
            error: error.message
        });
    }
});

module.exports = router;