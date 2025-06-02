const express = require('express');
const cron = require('node-cron');
const runMonthEndClosure = require('./jobs/monthEndClosure');
const autoClosePreviousMonth = require('./jobs/autoClosePreviousMonth');

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
// Import Sequelize models
const db = require('./models');
const monthlyClosureService = require('./services/monthlyClosureService');

const cors = require('cors');
require('dotenv').config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3002;

// CORS configuration
const corsOptions = {
    origin: '*', // In production, replace with specific origins
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Root route
app.get('/', (req, res) => {
    res.send('IAFA Software API is running');
});

// Mount routes
app.use('/api/accounts', accountRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/ledger-heads', ledgerHeadRoutes);
app.use('/api/monthly-ledger-balances', monthlyLedgerBalanceRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/booklets', bookletRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/cheques', chequeRoutes);
app.use('/api/monthly-closure', monthlyClosureRoutes);

// 404 handler for undefined routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Schedule month-end job to run at 2:00 AM on the 1st day of each month
cron.schedule('0 2 1 * *', async () => {
    console.log('Running month-end procedures...');
    await runMonthEndClosure();
});

// Schedule the auto-close job to run at 1:00 AM on the 1st day of each month
// This ensures the previous month is closed automatically when a new month begins
cron.schedule('0 1 1 * *', async () => {
    console.log('Auto-closing previous month...');
    try {
        // Get the previous month and year
        const today = new Date();
        let prevMonth = today.getMonth(); // 0-11, current month - 1 gives the previous month
        let prevYear = today.getFullYear();

        // Handle January case
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear--;
        }

        console.log(`Auto-closing month ${prevMonth}/${prevYear} for all accounts`);

        // Use the monthlyClosureService to close the previous month for all accounts
        const result = await monthlyClosureService.closeAccountingPeriod(prevMonth, prevYear);
        console.log('Auto-close completed:', result);
    } catch (error) {
        console.error('Error during auto-close of previous month:', error);
    }
});

console.log('Month-end closure scheduled for 2:00 AM on the 1st day of each month');
console.log('Auto-close previous month scheduled for 1:00 AM on the 1st day of each month');

// Sync database and start server without dropping tables
db.sequelize.sync()
    .then(() => {
        console.log('Database connected successfully');
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Unable to connect to the database:', err);
    });

module.exports = app;