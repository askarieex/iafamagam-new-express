# IAFA Software - Comprehensive Codebase Analysis

## Executive Summary

**IAFA (Islamic Accounting Financial Application)** is a sophisticated financial management system built for Islamic accounting principles with an immutable transaction logging system, real-time balance calculations, and comprehensive monthly reporting capabilities.

**Last Updated:** 2025-10-02  
**Analysis Version:** 1.0

---

## 🏗️ Architecture Overview

### Technology Stack

#### Backend
- **Framework:** Node.js + Express.js
- **Database:** PostgreSQL with JSONB support
- **ORM:** Sequelize v6.37.7
- **Authentication:** JWT (jsonwebtoken) + bcryptjs
- **Security:** Cookie-parser, CORS enabled
- **Automation:** node-cron for scheduled tasks
- **Port:** 3002 (configurable via .env)

#### Frontend
- **Framework:** Next.js 14.0.4
- **UI Library:** React 18.2.0
- **Styling:** TailwindCSS 3.4.17
- **Icons:** React Icons 4.11.0
- **Charts:** Chart.js 4.4.9 + react-chartjs-2
- **Notifications:** React Hot Toast + React Toastify
- **HTTP Client:** Axios 1.5.0
- **Port:** 3000 (Next.js default)

### Project Structure

```
iafasoftware/
├── backend/                      # Express.js API Server (Port 3002)
│   ├── src/
│   │   ├── models/              # Sequelize Models (13 files)
│   │   ├── controllers/         # Business Logic Handlers (16 files)
│   │   ├── services/            # Core Business Logic (10 files)
│   │   ├── routes/              # API Route Definitions (14 files)
│   │   ├── middleware/          # Auth & Authorization (2 files)
│   │   ├── migrations/          # Database Migrations (21 files)
│   │   ├── seeders/             # Database Seeders
│   │   ├── config/              # Database & App Config
│   │   ├── utils/               # Helper Utilities
│   │   ├── scripts/             # Utility Scripts
│   │   └── server.js            # Application Entry Point
│   └── package.json
│
├── frontend/                     # Next.js Application (Port 3000)
│   ├── pages/                   # Next.js Pages (Routes)
│   │   ├── auth/               # Authentication Pages
│   │   ├── admin/              # Admin Dashboard
│   │   └── api/                # API Routes (Proxy)
│   ├── components/              # Reusable React Components
│   │   ├── transactions/       # Transaction Forms & Lists
│   │   ├── auth/              # Auth Components
│   │   ├── ledger/            # Ledger Components
│   │   └── cheques/           # Cheque Management
│   ├── contexts/               # React Context (Auth)
│   ├── hooks/                  # Custom React Hooks
│   ├── layouts/                # Page Layouts
│   ├── styles/                 # Global CSS
│   ├── config/                 # API Configuration
│   └── package.json
│
└── Documentation/               # Extensive Documentation (28+ files)
```

---

## 📊 Database Architecture

### Core Models

#### 1. **TransactionLog** (Immutable Audit Trail)
**File:** `backend/src/models/transactionLog.js`

**Purpose:** Immutable, append-only transaction log with blockchain-like integrity

**Key Features:**
- ✅ Immutable (enforced by hooks - no updates/deletes allowed)
- ✅ Cryptographic hash chain for integrity
- ✅ Complete audit trail
- ✅ Approval workflow support
- ✅ Correction tracking

**Important Fields:**
```javascript
{
  log_id: BIGINT (Primary Key),
  transaction_uuid: UUID (Unique),
  action_type: ENUM('CREATE', 'CORRECT_AMOUNT', 'CORRECT_DATE', 'REVERSE', 'VOID'),
  account_id: INTEGER (FK -> accounts),
  ledger_head_id: INTEGER (FK -> ledger_heads),
  source_ledger_head_id: INTEGER (FK -> ledger_heads), // CRITICAL for balance calculations
  amount: DECIMAL(15, 2),
  cash_amount: DECIMAL(15, 2),
  bank_amount: DECIMAL(15, 2),
  tx_type: ENUM('credit', 'debit'),
  cash_type: STRING,
  transaction_date: DATEONLY,
  transaction_time: TIME,
  description: TEXT,
  current_hash: STRING(64),    // Blockchain-like integrity
  previous_hash: STRING(64),   // Links to previous transaction
  requires_approval: BOOLEAN,
  approval_level: INTEGER (0-3),
  approved_by: INTEGER (FK -> users),
  created_by: INTEGER (FK -> users),
  client_ip: INET,
  booklet_id: INTEGER (FK -> booklets),
  donor_id: INTEGER (FK -> donors),
  receipt_number: INTEGER
}
```

**Immutability Enforcement:**
```javascript
hooks: {
  beforeUpdate: () => {
    throw new Error('TransactionLog records are immutable and cannot be updated');
  },
  beforeDestroy: () => {
    throw new Error('TransactionLog records are immutable and cannot be deleted');
  }
}
```

#### 2. **LedgerHead** (Chart of Accounts)
**File:** `backend/src/models/ledgerHead.js`

