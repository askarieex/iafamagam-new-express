const express = require('express');
const cors = require('cors');
const { protect, authorize } = require('./middleware/authMiddleware');
const app = express();

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://192.168.1.2:3000'],
  credentials: true
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
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
const periodManagementRoutes = require('./routes/periodManagementRoutes');
const globalPeriodRoutes = require('./routes/globalPeriodRoutes');
const monthlyClosureController = require('./controllers/monthlyClosureController');
const periodService = require('./services/periodManagementService');
const globalPeriodService = require('./services/globalPeriodService');
const db = require('./models');
// ... other route imports ...

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Protected routes - all require authentication
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

// Add this function before the app.listen call
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

// Modify the app.listen call to run startup tasks first
const PORT = process.env.PORT || 3001;
db.sequelize.sync().then(() => {
  runSystemStartupTasks().then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  });
}); 