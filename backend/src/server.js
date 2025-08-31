const express = require('express');
const cron = require('node-cron');
const monthEndClosure = require('./jobs/monthEndClosure');
const autoClosePreviousMonth = require('./jobs/autoClosePreviousMonth');
const reconcileBalances = require('./jobs/reconcileBalances');
const cookieParser = require('cookie-parser');
const seedAdminUser = require('./seeders/adminUserSeeder');

// Import controllers
const monthlyClosureController = require('./controllers/monthlyClosureController');

// Import routes
const accountRoutes = require('./routes/accountRoutes');
const bankAccountRoutes = require('./routes/bankAccountRoutes');
const ledgerHeadRoutes = require('./routes/ledgerHeadRoutes');
const monthlyLedgerBalanceRoutes = require('./routes/monthlyLedgerBalanceRoutes');
const donorRoutes = require('./routes/donorRoutes');
const bookletRoutes = require('./routes/bookletRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const chequeRoutes = require('./routes/chequeRoutes');
const monthlyClosureRoutes = require('./routes/monthlyClosureRoutes');
const reconciliationRoutes = require('./routes/reconciliationRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const periodManagementRoutes = require('./routes/periodManagementRoutes');
const globalPeriodRoutes = require('./routes/globalPeriodRoutes');

// Import Sequelize models
const db = require('./models');
const monthlyClosureService = require('./services/monthlyClosureService');
const globalPeriodService = require('./services/globalPeriodService');
const { protect, authorize } = require('./middleware/authMiddleware');

const cors = require('cors');
require('dotenv').config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3002;

// CORS configuration
const corsOptions = {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.1.2:3000'], // Add your frontend URLs
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true // Allow cookies to be sent with requests
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Public routes (no authentication required)
app.use('/api/auth', authRoutes);
app.get('/', (req, res) => {
    res.send('IAFA Software API is running');
});

// Protected routes (authentication required)
app.use('/api/users', protect, userRoutes);
app.use('/api/admin', protect, authorize('admin'), adminRoutes);

// Other protected routes - all require authentication
app.use('/api/accounts', protect, accountRoutes);
app.use('/api/bank-accounts', protect, bankAccountRoutes);
app.use('/api/ledger-heads', protect, ledgerHeadRoutes);
app.use('/api/monthly-ledger-balances', protect, monthlyLedgerBalanceRoutes);
app.use('/api/donors', protect, donorRoutes);
app.use('/api/booklets', protect, bookletRoutes);
app.use('/api/transactions', protect, transactionRoutes);
app.use('/api/cheques', protect, chequeRoutes);
app.use('/api/monthly-closure', protect, monthlyClosureRoutes);
app.use('/api/reconciliation', protect, authorize('admin'), reconciliationRoutes);
app.use('/api/periods', protect, periodManagementRoutes);
app.use('/api/global-periods', protect, globalPeriodRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler for undefined routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Schedule all jobs
// IMPORTANT: These jobs have been updated to respect manual period management
// They will NOT automatically close periods - only ensure current periods are available

// Run period maintenance every night at 11:30 PM
// This job ensures current periods are open but DOES NOT auto-close periods
cron.schedule('30 23 * * *', async () => {
    console.log('Running scheduled period maintenance job');
    try {
        await monthEndClosure();
        console.log('Period maintenance job completed successfully');
    } catch (error) {
        console.error('Period maintenance job failed:', error);
    }
});

// Run period availability check at 1 AM on the 1st day of each month  
// This job ensures current periods are available but DOES NOT auto-close previous periods
cron.schedule('0 1 1 * *', async () => {
    console.log('Running scheduled period availability check');
    try {
        await autoClosePreviousMonth();
        console.log('Period availability check completed successfully');
    } catch (error) {
        console.error('Period availability check failed:', error);
    }
});

// Run balance reconciliation job every night at 2 AM
cron.schedule('0 2 * * *', async () => {
    console.log('Running scheduled balance reconciliation job');
    try {
        await reconcileBalances();
        console.log('Balance reconciliation job completed successfully');
    } catch (error) {
        console.error('Balance reconciliation job failed:', error);
    }
});

/**
 * Initialize system startup tasks
 */
const runSystemStartupTasks = async () => {
    try {
        console.log('Running system startup tasks...');

        // 1. Ensure global period is open (replaces account-specific period management)
        console.log('Checking global period status...');
        try {
            const result = await globalPeriodService.autoEnsureCurrentPeriodOpen();
            if (result.success && result.autoOpened) {
                console.log('Auto-opened current global period');
            } else if (result.success) {
                console.log('Global period already open');
            } else {
                console.error('Failed to ensure global period is open:', result.error);
            }
        } catch (err) {
            console.error('Error managing global period:', err);
        }

        console.log('System startup tasks completed');
    } catch (error) {
        console.error('Error running system startup tasks:', error);
    }
};

// Sync database and start server without dropping tables
db.sequelize.sync()
    .then(async () => {
        console.log('Database connected successfully');

        // Seed the default admin user
        await seedAdminUser();

        // Run system startup tasks
        await runSystemStartupTasks();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Unable to connect to the database:', err);
    });

module.exports = app;