**Purpose:** Defines income/expense categories with Islamic accounting principles

**Key Fields:**
```javascript
{
  id: INTEGER (Primary Key),
  account_id: INTEGER (FK -> accounts),
  name: STRING,
  head_type: ENUM('debit', 'credit'),      // Income vs Expense
  dependency_type: ENUM('independent', 'dependent', 'expense'),
  current_balance: DECIMAL(15, 2),         // Current total balance
  cash_balance: DECIMAL(15, 2),            // Cash portion
  bank_balance: DECIMAL(15, 2),            // Bank portion
  is_restricted: BOOLEAN,                   // Islamic restriction
  islamic_category: STRING(100),            // Zakat, Sadaqah, etc.
  spending_rules: TEXT,                     // Sharia compliance rules
  is_active: BOOLEAN,
  sort_order: INTEGER
}
```

**Head Types:**
- **Credit Heads (Income):** Donations, Zakat, Sadaqah, Grants
- **Debit Heads (Expenses):** Salaries, Rent, Utilities, etc.

#### 3. **MonthlyBalanceSummary** (Historical Snapshots)
**File:** `backend/src/models/monthlyBalanceSummary.js`

**Purpose:** Monthly snapshots for efficient historical reporting

**Key Fields:**
```javascript
{
  id: INTEGER (Primary Key),
  ledger_head_id: INTEGER (FK),
  account_id: INTEGER (FK),
  month_year: DATEONLY,           // First day of month (e.g., 2024-04-01)
  opening_balance: DECIMAL(15, 2),
  closing_balance: DECIMAL(15, 2),
  total_credits: DECIMAL(15, 2),
  total_debits: DECIMAL(15, 2),
  cash_amount: DECIMAL(15, 2),
  bank_amount: DECIMAL(15, 2),
  transaction_count: INTEGER,
  is_finalized: BOOLEAN,
  last_calculated_at: DATE
}
```

**Unique Constraint:**
```javascript
indexes: [
  {
    unique: true,
    fields: ['ledger_head_id', 'account_id', 'month_year']
  }
]
```

#### 4. **Account** (Organizational Units)
**File:** `backend/src/models/account.js`

**Purpose:** Separate financial entities (departments, branches)

**Key Fields:**
```javascript
{
  id: INTEGER (Primary Key),
  name: STRING (Unique),
  opening_balance: DECIMAL(15, 2),
  closing_balance: DECIMAL(15, 2),
  cash_balance: DECIMAL(15, 2),
  bank_balance: DECIMAL(15, 2),
  last_closed_date: DATEONLY
}
```

#### 5. **User** (Authentication & Authorization)
**File:** `backend/src/models/user.js`

**Purpose:** System users with role-based access control

**Key Fields:**
```javascript
{
  id: INTEGER (Primary Key),
  name: STRING,
  email: STRING (Unique),
  password: STRING (bcrypt hashed),
  role: ENUM('admin', 'user'),
  permissions: JSON {
    dashboard: BOOLEAN,
    transactions: BOOLEAN,
    reports: BOOLEAN,
    accounts: BOOLEAN,
    settings: BOOLEAN
  }
}
```

**Security Features:**
- Passwords hashed with bcryptjs (10 salt rounds)
- JWT token-based authentication
- Role-based authorization
- Granular permission system

#### 6. **Supporting Models**

**Donor** (`models/donor.js`)
- Tracks donation sources
- Contact information
- Donation history

**Booklet** (`models/booklet.js`)
- Receipt booklet management
- Tracks used/unused receipts
- Sequential receipt numbers

**Cheque** (`models/cheque.js`)
- Cheque tracking
- Bank account association
- Status management

**BankAccount** (`models/bankAccount.js`)
- Bank account details
- Balance tracking
- Transaction linkage

---

## 🎯 Core Business Logic

### Transaction Processing Flow

#### Credit Transaction (Income) Flow
**Controller:** `backend/src/controllers/immutableTransactionController.js`  
**Service:** `backend/src/services/immutableTransactionService.js`

```javascript
// Step-by-step process:
1. Validate transaction data (amount, date, ledger head)
2. Check date restrictions (30-day backdate allowed without approval)
3. Calculate hash chain (cryptographic integrity)
4. Create immutable TransactionLog entry
5. Update LedgerHead balance (credit)
6. Update cash/bank split
7. Handle receipt booklet (if specified)
8. Create audit trail
9. Trigger snapshot updates (if backdated)
10. Return transaction confirmation
```

**Example Request:**
```javascript
POST /api/transactions/credit
{
  "account_id": 1,
  "ledger_head_id": 5,
  "amount": 1000.00,
  "cash_amount": 600.00,
  "bank_amount": 400.00,
  "cash_type": "mixed",
  "transaction_date": "2025-10-01",
  "description": "Monthly donation from donor",
  "booklet_id": 2,
  "receipt_number": 1234,
  "donor_id": 10
}
```

