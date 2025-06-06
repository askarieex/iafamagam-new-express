const express = require('express');
const cron = require('node-cron');
const runMonthEndClosure = require('./jobs/monthEndClosure');
const autoClosePreviousMonth = require('./jobs/autoClosePreviousMonth');
const cookieParser = require('cookie-parser');
const seedAdminUser = require('./seeders/adminUserSeeder');

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
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
// Import Sequelize models
const db = require('./models');
const monthlyClosureService = require('./services/monthlyClosureService');
const { protect, authorize } = require('./middleware/authMiddleware');

const cors = require('cors');
require('dotenv').config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3002;

// CORS configuration
const corsOptions = {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], // Add your frontend URLs
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
    .then(async () => {
        console.log('Database connected successfully');

        // Seed the default admin user
        await seedAdminUser();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Unable to connect to the database:', err);
    });

module.exports = app;