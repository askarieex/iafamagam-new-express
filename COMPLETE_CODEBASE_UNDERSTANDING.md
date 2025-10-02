# IAFA Software - Complete Codebase Understanding

> **Generated**: 2025-10-02
> **Purpose**: Comprehensive documentation of the entire IAFA Software codebase for rapid understanding and development

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Backend Components](#backend-components)
5. [Frontend Components](#frontend-components)
6. [Business Logic](#business-logic)
7. [Authentication & Authorization](#authentication--authorization)
8. [Key Features](#key-features)
9. [Development Guide](#development-guide)
10. [Known Issues & Solutions](#known-issues--solutions)

---

## System Overview

### What is IAFA Software?
IAFA (Islamic Accounting Financial Application) is a **sophisticated financial management system** designed for Islamic accounting principles. It provides:
- ✅ **Immutable transaction logging** (blockchain-inspired)
- ✅ **Real-time balance calculations**
- ✅ **Monthly financial reporting**
- ✅ **Multi-account management**
- ✅ **Donor tracking and receipt management**
- ✅ **Audit trail with cryptographic integrity**

### Technology Stack
```
Backend:
- Node.js v14+
- Express.js 4.18.2
- PostgreSQL (with JSONB support)
- Sequelize ORM 6.37.7
- JWT authentication
- bcryptjs for password hashing
- node-cron for scheduled tasks

Frontend:
- Next.js 14.0.4
- React 18.2.0
- TailwindCSS 3.4.17
- Axios for API calls
- React Icons
- React Hot Toast for notifications

Development Tools:
- nodemon (auto-restart)
- sequelize-cli (migrations)
- rimraf (cleanup)
```

### Project Structure
```
iafamagam-new-express/
├── backend/
│   ├── src/
│   │   ├── models/              # Database models (Sequelize)
│   │   ├── controllers/         # API request handlers
│   │   ├── services/            # Business logic layer
│   │   ├── routes/              # API route definitions
│   │   ├── middleware/          # Auth, validation, etc.
│   │   ├── migrations/          # Database schema migrations
│   │   ├── seeders/             # Seed data
│   │   ├── config/              # Configuration files
│   │   ├── scripts/             # Utility scripts
│   │   └── startup/             # Initialization scripts
│   └── package.json
├── frontend/
│   ├── pages/                   # Next.js pages (routes)
│   ├── components/              # Reusable React components
│   ├── contexts/                # React Context providers
│   ├── hooks/                   # Custom React hooks
│   ├── layouts/                 # Page layouts
│   ├── lib/                     # Utility libraries
│   ├── styles/                  # CSS files
│   └── package.json
└── README.md
```

---

## Architecture

### System Design Principles

#### 1. **Immutable Log-Based System**
- All transactions are **append-only** (never modified or deleted)
- Each transaction creates an **immutable log entry**
- Corrections create **new log entries** referencing originals
- **Cryptographic hash chaining** ensures integrity

#### 2. **Double-Entry Accounting**
```
Credit Transactions (Income):
┌─────────────────┐
│  Donor Donates  │
└────────┬────────┘
         ↓
   ┌─────────────┐
   │ Credit Head │ (Income category increases)
   └─────────────┘

Debit Transactions (Expenses):
┌────────────────────┐
│ Money Spent On X   │
└──────────┬─────────┘
           ↓
     ┌──────────┐
     │ Debit    │ (Expense category increases)
     │ Head     │
     └──────────┘
           ↓
     ┌──────────┐
     │ Credit   │ (Income/Fund category decreases)
     │ Head     │ 
     │ (Source) │
     └──────────┘
```

#### 3. **Period-Based Reporting**
- **Real-time calculations** for current month
- **Snapshot-based** for historical months
- **Automatic balance continuity** across periods

---

## Database Schema

### Core Tables

#### 1. **transaction_log** (Most Important)
The heart of the immutable system.

```sql
CREATE TABLE transaction_log (
    log_id BIGSERIAL PRIMARY KEY,
    transaction_uuid UUID NOT NULL,
    log_sequence INTEGER DEFAULT 1,
    action_type VARCHAR(50) CHECK (action_type IN ('CREATE', 'CORRECT_AMOUNT', 'CORRECT_DATE', 'REVERSE', 'VOID')),
    
    -- Financial Data
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    ledger_head_id INTEGER NOT NULL REFERENCES ledger_heads(id),
    amount DECIMAL(15,2) NOT NULL,
    cash_amount DECIMAL(15,2) DEFAULT 0,
    bank_amount DECIMAL(15,2) DEFAULT 0,
    tx_type VARCHAR(10) CHECK (tx_type IN ('credit', 'debit')),
    cash_type VARCHAR(20) NOT NULL,
    
    -- CRITICAL: Source ledger for debit transactions
    source_ledger_head_id INTEGER REFERENCES ledger_heads(id),
    
    -- Date/Time
    transaction_date DATE NOT NULL,
    transaction_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Audit & Security
    created_by INTEGER REFERENCES users(id),
    client_ip INET NOT NULL,
    user_agent TEXT,
    session_id VARCHAR(255),
    
    -- Cryptographic Integrity
    previous_hash VARCHAR(64),
    current_hash VARCHAR(64) NOT NULL,
    daily_hash VARCHAR(64),
    
    -- Additional Fields
    description TEXT NOT NULL,
    correction_reason TEXT,
    reference_log_id BIGINT REFERENCES transaction_log(log_id),
    booklet_id INTEGER REFERENCES booklets(id),
    donor_id INTEGER REFERENCES donors(id),
    receipt_number INTEGER,
    
    -- Approval System
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_level INTEGER DEFAULT 0,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    
    CONSTRAINT no_updates CHECK (false), -- Prevents updates via hook
    CONSTRAINT no_deletes CHECK (false)  -- Prevents deletes via hook
);
```

**Key Features**:
- **Immutable**: Hooks prevent UPDATE and DELETE operations
- **Hash Chain**: Each transaction links to previous via hash
- **Source Tracking**: `source_ledger_head_id` critical for balance calculations
- **Audit Trail**: Complete user, IP, timestamp tracking

#### 2. **ledger_heads** (Chart of Accounts)
Defines income and expense categories.

```sql
CREATE TABLE ledger_heads (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    name VARCHAR(255) NOT NULL,
    
    -- Type Classification
    head_type VARCHAR(10) CHECK (head_type IN ('credit', 'debit')),
    dependency_type VARCHAR(20) CHECK (dependency_type IN ('independent', 'dependent', 'expense')),
    
    -- Current Balances (Updated in real-time)
    current_balance DECIMAL(15,2) DEFAULT 0,
    cash_balance DECIMAL(15,2) DEFAULT 0,
    bank_balance DECIMAL(15,2) DEFAULT 0,
    
    -- Islamic Accounting
    is_restricted BOOLEAN DEFAULT FALSE,
    islamic_category VARCHAR(100),
    spending_rules TEXT,
    
    -- Metadata
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Types Explained**:
- **Credit Heads** (`head_type = 'credit'`): Income sources (donations, grants, etc.)
- **Debit Heads** (`head_type = 'debit'`): Expense categories (salaries, utilities, etc.)

#### 3. **accounts**
Organizational units (departments, projects, etc.)

```sql
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    opening_balance DECIMAL(15,2) DEFAULT 0,
    closing_balance DECIMAL(15,2) DEFAULT 0,
    cash_balance DECIMAL(15,2) DEFAULT 0,
    bank_balance DECIMAL(15,2) DEFAULT 0,
    last_closed_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 4. **monthly_balance_summaries**
Month-end snapshots for historical reporting.

```sql
CREATE TABLE monthly_balance_summaries (
    id SERIAL PRIMARY KEY,
    ledger_head_id INTEGER NOT NULL REFERENCES ledger_heads(id),
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    month_year DATE NOT NULL, -- First day of month
    
    -- Balance Data
    opening_balance DECIMAL(15,2) DEFAULT 0,
    closing_balance DECIMAL(15,2) DEFAULT 0,
    total_credits DECIMAL(15,2) DEFAULT 0,
    total_debits DECIMAL(15,2) DEFAULT 0,
    cash_amount DECIMAL(15,2) DEFAULT 0,
    bank_amount DECIMAL(15,2) DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    
    -- Status
    is_finalized BOOLEAN DEFAULT FALSE,
    last_calculated_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(ledger_head_id, account_id, month_year)
);
```

#### 5. **users** (Authentication)
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- bcrypt hashed
    role VARCHAR(20) CHECK (role IN ('admin', 'user')),
    permissions JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Supporting Tables
- **donors**: Donation tracking
- **booklets**: Receipt booklet management
- **cheques**: Check processing
- **bank_accounts**: Bank account details
- **audit_logs**: System-wide audit trail

---

## Backend Components

### Models (`/backend/src/models/`)

All models use **Sequelize ORM** and follow the factory pattern.

#### Key Models

**1. transactionLog.js** (★★★★★ Critical)
```javascript
// Immutable transaction log with hash chaining
class TransactionLog extends Model {
    // Instance methods
    isOriginalTransaction() { }
    isCorrection() { }
    getEffectiveAmount() { }
    needsApproval() { }
    getStatus() { }
    
    // Hooks prevent updates/deletes
    beforeUpdate: () => { throw new Error('FORBIDDEN: Immutable') }
    beforeDestroy: () => { throw new Error('FORBIDDEN: Immutable') }
}
```

**2. ledgerHead.js** (★★★★☆)
```javascript
class LedgerHead extends Model {
    getBalanceBreakdown() {
        return {
            total: this.current_balance,
            cash: this.cash_balance,
            bank: this.bank_balance,
            percentage: { ... }
        };
    }
}
```

**3. account.js**, **user.js**, **donor.js**, **booklet.js**, **cheque.js**
Standard Sequelize models with associations.

### Controllers (`/backend/src/controllers/`)

Controllers handle HTTP requests and responses.

#### Key Controllers

**1. immutableTransactionController.js** (★★★★★)
Handles all transaction operations in the immutable system.

```javascript
class ImmutableTransactionController {
    // Create transactions
    createCredit(req, res)   // POST /api/transactions/credit
    createDebit(req, res)    // POST /api/transactions/debit
    
    // Query transactions
    getTransactionHistory(req, res)
    getBalanceSummary(req, res)
    getLiveBalanceSummary(req, res)
    
    // Validation
    validateDate(req, res)
    verifySystemIntegrity(req, res)
    
    // Blocked operations (security)
    blockedUpdateTransaction(req, res)   // Returns 403
    blockedDeleteTransaction(req, res)   // Returns 403
}
```

**2. simpleMonthlyReportController.js** (★★★★★)
Generates monthly financial reports.

```javascript
class SimpleMonthlyReportController {
    async generateMonthlyReport(req, res) {
        // Real-time calculation for current month
        // Snapshot-based for historical months
        // Returns structured report data
    }
    
    async getAvailableMonths(req, res) {
        // Returns list of months with data
    }
}
```

**3. transactionController.js** (★★★☆☆)
Legacy transaction controller (being phased out).

**4. authController.js** (★★★★☆)
Authentication and user management.

### Services (`/backend/src/services/`)

Business logic layer - where the magic happens!

#### Key Services

**1. immutableTransactionService.js** (★★★★★)
Core transaction processing logic.

```javascript
class ImmutableTransactionService {
    // Transaction Creation
    async createCreditTransaction(data, userContext) {
        // 1. Validate data
        // 2. Check date restrictions
        // 3. Create log entry with hash
        // 4. Update ledger balances
        // 5. Handle receipt booklet
        // 6. Create audit trail
        // 7. Trigger balance recalculation
    }
    
    async createDebitTransaction(data, userContext) {
        // Similar to credit but:
        // - Validates source balance
        // - Updates source ledger
        // - Updates destination ledger
    }
    
    // Date Validation
    async validateTransactionDate(date, userContext) {
        // Simplified 30-day no-approval system
        // Returns: { allowed, approvalLevel, reason, warning }
    }
    
    // Balance Calculations
    async calculateCurrentBalance(accountId, ledgerHeadId, asOfDate)
    async getBalanceSummary(accountId, ledgerHeadId, asOfDate)
    
    // Critical helper
    async updateLedgerHeadBalance(logEntry, transaction)
    async updateSourceLedgerBalance(logEntry, sourceLedgerHeadId, transaction)
}
```

**Key Features**:
- **30-day backdate policy**: No approval needed for transactions within 30 days
- **Balance validation**: Prevents overdrafts by checking historical balance
- **Automatic recalculation**: Updates all affected periods on backdated transactions

**2. monthlySnapshotService.js** (★★★★☆)
Month-end snapshot generation.

```javascript
class MonthlySnapshotService {
    async generateMonthlySnapshots(accountId, year, month) {
        // For each ledger head:
        // 1. Calculate opening balance (previous month's closing)
        // 2. Sum transactions in current month
        // 3. Calculate closing balance
        // 4. Save to monthly_balance_summaries
    }
}
```

**3. realTimeBalanceService.js** (★★★★☆)
Live balance calculations without snapshots.

```javascript
class RealTimeBalanceService {
    async getLiveBalanceSummary(accountId) {
        // Calculate balances from transaction logs directly
        // Used for current month reporting
    }
    
    async handleBackdatedTransaction(transaction) {
        // Recalculate all affected months when backdated transaction added
    }
}
```

**4. hashChainService.js** (★★★☆☆)
Cryptographic integrity verification.

```javascript
class HashChainService {
    generateTransactionHash(data, previousHash) {
        // Creates SHA-256 hash linking to previous transaction
    }
    
    async verifyHashChain(accountId, startDate, endDate) {
        // Verifies integrity of transaction chain
        // Returns: { isValid, errors, transactionCount }
    }
}
```

**5. balanceCalculationService.js** (★★★☆☆)
Utility functions for balance calculations.

```javascript
class BalanceCalculationService {
    calculateAmountSplit(cashType, amount, cashAmount, bankAmount) {
        // Splits amount into cash/bank based on payment type
        // Validates totals match
    }
    
    async updateLedgerHeadBalance(ledgerId, amount, cash, bank, side, date, transaction) {
        // Updates ledger balance with proper cash/bank tracking
    }
}
```

### Routes (`/backend/src/routes/`)

API endpoint definitions.

**Main Routes:**
```javascript
// Authentication
POST   /api/auth/login
POST   /api/auth/register
GET    /api/auth/me
POST   /api/auth/reset-password

// Transactions (Immutable System)
POST   /api/transactions/credit
POST   /api/transactions/debit
GET    /api/transactions/history
GET    /api/transactions/balance
GET    /api/transactions/balance/live
POST   /api/transactions/validate-date
PUT    /api/transactions/:id          // BLOCKED - Returns 403
DELETE /api/transactions/:id          // BLOCKED - Returns 403

// Monthly Reports
GET    /api/transactions/monthly-report/:year/:month/:accountId
GET    /api/transactions/available-months/:accountId

// Accounts
GET    /api/accounts
POST   /api/accounts
GET    /api/accounts/:id
GET    /api/accounts/:id/balance-summary

// Ledger Heads
GET    /api/ledger-heads
POST   /api/ledger-heads
PUT    /api/ledger-heads/:id

// Donors, Booklets, Cheques
GET    /api/donors
GET    /api/booklets
GET    /api/cheques

// Admin (requires admin role)
GET    /api/admin/users
POST   /api/admin/users
```

### Middleware (`/backend/src/middleware/`)

**1. authMiddleware.js**
```javascript
// protect: Verify JWT token
exports.protect = async (req, res, next) => {
    // Check Authorization header or cookies
    // Verify JWT
    // Attach user to req.user
}

// authorize: Check user role/permissions
exports.authorize = (rolesOrPermissions) => (req, res, next) => {
    // Check if user has required role or permission
}
```

Usage:
```javascript
router.get('/api/admin/users', protect, authorize('admin'), getAllUsers);
```

---

## Frontend Components

### Pages (`/frontend/pages/`)

Next.js uses file-based routing.

#### Key Pages

**1. monthly-reports.js** (★★★★★)
Main reporting interface.

```javascript
export default function MonthlyReports() {
    const [selectedYear, setSelectedYear] = useState(2025);
    const [selectedMonth, setSelectedMonth] = useState(10);
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    
    // Fetch report data
    const fetchReport = async () => {
        const response = await axios.get(
            `/api/transactions/monthly-report/${selectedYear}/${selectedMonth}/1?all_accounts=true`
        );
        setReportData(response.data.data);
    };
    
    // Render balance sheet table
    return (
        <div>
            {/* Month/Year selector */}
            {/* Summary cards */}
            {/* Balance sheet table */}
            {/* Export buttons */}
        </div>
    );
}
```

**Table Structure**:
```javascript
// Data comes from account_groups
reportData.account_groups.map(group => (
    <AccountGroup account={group}>
        {group.credit_heads.map(creditHead => (
            <Row>
                <td>{creditHead.name}</td>
                <td>{creditHead.opening_balance}</td>
                <td>{creditHead.credits_this_month}</td>
                <td>{creditHead.debits_this_month}</td>
                <td>{creditHead.closing_balance}</td>  {/* KEY FIELD */}
            </Row>
        ))}
    </AccountGroup>
))
```

**2. dashboard.js** (★★★★☆)
Main dashboard with statistics.

**3. transactions.js** (★★★★☆)
Transaction management interface.

**4. manage-ledger.js** (★★★☆☆)
Ledger head configuration.

**5. auth/login.js** (★★★★☆)
Login page.

```javascript
export default function Login() {
    const { login } = useAuth();
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        await login(email, password);
        router.push('/dashboard');
    };
}
```

### Components (`/frontend/components/`)

**1. Layout.js** (★★★★☆)
Main application layout with sidebar.

**2. Sidebar.js** (★★★★☆)
Navigation sidebar with role-based menu items.

```javascript
const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: FaHome },
    { name: 'Transactions', path: '/transactions', icon: FaExchangeAlt },
    { name: 'Reports', path: '/monthly-reports', icon: FaChartBar },
    { name: 'Accounts', path: '/accounts', icon: FaWallet, adminOnly: true },
    // ... more items
];
```

**3. AccountCard.js** (★★★☆☆)
Display card for account summary.

**4. LoadingSpinner.js** (★★★☆☆)
Loading indicator.

### Contexts (`/frontend/contexts/`)

**AuthContext.js** (★★★★★)
Global authentication state management.

```javascript
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Load user from localStorage
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');
        if (storedUser && storedToken) {
            setUser(JSON.parse(storedUser));
            axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
        setLoading(false);
    }, []);
    
    const login = async (email, password) => {
        const response = await axios.post('/api/auth/login', { email, password });
        const { data } = response.data;
        localStorage.setItem('user', JSON.stringify(data));
        localStorage.setItem('token', data.token);
        setUser(data);
    };
    
    const logout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        router.push('/auth/login');
    };
    
    return (
        <AuthContext.Provider value={{ user, loading, login, logout, hasRole, hasPagePermission }}>
            {children}
        </AuthContext.Provider>
    );
};
```

### Hooks (`/frontend/hooks/`)

**useAuth.js** (★★★★★)
Custom hook to access auth context.

```javascript
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
```

### Layouts (`/frontend/layouts/`)

**1. MainLayout.js** (★★★★☆)
Main page layout with sidebar and header.

**2. AuthLayout.js** (★★★☆☆)
Simple layout for auth pages.

---

## Business Logic

### Balance Calculation Logic

#### Current Month (Real-time)
```javascript
// For Credit Heads (Income categories)
const openingBalance = await calculateAllTransactionsBefore(monthStart);
const creditsThisMonth = await sumCreditsInDateRange(monthStart, monthEnd);
const sourceDebits = await sumSourceDebitsInDateRange(monthStart, monthEnd); // CRITICAL
const closingBalance = openingBalance + creditsThisMonth - sourceDebits;
```

**Key SQL Query**:
```sql
-- Credits in current month
SELECT SUM(amount) 
FROM transaction_log
WHERE ledger_head_id = ? 
  AND tx_type = 'credit'
  AND transaction_date BETWEEN ? AND ?;

-- Source debits (money taken FROM this ledger) - CRITICAL
SELECT SUM(amount)
FROM transaction_log
WHERE source_ledger_head_id = ?  -- This ledger is the source
  AND tx_type = 'debit'
  AND transaction_date BETWEEN ? AND ?;  -- Only current month!
```

#### Historical Months (Snapshot-based)
```javascript
// Fetch from monthly_balance_summaries
const snapshot = await MonthlyBalanceSummary.findOne({
    where: {
        ledger_head_id,
        account_id,
        month_year: `${year}-${month}-01`
    }
});

return {
    opening_balance: snapshot.opening_balance,
    closing_balance: snapshot.closing_balance,
    total_credits: snapshot.total_credits,
    total_debits: snapshot.total_debits
};
```

### Transaction Flow

#### Credit Transaction (Income)
```
1. User submits donation form
   ↓
2. Frontend validates and sends to API
   ↓
3. immutableTransactionService.createCreditTransaction()
   ↓
4. Validate data (amount, date, ledger head)
   ↓
5. Check date restrictions (30-day policy)
   ↓
6. Create TransactionLog entry
   ↓
7. Update ledger_heads.current_balance += amount
   ↓
8. Update ledger_heads.cash_balance and bank_balance
   ↓
9. Mark receipt number as used (if booklet specified)
   ↓
10. Create audit trail
   ↓
11. Trigger background balance recalculation (if backdated)
   ↓
12. Return success response
```

#### Debit Transaction (Expense)
```
1. User submits expense form
   ↓
2. Frontend validates and sends to API
   ↓
3. immutableTransactionService.createDebitTransaction()
   ↓
4. Validate data (amount, date, source & destination ledgers)
   ↓
5. Check source ledger has sufficient balance
   ↓
6. Check date restrictions (30-day policy)
   ↓
7. Create TransactionLog entry with source_ledger_head_id
   ↓
8. Update SOURCE ledger: current_balance -= amount
   ↓
9. Update DESTINATION ledger: current_balance += amount
   ↓
10. Update cash/bank balances based on payment method
   ↓
11. Create audit trail
   ↓
12. Trigger background balance recalculation (if backdated)
   ↓
13. Return success response
```

### Date Validation Policy

**Simplified 30-Day No-Approval System**:
```javascript
const validateTransactionDate = (date) => {
    const daysDiff = Math.ceil((today - date) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 0) {
        throw new Error('Future dates not allowed');
    }
    
    if (daysDiff <= 30) {
        return { allowed: true, approvalLevel: 0, reason: 'Within 30-day limit' };
    }
    
    throw new Error('Cannot enter transaction older than 30 days. Use correction workflow.');
};
```

**Rationale**:
- Prevents data entry errors
- Maintains data integrity
- Allows reasonable backdating for legitimate delays
- Forces formal correction process for old data

---

## Authentication & Authorization

### JWT Authentication Flow

```
1. User enters credentials
   ↓
2. POST /api/auth/login
   ↓
3. authController.login()
   ↓
4. Find user in database
   ↓
5. Verify password with bcrypt.compare()
   ↓
6. Generate JWT token with user id and role
   ↓
7. Return token + user data
   ↓
8. Frontend stores in localStorage
   ↓
9. Frontend includes in Authorization header for all requests
   ↓
10. Backend verifies token in protect middleware
```

### Role-Based Access Control

**Roles:**
- **admin**: Full system access
- **user**: Limited access based on permissions

**Middleware Usage:**
```javascript
// Require authentication
router.get('/api/accounts', protect, getAccounts);

// Require admin role
router.post('/api/admin/users', protect, authorize('admin'), createUser);

// Require specific permission
router.get('/api/reports', protect, authorize(['reports']), getReports);
```

**Frontend Route Protection:**
```javascript
const ProtectedPage = () => {
    const { user, hasPagePermission } = useAuth();
    
    if (!user) {
        router.push('/auth/login');
        return null;
    }
    
    if (!hasPagePermission('accounts')) {
        router.push('/unauthorized');
        return null;
    }
    
    return <AccountManagement />;
};
```

---

## Key Features

### 1. Immutable Transaction System

**Why Immutable?**
- **Audit Compliance**: Financial records must never be altered
- **Fraud Prevention**: Cannot hide overdrafts or missing funds
- **Legal Requirements**: Many jurisdictions require immutable financial records
- **Data Integrity**: Hash chain detects tampering

**How It Works:**
```javascript
// Sequelize hooks prevent modifications
Transaction.beforeUpdate(() => {
    throw new Error('FORBIDDEN: Transaction records are immutable');
});

Transaction.beforeDestroy(() => {
    throw new Error('FORBIDDEN: Transaction records cannot be deleted');
});
```

**Correction Workflow:**
Instead of editing, create correction entries:
```javascript
{
    transaction_uuid: "original-uuid",
    log_sequence: 2,  // New entry in sequence
    action_type: "CORRECT_AMOUNT",
    reference_log_id: 123,  // References original
    correction_reason: "Data entry error"
}
```

### 2. Cryptographic Hash Chain

**Purpose**: Detect unauthorized modifications

**Implementation:**
```javascript
const generateTransactionHash = (transaction, previousHash) => {
    const data = `${transaction.uuid}|${transaction.amount}|${transaction.date}|${previousHash}`;
    return crypto.createHash('sha256').update(data).digest('hex');
};

// Each transaction links to previous
transaction.current_hash = generateTransactionHash(transaction, previousHash);
transaction.previous_hash = previousHash;
```

**Verification:**
```javascript
const verifyHashChain = async (accountId) => {
    const transactions = await TransactionLog.findAll({
        where: { account_id: accountId },
        order: [['log_id', 'ASC']]
    });
    
    for (let i = 1; i < transactions.length; i++) {
        const expected = generateTransactionHash(
            transactions[i],
            transactions[i-1].current_hash
        );
        
        if (expected !== transactions[i].current_hash) {
            return { isValid: false, errorAt: i };
        }
    }
    
    return { isValid: true };
};
```

### 3. Period-Based Accounting

**Monthly Snapshots:**
- Generated at month-end
- Frozen/finalized after verification
- Used for historical reporting (faster than recalculating)

**Real-time Calculations:**
- Used for current month
- Always accurate
- Recalculated on demand

**Automatic Continuity:**
- Opening balance = Previous month's closing balance
- Ensures balance continuity across periods

### 4. Cash/Bank Tracking

Every transaction tracks both:
- **Total amount**: Overall transaction value
- **Cash amount**: Physical cash component
- **Bank amount**: Electronic/bank component

**Payment Types:**
- `cash`: 100% cash
- `bank`, `upi`, `card`, `netbank`, `cheque`: 100% bank
- `multiple`/`both`: Mixed cash + bank (user specifies split)

**Example:**
```javascript
{
    amount: 1000,
    cash_type: 'multiple',
    cash_amount: 400,   // 40% cash
    bank_amount: 600    // 60% bank
}
```

### 5. Automatic Balance Recalculation

**Trigger**: Backdated transaction added

**Process:**
```
1. Identify affected months (transaction date → current month)
2. For each affected ledger head:
   a. Recalculate opening balance
   b. Sum transactions in month
   c. Calculate closing balance
   d. Update monthly_balance_summaries
3. Cascade changes to subsequent months
4. Update current ledger_heads.current_balance
```

**Background Processing:**
```javascript
// Use setImmediate to avoid blocking response
setImmediate(async () => {
    try {
        await balanceRecalculationService.recalculate(affectedLedgers);
    } catch (error) {
        console.error('Background recalculation failed:', error);
        // Log error but don't fail transaction
    }
});
```

### 6. Donor Management

**Features:**
- Track donor information
- Link donations to donors
- Generate donor-specific reports
- Receipt management

**Booklet System:**
- Pre-printed receipt booklets
- Track available receipt numbers
- Automatic receipt assignment
- Prevent duplicate receipts

### 7. Cheque Management

**Features:**
- Track cheque details (number, bank, dates)
- Cheque status workflow (pending, cleared, bounced)
- Link cheques to transactions
- Balance holds for pending cheques

**Workflow:**
```
Pending → [Cleared | Bounced]
```

---

## Development Guide

### Setup Instructions

#### Backend Setup
```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
PORT=3002
DB_USER=postgres
DB_PASSWORD=AskerY786.@
DB_NAME=iafa_software
DB_HOST=127.0.0.1
DB_PORT=5432
JWT_SECRET=your-secret-key-here
NODE_ENV=development
EOF

# Run migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed

# Start development server
npm run dev
```

**Backend runs on**: http://localhost:3002

#### Frontend Setup
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Create .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:3002
EOF

# Start development server
npm run dev
```

**Frontend runs on**: http://localhost:3000

### Database Operations

**Create Migration:**
```bash
npm run migration:generate -- --name add-new-field
```

**Run Migrations:**
```bash
npm run db:migrate
```

**Rollback Migration:**
```bash
npm run db:migrate:undo
```

**Create Seeder:**
```bash
npm run seed:generate -- --name demo-data
```

**Run Seeders:**
```bash
npm run db:seed
```

### Testing

**Backend Testing:**
```bash
# Run test scripts
node src/test-october-report-fix.js
node src/debug-balance-calculation.js
node src/comprehensive-backdate-test.js
```

**Manual Testing:**
```bash
# Test API endpoints
curl http://localhost:3002/api/accounts
curl -H "Authorization: Bearer <token>" http://localhost:3002/api/transactions
```

### Debugging

**Common Debug Scripts:**
```bash
# Test monthly report calculations
node src/test-monthly-report-final.js

# Verify balance calculations
node src/check-current-ledger-balances.js

# Test backdated transactions
node src/comprehensive-backdate-test.js

# Debug API responses
node src/debug-frontend-api-call.js
```

**Enable Debug Logging:**
```javascript
// In any service or controller
console.log('🔄 Processing...', data);
console.log('✅ Success:', result);
console.log('❌ Error:', error);
console.log('⚠️ Warning:', warning);
```

---

## Known Issues & Solutions

### 1. Balance Calculation Bug (FIXED)

**Issue**: Monthly report showed incorrect closing balance (₹235 instead of ₹310)

**Root Cause**:
```javascript
// WRONG: Counted ALL historical source debits
const sourceDebits = await TransactionLog.sum('amount', {
    where: { source_ledger_head_id: ledgerHeadId }
});

// CORRECT: Only count source debits in current month
const sourceDebits = await TransactionLog.sum('amount', {
    where: {
        source_ledger_head_id: ledgerHeadId,
        transaction_date: { [Op.between]: [monthStart, monthEnd] }
    }
});
```

**Solution**: Added date filter to source debits calculation in `simpleMonthlyReportController.js`

### 2. Frontend/Backend Port Mismatch

**Issue**: Network errors, CORS issues

**Root Cause**: Frontend configured to call port 4000, backend running on 3002

**Solution**:
```javascript
// frontend/contexts/AuthContext.js
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
```

### 3. Transaction Immutability Confusion

**Issue**: Users trying to edit transactions directly

**Solution**: 
- Block UPDATE/DELETE routes with 403 error
- Direct users to correction workflow
- Add helpful error messages

```javascript
router.put('/:id', protect, blockedUpdateTransaction);
router.delete('/:id', protect, blockedDeleteTransaction);
```

### 4. Balance Validation for Backdated Transactions

**Issue**: Could create impossible negative balances with backdated debits

**Solution**: Check balance on transaction date, not current date
```javascript
const balanceOnTransactionDate = await calculateCurrentBalance(
    accountId,
    ledgerHeadId,
    transactionDate  // Use historical date
);

if (balanceOnTransactionDate < amount) {
    throw new Error('Insufficient balance on that date');
}
```

### 5. Decimal Precision Issues

**Issue**: JavaScript number precision errors (0.1 + 0.2 = 0.30000000000000004)

**Solution**: Use PostgreSQL DECIMAL type and round to 2 decimal places
```javascript
const roundToTwo = (num) => Math.round(num * 100) / 100;
```

---

## API Documentation

### Authentication Endpoints

#### POST /api/auth/login
Login to the system.

**Request:**
```json
{
    "email": "admin@iafa.com",
    "password": "admin123"
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "id": 1,
        "name": "Admin User",
        "email": "admin@iafa.com",
        "role": "admin",
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
}
```

#### GET /api/auth/me
Get current user info (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
    "success": true,
    "data": {
        "id": 1,
        "name": "Admin User",
        "email": "admin@iafa.com",
        "role": "admin"
    }
}
```

### Transaction Endpoints

#### POST /api/transactions/credit
Create a credit (income) transaction.

**Request:**
```json
{
    "account_id": 1,
    "ledger_head_id": 5,
    "amount": 450,
    "cash_type": "multiple",
    "cash_amount": 150,
    "bank_amount": 300,
    "transaction_date": "2025-10-02",
    "description": "Donation from donor",
    "booklet_id": 1,
    "receipt_number": 101,
    "donor_id": 3
}
```

**Response:**
```json
{
    "success": true,
    "message": "Transaction created successfully",
    "data": {
        "uuid": "550e8400-e29b-41d4-a716-446655440000",
        "log_id": 1234,
        "amount": 450,
        "hash": "a3f5b2c1d4e6f7..."
    },
    "warning": "This transaction is now PERMANENTLY recorded and cannot be modified."
}
```

#### POST /api/transactions/debit
Create a debit (expense) transaction.

**Request:**
```json
{
    "account_id": 1,
    "ledger_head_id": 10,
    "source_ledger_head_id": 5,
    "amount": 140,
    "cash_type": "cash",
    "transaction_date": "2025-10-02",
    "description": "Office supplies purchase"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Debit transaction created successfully",
    "data": {
        "uuid": "660e8400-e29b-41d4-a716-446655440001",
        "log_id": 1235,
        "amount": 140,
        "hash": "b4g6c3d5e7f8..."
    }
}
```

#### GET /api/transactions/balance/live
Get live balance summary for an account.

**Query Parameters:**
- `account_id` (required): Account ID

**Response:**
```json
{
    "success": true,
    "data": {
        "account_id": 1,
        "as_of_date": "2025-10-02",
        "ledger_heads": [
            {
                "ledger_head_id": 5,
                "ledger_head_name": "General Donations",
                "head_type": "credit",
                "balance": 310.00,
                "cash_balance": 120.00,
                "bank_balance": 190.00
            }
        ],
        "credit_total": 310.00,
        "debit_total": 140.00,
        "net_balance": 170.00
    }
}
```

#### POST /api/transactions/validate-date
Validate transaction date against backdate policy.

**Request:**
```json
{
    "transaction_date": "2025-09-15"
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "allowed": true,
        "approvalLevel": 0,
        "reason": "Transaction allowed - within 30-day limit",
        "warning": "This transaction is 17 days old. Please verify the date is accurate.",
        "daysDifference": 17,
        "status": "allowed"
    }
}
```

### Monthly Report Endpoints

#### GET /api/transactions/monthly-report/:year/:month/:accountId
Generate monthly financial report.

**URL Parameters:**
- `year`: Report year (e.g., 2025)
- `month`: Report month (1-12)
- `accountId`: Account ID or 'all'

**Query Parameters:**
- `all_accounts` (optional): true/false

**Response:**
```json
{
    "success": true,
    "data": {
        "month": 10,
        "year": 2025,
        "monthName": "October 2025",
        "isCurrentMonth": true,
        "isHistoricalData": false,
        "account_groups": [
            {
                "account_id": 1,
                "account_name": "Main Account",
                "credit_heads": [
                    {
                        "ledger_head_id": 5,
                        "name": "General Donations",
                        "opening_balance": 0,
                        "credits_this_month": 450,
                        "debits_this_month": 140,
                        "closing_balance": 310,
                        "cash_balance": 120,
                        "bank_balance": 190
                    }
                ],
                "debit_heads": [
                    {
                        "ledger_head_id": 10,
                        "name": "Office Supplies",
                        "opening_balance": 0,
                        "debits_this_month": 140,
                        "closing_balance": 140
                    }
                ]
            }
        ],
        "totals": {
            "total_opening_balance": 0,
            "total_credits": 450,
            "total_debits": 140,
            "closing_balance": 310
        }
    }
}
```

#### GET /api/transactions/available-months/:accountId
Get list of months with transaction data.

**Response:**
```json
{
    "success": true,
    "data": {
        "available_months": [
            { "year": 2025, "month": 10, "month_name": "October" },
            { "year": 2025, "month": 9, "month_name": "September" }
        ]
    }
}
```

### Account Endpoints

#### GET /api/accounts
List all accounts.

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "name": "Main Account",
            "opening_balance": 0,
            "closing_balance": 310,
            "cash_balance": 120,
            "bank_balance": 190
        }
    ]
}
```

#### GET /api/accounts/:id/balance-summary
Get detailed balance summary for an account.

**Response:**
```json
{
    "success": true,
    "data": {
        "account": { "id": 1, "name": "Main Account" },
        "ledger_heads": [...],
        "summary": {
            "total_credit_balance": 310,
            "total_debit_balance": 140,
            "net_balance": 170
        }
    }
}
```

### Ledger Head Endpoints

#### GET /api/ledger-heads
List all ledger heads.

**Query Parameters:**
- `account_id` (optional): Filter by account
- `head_type` (optional): Filter by type (credit/debit)

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 5,
            "name": "General Donations",
            "head_type": "credit",
            "current_balance": 310,
            "cash_balance": 120,
            "bank_balance": 190,
            "is_active": true
        }
    ]
}
```

---

## Configuration Files

### Backend Configuration

**config/config.json** (Database)
```json
{
  "development": {
    "username": "postgres",
    "password": "AskerY786.@",
    "database": "iafa_software",
    "host": "127.0.0.1",
    "dialect": "postgres"
  }
}
```

**.env**
```
PORT=3002
DB_USER=postgres
DB_PASSWORD=AskerY786.@
DB_NAME=iafa_software
DB_HOST=127.0.0.1
DB_PORT=5432
JWT_SECRET=your-secret-key-here
NODE_ENV=development
```

### Frontend Configuration

**.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:3002
```

**next.config.js**
```javascript
module.exports = {
  reactStrictMode: true,
  swcMinify: true,
}
```

**tailwind.config.js**
```javascript
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All migrations run successfully
- [ ] Database backed up
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Build process tested

### Backend Deployment
- [ ] Set `NODE_ENV=production`
- [ ] Update database credentials
- [ ] Configure production JWT secret
- [ ] Set up process manager (PM2)
- [ ] Configure nginx reverse proxy
- [ ] Enable HTTPS
- [ ] Set up logging
- [ ] Configure CORS for production domain

### Frontend Deployment
- [ ] Update `NEXT_PUBLIC_API_URL` to production backend
- [ ] Run `npm run build`
- [ ] Test production build locally
- [ ] Deploy to hosting (Vercel, etc.)
- [ ] Configure custom domain
- [ ] Enable CDN
- [ ] Set up monitoring

### Post-Deployment
- [ ] Verify all API endpoints working
- [ ] Test authentication flow
- [ ] Test transaction creation
- [ ] Verify monthly reports
- [ ] Monitor error logs
- [ ] Set up automated backups
- [ ] Configure monitoring/alerts

---

## Security Considerations

### Authentication
- ✅ Passwords hashed with bcrypt (salt rounds: 10)
- ✅ JWT tokens with expiration
- ✅ Token stored securely (httpOnly cookies preferred)
- ⚠️ Implement token refresh mechanism
- ⚠️ Add rate limiting on login endpoint

### Authorization
- ✅ Role-based access control
- ✅ Middleware protection on all routes
- ✅ Permission-based UI rendering
- ⚠️ Add audit logging for admin actions

### Data Integrity
- ✅ Immutable transaction logs
- ✅ Cryptographic hash chain
- ✅ Database constraints (foreign keys, checks)
- ⚠️ Implement automated integrity checks

### Input Validation
- ✅ Sequelize model validation
- ✅ Controller-level validation
- ⚠️ Add request sanitization
- ⚠️ Implement SQL injection prevention

### Network Security
- ⚠️ Enable HTTPS in production
- ⚠️ Configure CORS properly
- ⚠️ Add request rate limiting
- ⚠️ Implement CSRF protection

---

## Performance Optimization

### Database
- ✅ Indexes on frequently queried columns
- ⚠️ Add composite indexes for date range queries
- ⚠️ Implement query result caching
- ⚠️ Use database connection pooling

### Backend
- ⚠️ Implement Redis caching for frequent queries
- ⚠️ Add response compression
- ⚠️ Optimize N+1 queries with eager loading
- ⚠️ Add pagination to all list endpoints

### Frontend
- ✅ Next.js static generation where possible
- ⚠️ Implement code splitting
- ⚠️ Add lazy loading for components
- ⚠️ Optimize bundle size
- ⚠️ Add service worker for offline support

---

## Troubleshooting Guide

### Common Issues

#### "Cannot connect to database"
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify credentials
psql -U postgres -d iafa_software

# Check config/config.json matches actual database
```

#### "Token expired" or "Authentication failed"
```javascript
// Clear localStorage and login again
localStorage.clear();
// Or check JWT_SECRET matches between login and verification
```

#### "Balance calculations incorrect"
```bash
# Run debug script
node src/debug-balance-calculation.js

# Verify source_ledger_head_id is set correctly
# Check date filters in queries
```

#### "Transaction creation fails"
```javascript
// Check all required fields present
// Verify ledger head exists and matches type
// Check date is not in future
// Verify sufficient balance for debits
```

#### "Frontend can't reach backend"
```javascript
// Verify NEXT_PUBLIC_API_URL is correct
console.log(process.env.NEXT_PUBLIC_API_URL);

// Check CORS configuration
// Verify backend is running on correct port
```

---

## Future Enhancements

### Planned Features
- [ ] Multi-currency support
- [ ] Budget tracking and alerts
- [ ] Recurring transactions
- [ ] Advanced reporting (custom date ranges, filters)
- [ ] Export to Excel/PDF
- [ ] Email notifications
- [ ] Two-factor authentication
- [ ] Mobile app (React Native)
- [ ] API webhooks for integrations
- [ ] Automated reconciliation

### Technical Improvements
- [ ] GraphQL API
- [ ] Real-time updates (WebSockets)
- [ ] Microservices architecture
- [ ] Event sourcing pattern
- [ ] Machine learning for fraud detection
- [ ] Blockchain integration for enhanced integrity
- [ ] Elasticsearch for advanced search
- [ ] Redis caching layer

---

## Glossary

**Account**: An organizational unit (e.g., department, project, branch)

**Ledger Head**: A category in the chart of accounts (income or expense category)

**Credit Head**: Income category (receives money)

**Debit Head**: Expense category (spends money)

**Transaction Log**: Immutable record of a financial transaction

**Source Ledger**: In a debit transaction, the ledger head providing the funds

**Snapshot**: Month-end frozen balance summary

**Hash Chain**: Cryptographic linking of transactions to detect tampering

**Immutable**: Cannot be changed or deleted

**Backdate**: Enter a transaction with a date in the past

---

## Support & Contact

For questions or issues:
- Review this documentation
- Check debug scripts in `/backend/src/`
- Review test scripts for examples
- Check console logs for detailed error messages

---

*Last Updated: 2025-10-02*
*Document Version: 1.0*
*Codebase Version: Latest (as of 2025-10-02)*