#### Debit Transaction (Expense) Flow
**Controller:** `backend/src/controllers/immutableTransactionController.js`  
**Service:** `backend/src/services/immutableTransactionService.js`

```javascript
// Step-by-step process:
1. Validate transaction data
2. Extract source_ledger_head_id (where money comes from)
3. Check sufficient balance in source ledger
4. Validate transaction date
5. Create immutable TransactionLog entry with source tracking
6. Decrease source ledger balance (deduct from credit head)
7. Increase destination expense ledger (record expense in debit head)
8. Update cash/bank split for both ledgers
9. Create audit trail
10. Trigger snapshot updates
```

**Example Request:**
```javascript
POST /api/transactions/debit
{
  "account_id": 1,
  "ledger_head_id": 15,              // Destination (Expense) ledger
  "source_ledger_head_id": 5,        // Source (Income) ledger
  "amount": 500.00,
  "cash_amount": 300.00,
  "bank_amount": 200.00,
  "cash_type": "mixed",
  "transaction_date": "2025-10-01",
  "description": "Monthly salary payment"
}
```

**CRITICAL: Source Ledger Head Tracking**
```javascript
// This field is CRUCIAL for accurate balance calculations
source_ledger_head_id: INTEGER

// Used to track:
// - Which credit head (income source) funded this expense
// - Enables accurate "net remaining balance" calculations
// - Prevents overdrafts from restricted funds
```

### Monthly Reporting System

#### Report Types

**1. Real-Time Report (Current Month)**
- Calculates balances directly from TransactionLog
- No snapshots used
- Shows up-to-the-minute balances
- Automatically updates as transactions are added

**2. Historical Report (Past Months)**
- Uses MonthlyBalanceSummary snapshots
- Pre-calculated balances
- Fast retrieval
- Snapshots auto-generated if missing

#### Balance Calculation Logic

**Controller:** `backend/src/controllers/simpleMonthlyReportController.js`

**For Credit Heads (Income):**
```javascript
// Opening Balance = All credits before month start - All source debits before month start
openingBalance = totalPreviousCredits - totalPreviousDebitsFromSource

// Credits This Month = Sum of credit transactions in current month
creditsThisMonth = SUM(amount WHERE tx_type='credit' AND date IN month)

// Source Debits This Month = Expenses paid FROM this ledger in current month
sourceDebitsThisMonth = SUM(amount WHERE source_ledger_head_id=thisLedger AND date IN month)

// Net Closing Balance = What remains after expenses
closingBalance = openingBalance + creditsThisMonth - sourceDebitsThisMonth
```

**For Debit Heads (Expenses):**
```javascript
// Opening Balance = 0 (expenses start fresh each month)
openingBalance = 0

// Total Debits = All expenses this month
totalDebits = SUM(amount WHERE tx_type='debit' AND date IN month)

// Closing Balance = Total spent this month
closingBalance = totalDebits
```

**Historical Bug Fix (October 2024):**
```javascript
// BUG: Was counting ALL historical source debits
sourceDebits = await db.TransactionLog.sum('amount', {
  where: {
    source_ledger_head_id: ledgerHeadId,
    tx_type: 'debit'
    // ❌ Missing: transaction_date filter
  }
});

// FIX: Only count source debits WITHIN the current month
sourceDebits = await db.TransactionLog.sum('amount', {
  where: {
    source_ledger_head_id: ledgerHeadId,
    tx_type: 'debit',
    transaction_date: {
      [Op.between]: [monthStart, monthEnd]  // ✅ Added date filter
    }
  }
});
```

### Snapshot Management

**Service:** `backend/src/services/monthlySnapshotService.js`

**Auto-Generation:**
```javascript
// Triggered when:
1. Historical report requested for month without snapshots
2. Backdated transaction added (updates all affected months)
3. Manual regeneration requested by admin

// Process:
1. Get all ledger heads for account
2. Calculate opening balance (previous month closing)
3. Sum all transactions in month
4. Calculate closing balance
5. Calculate cash/bank split
6. Save to MonthlyBalanceSummary
```

**Backfill Utility:**
```bash
# Generate snapshots for date range
POST /api/reports/backfill-snapshots/:accountId
{
  "startYear": 2024,
  "startMonth": 1,
  "endYear": 2024,
  "endMonth": 12
}
```

---

## 🔒 Security & Authentication

### Authentication Flow

**Controller:** `backend/src/controllers/authController.js`  
**Middleware:** `backend/src/middleware/authMiddleware.js`

