const express = require('express');
const cors = require('cors');
const app = express();

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://192.168.1.2:3000'],
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
const monthlyClosureController = require('./controllers/monthlyClosureController');
const db = require('./models');
// ... other route imports ...

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', require('./routes/accountRoutes'));
app.use('/api/ledger-heads', require('./routes/ledgerHeadRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/cheques', require('./routes/chequeRoutes'));
app.use('/api/booklets', require('./routes/bookletRoutes'));
app.use('/api/donors', require('./routes/donorRoutes'));
app.use('/api/bank-accounts', require('./routes/bankAccountRoutes'));
app.use('/api/monthly-closure', require('./routes/monthlyClosureRoutes'));
app.use('/api/monthly-ledger-balances', require('./routes/monthlyLedgerBalanceRoutes'));
app.use('/api/reconciliation', require('./routes/reconciliationRoutes'));
app.use('/api/users', userRoutes);
// ... other route uses ...

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

// Add this function before the app.listen call
/**
 * Initialize system startup tasks
 */
const runSystemStartupTasks = async () => {
  try {
    console.log('Running system startup tasks...');
    
    // 1. Auto-open current month for all active accounts if no period is open
    const accounts = await db.Account.findAll({
      where: { is_active: true }
    });
    
    console.log(`Checking ${accounts.length} active accounts for open periods...`);
    
    for (const account of accounts) {
      try {
        const result = await monthlyClosureController.ensureCurrentPeriodOpen(account.id);
        if (result.success && result.autoOpened) {
          console.log(`Auto-opened period for account ${account.id} - ${account.name}`);
        }
      } catch (err) {
        console.error(`Error auto-opening period for account ${account.id}:`, err);
      }
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