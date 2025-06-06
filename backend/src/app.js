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