#### Login Process
```javascript
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

// Server Process:
1. Find user by email
2. Validate password (bcrypt.compare)
3. Generate JWT token (24h expiration)
4. Return user data + token

// Response:
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "name": "User Name",
    "role": "user",
    "permissions": {...},
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Authentication Middleware
```javascript
// Protects all API routes except /api/auth/*
exports.protect = async (req, res, next) => {
  // 1. Extract token from Authorization header or cookies
  const token = req.headers.authorization?.split(' ')[1] || req.cookies.token;
  
  // 2. Verify token
  const decoded = jwt.verify(token, JWT_SECRET);
  
  // 3. Find user
  const user = await User.findByPk(decoded.id);
  
  // 4. Attach user to request
  req.user = user;
  next();
};
```

#### Authorization Middleware
```javascript
// Checks role/permission
exports.authorize = (rolesOrPermissions) => {
  return (req, res, next) => {
    // Check if user has required role
    if (allowedValues.includes(req.user.role)) {
      return next();
    }
    
    // Check if user has required permission
    if (req.user.permissions[value] === true) {
      return next();
    }
    
    // Access denied
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  };
};
```

### Security Features

#### 1. **Immutable Transaction Log**
- Transactions cannot be edited or deleted (enforced at model level)
- Complete audit trail
- Cryptographic hash chain

#### 2. **Blocked Dangerous Routes**
```javascript
// ❌ BLOCKED (Security Risk)
router.put('/transactions/:id', blockedUpdateTransaction);
router.delete('/transactions/:id', blockedDeleteTransaction);

// ✅ Instead use correction workflow
POST /api/corrections/request
```

#### 3. **Date Validation**
```javascript
// Backdate Policy: 30 days without approval
const validateTransactionDate = (date) => {
  const daysDifference = (today - date) / (1000 * 60 * 60 * 24);
  
  if (daysDifference < 0) {
    return { allowed: false, reason: 'Future dates not allowed' };
  }
  
  if (daysDifference <= 30) {
    return { allowed: true, reason: 'Within 30-day grace period' };
  }
  
  return { allowed: false, reason: 'Backdate beyond 30 days requires approval' };
};
```

#### 4. **IP Address Logging**
- All transactions log client IP
- User agent tracking
- Session ID tracking
- Audit trail for security events

---

## 🌐 API Reference

### Authentication Endpoints

```javascript
POST   /api/auth/register          // Register new user
POST   /api/auth/login             // Login
GET    /api/auth/me                // Get current user (protected)
POST   /api/auth/reset-password    // Reset password (admin only)
```

### Transaction Endpoints

```javascript
// Immutable Transaction System
POST   /api/transactions/credit              // Create credit transaction
POST   /api/transactions/debit               // Create debit transaction
GET    /api/transactions/history             // Get transaction history
GET    /api/transactions/balance             // Get balance summary
GET    /api/transactions/balance/live        // Live balance calculation
POST   /api/transactions/validate-date       // Validate transaction date
GET    /api/transactions/integrity/verify    // Verify system integrity (admin)

// Legacy System (Read-only)
GET    /api/transactions                     // List transactions
GET    /api/transactions/:id                 // Get transaction details

// Blocked Routes (Security Protection)
PUT    /api/transactions/:id                 // ❌ BLOCKED - Returns 403
DELETE /api/transactions/:id                 // ❌ BLOCKED - Returns 403
```

### Monthly Report Endpoints

```javascript
GET    /api/reports/monthly/:year/:month/:accountId
       // Query params: 
       //   - all_accounts=true (combine all accounts)
       //   - regenerate=true (force recalculation)
       //   - _t=timestamp (cache buster)

GET    /api/reports/available-months/:accountId
       // Get months with transaction data

GET    /api/reports/monthly-snapshots/:accountId/:year/:month
       // Get snapshot data for month

POST   /api/reports/regenerate-snapshots/:accountId/:year/:month
       // Force snapshot regeneration

POST   /api/reports/backfill-snapshots/:accountId
       // Backfill snapshots for date range
```

### Account Management

```javascript
GET    /api/accounts              // List all accounts
GET    /api/accounts/:id          // Get account details
POST   /api/accounts              // Create account
PUT    /api/accounts/:id          // Update account
DELETE /api/accounts/:id          // Delete account
```

### Ledger Head Management

```javascript
GET    /api/ledger-heads                    // List all ledger heads
GET    /api/ledger-heads?account_id=1       // Filter by account
GET    /api/ledger-heads?head_type=credit   // Filter by type
GET    /api/ledger-heads/:id                // Get ledger head details
POST   /api/ledger-heads                    // Create ledger head
PUT    /api/ledger-heads/:id                // Update ledger head
DELETE /api/ledger-heads/:id                // Delete ledger head
```

### Donor Management

```javascript
GET    /api/donors              // List all donors
GET    /api/donors/:id          // Get donor details
POST   /api/donors              // Create donor
PUT    /api/donors/:id          // Update donor
DELETE /api/donors/:id          // Delete donor
```

### Booklet Management

```javascript
GET    /api/booklets            // List all booklets
GET    /api/booklets/:id        // Get booklet details
POST   /api/booklets            // Create booklet
PUT    /api/booklets/:id        // Update booklet
```

### Admin Endpoints

```javascript
GET    /api/admin/users         // List all users (admin only)
POST   /api/admin/users         // Create user (admin only)
PUT    /api/admin/users/:id     // Update user (admin only)
DELETE /api/admin/users/:id     // Delete user (admin only)
PUT    /api/admin/users/:id/permissions  // Update permissions (admin only)
```

---

## 💻 Frontend Architecture

### Page Structure

#### Authentication Pages

**Login** (`pages/auth/login.js`)
- Email/password authentication
- JWT token storage
- Role-based redirect
- Error handling

**Register** (`pages/auth/register.js`)
- User registration
- Auto-login after registration
- Admin approval workflow

#### Main Application Pages

**Dashboard** (`pages/dashboard.js`)
- Welcome screen
- Quick statistics
- Navigation shortcuts
- Role-based content

**Transactions** (`pages/transactions.js`)
- Tab-based interface:
  - List view (transaction history)
  - Create credit transaction
  - Create debit transaction
  - Transaction details
- Real-time validation
- Receipt integration
- Donor selection

**Monthly Reports** (`pages/monthly-reports.js`)
- Year/month selector
- Combined account reporting
- Real-time vs historical indicator
- Export functionality
- Traditional balance sheet layout
- Snapshot regeneration

**Ledger Management** (`pages/manage-ledger.js`)
- CRUD operations for ledger heads
- Type selection (credit/debit)
- Islamic category assignment
- Balance tracking

**Accounts** (`pages/accounts.js`)
- Account list
- Balance summaries
- Account creation/editing

**Donors** (`pages/donors.js`)
- Donor database
- Contact management
- Donation history

**Booklets** (`pages/booklets.js`)
- Receipt booklet management
- Usage tracking
- Sequential numbering

### Component Architecture

#### Transaction Components

**ImmutableCreditTransactionForm** (`components/transactions/ImmutableCreditTransactionForm.js`)
- Multi-step form wizard
- Date validation
- Amount calculation (cash/bank split)
- Booklet/receipt selection
- Donor selection
- Real-time validation
- Success/error handling

**DebitTransactionForm** (`components/transactions/DebitTransactionForm.js`)
- Source ledger selection
- Balance checking
- Payment method selection
- Expense categorization

**TransactionsList** (`components/transactions/TransactionsList.js`)
- Paginated table
- Filtering by date, type, amount
- Search functionality
- View/edit actions
- Transaction status badges

**TransactionDetails** (`components/transactions/TransactionDetails.js`)
- Full transaction view
- Audit trail display
- Hash verification
- Correction history

#### Layout Components

**Sidebar** (`components/Sidebar.js`)
- Collapsible navigation
- Permission-based menu items
- Dark mode toggle
- Active route highlighting

**Layout** (`components/Layout.js`)
- Page wrapper
- Sidebar integration
- Header bar
- Responsive design

#### Auth Components

**ProtectedRoute** (`components/auth/ProtectedRoute.js`)
- Route protection
- Permission checking
- Redirect to login

**AuthLayout** (`components/auth/AuthLayout.js`)
- Minimal layout for auth pages
- Centered form design

### State Management

#### AuthContext (`contexts/AuthContext.js`)

**Global State:**
```javascript
{
  user: {
    id: INTEGER,
    name: STRING,
    email: STRING,
    role: 'admin' | 'user',
    permissions: {
      dashboard: BOOLEAN,
      transactions: BOOLEAN,
      reports: BOOLEAN,
      accounts: BOOLEAN,
      settings: BOOLEAN
    },
    token: STRING
  },
  loading: BOOLEAN,
  isAuthenticated: BOOLEAN
}
```

**Methods:**
```javascript
login(email, password)        // Authenticate user
logout()                      // Clear session
register(name, email, pass)   // Create account
getCurrentUser()              // Refresh user data
hasRole(role)                 // Check role
hasPagePermission(page)       // Check permission
```

#### API Configuration (`config/index.js`)

```javascript
const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002',
  API_PREFIX: '/api',
  TIMEOUT: 30000
};
```

**Global Axios Setup:**
- Automatic token injection (Authorization header)
- 401 response interceptor (auto-logout)
- Error handling
- Request/response logging

---

## 🔄 Data Flow Examples

### Example 1: Creating a Credit Transaction

```
Frontend (React)
    ↓
    POST /api/transactions/credit
    {
      account_id: 1,
      ledger_head_id: 5,
      amount: 1000,
      cash_amount: 600,
      bank_amount: 400,
      cash_type: "mixed",
      transaction_date: "2025-10-01",
      description: "Monthly donation"
    }
    ↓
Backend (Express)
    ↓
    authMiddleware.protect (verify JWT)
    ↓
    immutableTransactionController.createCredit
    ↓
    immutableTransactionService.createCreditTransaction
    ↓
    1. Validate data
    2. Check date (30-day backdate allowed)
    3. Calculate hash chain
    4. Create TransactionLog entry
    5. Update LedgerHead balance
    6. Create audit trail
    7. Trigger snapshot updates (if backdated)
    ↓
    Response {
      success: true,
      transaction: {
        uuid: "...",
        log_id: 123,
        hash: "...",
        requires_approval: false
      }
    }
    ↓
Frontend
    ↓
    Display success message
    Redirect to transaction details
```

### Example 2: Generating Monthly Report

```
Frontend (React)
    ↓
    GET /api/reports/monthly/2024/10/1?all_accounts=true
    ↓
Backend (Express)
    ↓
    authMiddleware.protect
    ↓
    simpleMonthlyReportController.generateMonthlyReport
    ↓
    Check if current month or historical:
    
    IF CURRENT MONTH:
        ↓
        generateRealTimeReport()
        ↓
        1. Get ALL ledger heads
        2. Get ALL transactions in month
        3. Calculate opening balances (previous months)
        4. Calculate credits this month
        5. Calculate source debits this month
        6. Calculate closing balances
        7. Calculate cash/bank split
        8. Group by account
        ↓
        Return real-time report
    
    IF HISTORICAL MONTH:
        ↓
        generateHistoricalReport()
        ↓
        1. Check if snapshots exist
        2. If not, generate snapshots
        3. Load snapshot data
        4. Build report from snapshots
        ↓
        Return historical report
    ↓
    Response {
      success: true,
      data: {
        account_groups: [...],
        credit_heads: [...],
        debit_heads: [...],
        totals: {
          opening_balance: 5000,
          total_credits: 10000,
          total_debits: 8000,
          closing_balance: 7000
        }
      },
      report_type: "real_time" | "historical_snapshot"
    }
    ↓
Frontend
    ↓
    Render report table
    Display totals
    Show real-time indicator
```

### Example 3: Balance Calculation for Credit Head

```
Scenario: Salary Ledger (Credit Head)

Initial Balance: ₹5000

Transactions:
1. Oct 1: Credit ₹500 (New donation)
2. Oct 10: Debit ₹140 FROM Salary (source_ledger_head_id=5)
3. Oct 15: Debit ₹75 FROM Salary (source_ledger_head_id=5)

Balance Calculation:
    Opening Balance (Oct 1): ₹5000
    + Credits this month: ₹500
    - Source debits this month: ₹215 (₹140 + ₹75)
    = Closing Balance: ₹5285

CRITICAL: Only count source debits WITHIN the month
- NOT all historical source debits
- This bug was fixed in October 2024
```

---

## 🛠️ Development Workflow

### Backend Development

#### Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with database credentials

# Run migrations
npm run db:migrate

# Start development server
npm run dev  # Port 3002
```

#### Environment Variables (.env)
```bash
NODE_ENV=development
PORT=3002
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iafa_software
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your-secret-key-here
```

#### Database Migrations
```bash
# Generate new migration
npm run migration:generate -- --name add-new-field

# Run migrations
npm run db:migrate

# Rollback last migration
npm run db:migrate:undo

# Seed database
npm run db:seed
```

#### Testing
```bash
# Run comprehensive test
node src/comprehensive-financial-system-test.js

# Test balance calculations
node src/test-fixed-balance-calculations.js

# Test monthly reports
node src/test-monthly-report-final.js
```

### Frontend Development

#### Setup
```bash
cd frontend
npm install

# Start development server
npm run dev  # Port 3000
```

#### Environment Variables (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3002
```

#### Build for Production
```bash
npm run build
npm run start
```

---

## 📚 Key Documentation Files

### System Design Documentation

1. **CLAUDE_CODEBASE_REFERENCE.md**
   - Comprehensive system overview
   - Architecture diagrams
   - Critical code sections

2. **backend-architecture.md**
   - Application flow diagrams
   - Routes to controllers mapping
   - Data flow examples

3. **ACCOUNTING_SYSTEM_ANALYSIS.md**
   - Detailed accounting logic
   - Balance calculation formulas
   - Islamic accounting principles

4. **BACKDATE_TRANSACTION_SYSTEM_README.md**
   - Backdate policies
   - Approval workflows
   - Snapshot regeneration

5. **MONTHLY_REPORTING_SYSTEM_README.md**
   - Report generation process
   - Real-time vs historical
   - Snapshot management

### Implementation Guides

6. **LOG_BASED_SYSTEM_IMPLEMENTATION_GUIDE.md**
   - Immutable logging system
   - Hash chain integrity
   - Audit trail design

7. **IMMUTABLE_LOGGING_SYSTEM_DESIGN.md**
   - Technical implementation
   - Security considerations
   - Performance optimizations

8. **SIMPLIFIED_NO_APPROVAL_BACKDATE_SYSTEM_README.md**
   - 30-day backdate policy
   - No approval required
   - Automatic snapshot updates

### Bug Fixes & Improvements

9. **BALANCE_FIXES_SUMMARY.md**
   - Balance calculation bug fixes
   - Source ledger head tracking
   - Date range filtering fixes

10. **TRANSACTION_DATE_VALIDATION_FIX.md**
    - Date validation logic
    - Weekend grace periods
    - Future date prevention

11. **PERIOD_OPENING_BUG_FIX.md**
    - Opening balance calculation
    - Month-to-month continuity
    - Snapshot regeneration

### Testing & Verification

12. **MONTH_END_BACKDATE_EXAMPLES_README.md**
    - Test scenarios
    - Expected results
    - Edge case handling

13. **REAL_BALANCE_ERROR_SCENARIO.txt**
    - Real-world error examples
    - Debugging steps
    - Solutions applied

---

## 🚨 Known Issues & Solutions

### Fixed Issues

#### 1. **Balance Calculation Bug (October 2024)**

**Problem:**
```javascript
// Frontend showed ₹235, should show ₹310
// Root cause: Counting ALL historical source debits instead of current month only
```

**Solution:**
```javascript
// Added date range filter to source debits query
if (isCurrentMonth) {
  sourceDebitsFilter = {
    transaction_date: {
      [Op.between]: [monthStart, monthEnd]  // ✅ Fixed
    }
  };
}
```

#### 2. **Frontend/Backend Port Mismatch**

**Problem:**
```javascript
// Frontend calling: http://localhost:4000
// Backend running on: http://localhost:3002
// Result: Network errors
```

**Solution:**
```javascript
// Updated frontend config
const API_CONFIG = {
  BASE_URL: 'http://localhost:3002'  // ✅ Fixed
};
```

#### 3. **Mixed Payment Amount Calculation**

**Problem:**
```javascript
// When cash_type = 'mixed'
// Amount was not auto-calculating from cash + bank
```

**Solution:**
```javascript
// Added auto-calculation in useEffect
if (formData.cash_type === 'mixed') {
  const total = parseFloat(cash_amount) + parseFloat(bank_amount);
  setFormData(prev => ({ ...prev, amount: total }));
}
```

### Current Limitations

1. **No Multi-Currency Support**
   - System assumes single currency (PKR)
   - Need currency table and conversion rates

2. **No Bulk Transaction Import**
   - Transactions must be entered one at a time
   - Need CSV/Excel import functionality

3. **Limited Reporting Options**
   - Only monthly reports available
   - Need yearly, quarterly reports
   - Need custom date range reports

4. **No Email Notifications**
   - No email alerts for approvals
   - No receipt emails to donors

5. **No Mobile App**
   - Web-only interface
   - Need React Native mobile app

---

## 🔐 Security Considerations

### Current Security Measures

✅ **Implemented:**
1. JWT authentication (24h expiration)
2. Password hashing (bcryptjs, 10 rounds)
3. Role-based access control
4. Permission-based page access
5. Immutable transaction logs
6. Cryptographic hash chain
7. IP address logging
8. Client info tracking
9. CORS configuration
10. SQL injection prevention (Sequelize ORM)

### Recommended Improvements

⚠️ **To Implement:**
1. **Rate Limiting**
   - Prevent brute force attacks
   - Use express-rate-limit

2. **HTTPS Enforcement**
   - Force SSL in production
   - Redirect HTTP to HTTPS

3. **Input Sanitization**
   - Sanitize all user inputs
   - Use validator.js

4. **Session Management**
   - Implement refresh tokens
   - Token rotation
   - Revocation list

5. **Audit Log Encryption**
   - Encrypt sensitive data at rest
   - Use AES-256

6. **Two-Factor Authentication**
   - Optional 2FA for admins
   - SMS or authenticator app

7. **Security Headers**
   - Helmet.js for Express
   - CSP, HSTS, X-Frame-Options

8. **Database Encryption**
   - Encrypt sensitive columns
   - Use PostgreSQL TDE

---

## 📊 Performance Optimization

### Current Optimizations

✅ **Implemented:**
1. Database indexes on frequently queried fields
2. Snapshot caching for historical reports
3. Pagination on transaction lists
4. Lazy loading of components
5. Sequelize eager loading for associations
6. Connection pooling (Sequelize default)

### Recommended Optimizations

⚠️ **To Implement:**
1. **Redis Caching**
   - Cache frequently accessed data
   - Cache API responses
   - Session storage

2. **CDN for Static Assets**
   - Serve CSS/JS from CDN
   - Image optimization
   - Lazy loading images

3. **Database Query Optimization**
   - Analyze slow queries
   - Add composite indexes
   - Optimize N+1 queries

4. **API Response Compression**
   - Enable gzip compression
   - Reduce payload sizes

5. **Frontend Code Splitting**
   - Lazy load routes
   - Dynamic imports
   - Tree shaking

6. **Background Job Processing**
   - Use Bull/Bee-Queue
   - Process snapshots async
   - Email sending in background

---

## 🧪 Testing Strategy

### Current Testing

**Manual Testing:**
- Comprehensive test scripts in `/src/test-*.js`
- API endpoint testing
- Balance calculation verification
- Snapshot generation testing

### Recommended Testing

**Unit Tests:**
```javascript
// Example: Testing balance calculation
describe('Balance Calculation', () => {
  it('should calculate correct opening balance', async () => {
    const balance = await calculateOpeningBalance(1, 5, '2024-10-01');
    expect(balance).toBe(5000);
  });
  
  it('should calculate correct closing balance', async () => {
    const balance = await calculateClosingBalance(1, 5, '2024-10-01', '2024-10-31');
    expect(balance).toBe(5285);
  });
});
```

**Integration Tests:**
```javascript
// Example: Testing transaction creation
describe('Transaction Creation', () => {
  it('should create credit transaction', async () => {
    const response = await request(app)
      .post('/api/transactions/credit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        account_id: 1,
        ledger_head_id: 5,
        amount: 1000
      });
    
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});
```

**E2E Tests:**
```javascript
// Example: Cypress test
describe('Monthly Report', () => {
  it('should generate report for current month', () => {
    cy.login('admin@iafa.com', 'admin123');
    cy.visit('/monthly-reports');
    cy.get('[data-cy=year-select]').select('2024');
    cy.get('[data-cy=month-select]').select('10');
    cy.get('[data-cy=generate-btn]').click();
    cy.get('[data-cy=report-table]').should('be.visible');
  });
});
```

---

## 📦 Deployment Guide

### Production Deployment

#### Backend Deployment

**Prerequisites:**
- Node.js 14+
- PostgreSQL 12+
- PM2 or Docker

**Steps:**
```bash
# 1. Clone repository
git clone https://github.com/your-org/iafa-software.git
cd iafa-software/backend

# 2. Install dependencies
npm install --production

# 3. Set environment variables
cp .env.example .env
nano .env  # Edit with production values

# 4. Run migrations
npm run db:migrate

# 5. Start with PM2
pm2 start src/server.js --name iafa-backend

# 6. Save PM2 config
pm2 save
pm2 startup
```

**Docker Deployment:**
```dockerfile
# Dockerfile
FROM node:14-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3002
CMD ["node", "src/server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "3002:3002"
    environment:
      - DB_HOST=postgres
      - DB_USER=iafa
      - DB_PASSWORD=secure_password
      - DB_NAME=iafa_production
    depends_on:
      - postgres
  
  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=iafa_production
      - POSTGRES_USER=iafa
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

#### Frontend Deployment

**Vercel Deployment:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel --prod
```

**Nginx Deployment:**
```bash
# Build static site
npm run build

# Configure Nginx
server {
    listen 80;
    server_name iafa.example.com;
    
    root /var/www/iafa/frontend/.next;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🎓 Development Best Practices

### Code Style

**JavaScript:**
- Use ES6+ features
- Async/await over callbacks
- Descriptive variable names
- JSDoc comments for functions

**React:**
- Functional components with hooks
- PropTypes or TypeScript
- Component composition
- Custom hooks for logic reuse

### Git Workflow

**Branch Strategy:**
```
main (production)
  ↓
develop (staging)
  ↓
feature/new-feature
feature/bug-fix
hotfix/critical-bug
```

**Commit Messages:**
```
feat: Add donor report functionality
fix: Correct balance calculation for credit heads
docs: Update API documentation
refactor: Simplify transaction service
test: Add unit tests for balance service
```

### Database Migrations

**Best Practices:**
1. Always create migrations for schema changes
2. Never modify existing migrations
3. Test migrations on development first
4. Include rollback logic
5. Document breaking changes

**Example Migration:**
```javascript
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('transaction_log', 'source_ledger_head_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'ledger_heads',
        key: 'id'
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('transaction_log', 'source_ledger_head_id');
  }
};
```

---

## 🔮 Future Roadmap

### Phase 1: Core Enhancements (Q1 2025)
- [ ] Multi-currency support
- [ ] Bulk transaction import (CSV/Excel)
- [ ] Email notifications
- [ ] PDF report export
- [ ] Advanced filtering & search

### Phase 2: Advanced Features (Q2 2025)
- [ ] Recurring transactions
- [ ] Budget management
- [ ] Expense approval workflow
- [ ] Custom report builder
- [ ] Dashboard widgets

### Phase 3: Integration & Expansion (Q3 2025)
- [ ] Mobile app (React Native)
- [ ] API documentation (Swagger)
- [ ] Third-party integrations
- [ ] Multi-tenancy support
- [ ] Advanced analytics

### Phase 4: Enterprise Features (Q4 2025)
- [ ] Audit log viewer
- [ ] Role hierarchy
- [ ] Custom workflows
- [ ] Real-time notifications
- [ ] Blockchain integration

---

## 📞 Support & Contribution

### Getting Help

**Documentation:**
- README.md (project overview)
- CLAUDE_CODEBASE_REFERENCE.md (comprehensive guide)
- Individual feature documentation in /docs

**Contact:**
- Email: support@iafa.com
- GitHub Issues: https://github.com/your-org/iafa-software/issues

### Contributing

**Setup:**
1. Fork repository
2. Create feature branch
3. Make changes
4. Write tests
5. Submit pull request

**Code Review:**
- All PRs require review
- Pass all tests
- Follow code style
- Update documentation

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 🙏 Acknowledgments

**Built With:**
- Express.js - Backend framework
- Next.js - Frontend framework
- PostgreSQL - Database
- Sequelize - ORM
- TailwindCSS - Styling
- React Icons - Icons

**Special Thanks:**
- Development team
- Islamic accounting advisors
- Beta testers
- Open source community

---

**Last Updated:** 2025-10-02  
**Version:** 1.0  
**Maintained By:** IAFA Development Team
