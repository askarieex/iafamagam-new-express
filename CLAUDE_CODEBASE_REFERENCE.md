# IAFA Software - Comprehensive Codebase Reference for Claude

## Overview
**IAFA (Islamic Accounting Financial Application)** is a sophisticated financial management system built for Islamic accounting principles. It provides real-time transaction logging, immutable audit trails, monthly reporting, and balance calculations.

## 🏗️ Project Architecture

### Technology Stack
- **Backend**: Node.js + Express.js + PostgreSQL + Sequelize ORM
- **Frontend**: Next.js + React + TailwindCSS + React Icons
- **Authentication**: JWT + bcryptjs
- **Database**: PostgreSQL with JSON/JSONB support
- **Development**: nodemon, sequelize-cli

### Project Structure
```
iafamagam-new-express/
├── backend/                    # Express.js API server
│   ├── src/
│   │   ├── models/            # Sequelize models (database schema)
│   │   ├── controllers/       # Route handlers and business logic
│   │   ├── services/          # Business logic and calculations
│   │   ├── routes/           # API route definitions
│   │   ├── middleware/       # Authentication & authorization
│   │   ├── migrations/       # Database schema migrations
│   │   ├── seeders/          # Database seed data
│   │   ├── scripts/          # Utility and setup scripts
│   │   ├── config/           # Database configuration
│   │   └── utils/            # Helper utilities
│   └── package.json
└── frontend/                  # Next.js React application
    ├── pages/                # Next.js pages (routes)
    ├── components/           # Reusable React components
    ├── contexts/             # React context providers
    ├── hooks/                # Custom React hooks
    ├── config/               # API configuration
    ├── layouts/              # Page layout components
    └── package.json
```

## 📊 Database Models & Schema

### Core Models

#### 1. **TransactionLog** (Immutable Log-based System)
**File**: `src/models/transactionLog.js`
**Purpose**: Immutable audit trail for all financial transactions

**Key Features**:
- **Immutable**: Cannot be updated or deleted (enforced by hooks)
- **Log-based**: Every transaction creates a log entry
- **Hash Chain**: Cryptographic integrity with hash linking
- **Approval System**: Multi-level approval workflow
- **Correction Support**: Corrections reference original transactions

**Important Fields**:
- `log_id`: Primary key, auto-increment
- `transaction_uuid`: Unique transaction identifier
- `action_type`: CREATE, CORRECT_AMOUNT, CORRECT_DATE, REVERSE, VOID
- `source_ledger_head_id`: **Critical for balance calculations** - tracks where debit amounts come from
- `tx_type`: credit/debit
- `amount`, `cash_amount`, `bank_amount`: Financial amounts
- `current_hash`, `previous_hash`: Blockchain-like integrity

#### 2. **LedgerHead** (Chart of Accounts)
**File**: `src/models/ledgerHead.js`
**Purpose**: Defines income/expense categories

**Key Features**:
- `head_type`: 'credit' (income) or 'debit' (expense)
- `dependency_type`: independent, dependent, expense
- `current_balance`, `cash_balance`, `bank_balance`: Current totals
- Islamic accounting categories

#### 3. **Account** (Organizational Units)
**File**: `src/models/account.js`
**Purpose**: Separate financial entities (e.g., different departments)

#### 4. **User** (Authentication & Authorization)
**File**: `src/models/user.js`
**Purpose**: System users with role-based permissions

### Other Models
- **Donor**: Donation tracking
- **Booklet**: Receipt management
- **Cheque**: Check processing
- **BankAccount**: Bank account management
- **MonthlyBalanceSummary**: Month-end snapshots

## 🎯 Core Business Logic

### Monthly Report System
**Primary Controller**: `src/controllers/simpleMonthlyReportController.js`

#### Real-time vs Historical Reporting
1. **Current Month**: Real-time calculations from TransactionLog
2. **Historical Months**: Snapshot-based calculations from MonthlyBalanceSummary

#### Critical Balance Calculation Logic
**Source**: Lines in `simpleMonthlyReportController.js`

**For Credit Heads (Income)**:
```javascript
// Opening Balance: Sum of all transactions before month start
openingBalance = await calculateOpeningBalance(ledgerHeadId, monthStart)

// Credits During Month: Sum of credit transactions in current month
creditsThisMonth = await sumCreditsInMonth(ledgerHeadId, monthStart, monthEnd)

// Source Debits: CRITICAL - Only debits FROM this ledger head in current month
sourceDebits = await sumSourceDebitsInMonth(ledgerHeadId, monthStart, monthEnd)

// Net Closing Balance
closingBalance = openingBalance + creditsThisMonth - sourceDebits
```

**Key Issue We Fixed**:
- **Bug**: Was counting ALL historical source debits (₹215)
- **Fix**: Only count source debits WITHIN the current month (₹140)
- **Field**: `source_ledger_head_id` tracks which ledger head the debit came from

### Service Layer

#### 1. **immutableTransactionService.js**
- Core transaction processing
- Balance calculations
- Integrity validation

#### 2. **monthlySnapshotService.js**
- Month-end snapshot generation
- Historical data preservation

#### 3. **realTimeBalanceService.js**
- Live balance calculations
- Cash/bank amount tracking

## 🌐 API Routes

### Authentication Routes (`/api/auth`)
- `POST /login` - User authentication
- `POST /register` - User registration
- `POST /logout` - Session termination

### Financial Routes (All require authentication)
- `GET /api/accounts` - List accounts
- `GET /api/ledger-heads` - List ledger heads
- `GET /api/transactions` - Transaction management
- `GET /api/reports/monthly/:year/:month/:accountId` - **Key monthly report endpoint**

### Admin Routes (`/api/admin`) - Admin role required
- User management
- System configuration

## 🎨 Frontend Architecture

### Key Pages

#### 1. **Monthly Reports** (`pages/monthly-reports.js`)
**Purpose**: Main reporting interface
**Features**:
- Year/month selection
- Real-time vs historical indicators
- Traditional balance sheet layout
- Account-wise grouping
- Export functionality

**Data Flow**:
```javascript
// API Configuration
BASE_URL: 'http://localhost:3002' // Must match backend port
API_PREFIX: '/api'

// API Call
GET /api/reports/monthly/2025/10/1?all_accounts=true

// Response Structure
{
  success: true,
  data: {
    account_groups: [...],     // Used by frontend table
    credit_heads: [...],       // Main data source
    debit_heads: [...],
    totals: {                  // Used by header summary
      closing_balance: 310     // Correct calculation
    }
  }
}
```

**Table Logic**:
```javascript
// Balance column displays:
creditHead.closing_balance  // From account_groups data

// Header displays:
reportData.totals.closing_balance  // From totals calculation
```

#### 2. **Dashboard** (`pages/dashboard.js`)
- Overview widgets
- Quick navigation
- Summary statistics

#### 3. **Transactions** (`pages/transactions.js`)
- Transaction entry forms
- Transaction history
- Status tracking

### Components Structure

#### Layout Components
- `components/Layout.js` - Main layout wrapper
- `components/Sidebar.js` - Navigation sidebar
- `layouts/MainLayout.js` - Page layout

#### Transaction Components
- `CreditTransactionForm.js` - Income entry
- `DebitTransactionForm.js` - Expense entry
- `ImmutableCreditTransactionForm.js` - Immutable income entry
- `TransactionsList.js` - Transaction display

#### Authentication Components
- `AuthLayout.js` - Login page layout
- `ProtectedRoute.js` - Route protection
- `UserProfile.js` - User management

### State Management
- **React Context**: `contexts/AuthContext.js` for authentication
- **Local State**: useState/useEffect for component state
- **API Calls**: Axios with centralized configuration

## 🐛 Known Issues & Solutions

### 1. **Balance Calculation Bug (FIXED)**
**Issue**: Balance column showed ₹235 instead of ₹310
**Root Cause**:
- Backend was counting ALL source debits (₹215) instead of current month only (₹140)
- Frontend/backend port mismatch (4000 vs 3002)

**Solution Applied**:
```javascript
// Fixed sourceDebitsFilter to include date range for current month
if (isCurrentMonth) {
    sourceDebitsFilter = {
        transaction_date: {
            [db.Sequelize.Op.between]: [monthStart, monthEnd]
        }
    };
}
```

### 2. **Frontend/Backend Configuration**
**Issue**: Network errors due to port mismatch
**Solution**:
- Backend runs on port 3002
- Frontend config updated to match: `BASE_URL: 'http://localhost:3002'`

## 🔧 Development Workflow

### Backend Development
```bash
cd backend
npm install
npm run dev          # Start development server on port 3002
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database with test data
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev          # Start Next.js dev server on port 3000
npm run build        # Build for production
```

### Database Operations
```bash
# Create new migration
npm run migration:generate -- --name add-new-field

# Run migrations
npm run db:migrate

# Rollback migration
npm run db:migrate:undo
```

## 📁 File Categories

### Backend Files by Type

#### Models (Database Schema)
- `models/transactionLog.js` - **Most Important** - Immutable transaction log
- `models/ledgerHead.js` - Chart of accounts
- `models/account.js` - Organizational accounts
- `models/user.js` - Authentication
- `models/donor.js`, `models/booklet.js`, `models/cheque.js` - Supporting entities

#### Controllers (API Handlers)
- `controllers/simpleMonthlyReportController.js` - **Critical** - Monthly reporting
- `controllers/transactionController.js` - Transaction management
- `controllers/authController.js` - Authentication
- `controllers/accountController.js` - Account management

#### Services (Business Logic)
- `services/immutableTransactionService.js` - **Core** - Transaction processing
- `services/monthlySnapshotService.js` - Snapshot generation
- `services/realTimeBalanceService.js` - Live calculations

#### Routes (API Endpoints)
- `routes/monthlyReportRoutes.js` - Report endpoints
- `routes/transactionRoutes.js` - Transaction endpoints
- `routes/authRoutes.js` - Authentication endpoints

### Frontend Files by Type

#### Pages (Routes)
- `pages/monthly-reports.js` - **Primary** - Main reporting interface
- `pages/dashboard.js` - Home dashboard
- `pages/transactions.js` - Transaction management
- `pages/auth/login.js` - Authentication

#### Components (Reusable UI)
- `components/transactions/` - Transaction-related components
- `components/auth/` - Authentication components
- `components/Layout.js` - Main layout

## 🔍 Debugging & Testing

### Debug Scripts (All in `src/`)
- `debug-api-response.js` - Test API responses
- `debug-data-structures.js` - Compare data structures
- `debug-frontend-api-call.js` - Test frontend API calls
- `debug-september-api.js` - September-specific testing

### Test Scripts
- `test-october-report-fix.js` - October report validation
- `comprehensive-*-test.js` - Various system tests

### Common Debugging Steps
1. **API Issues**: Check port configuration (3002 vs 4000)
2. **Balance Issues**: Verify source_ledger_head_id logic
3. **Frontend Issues**: Check browser cache and API configuration
4. **Database Issues**: Check transaction log integrity

## 🚀 Deployment Considerations

### Environment Variables
```bash
# Backend (.env)
NODE_ENV=production
PORT=3002
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key

# Frontend (next.config.js or .env.local)
NEXT_PUBLIC_API_URL=http://your-backend-url
```

### Database Considerations
- PostgreSQL required for JSONB support
- Ensure proper indexes on transaction_log table
- Regular backup of immutable transaction data

## 📝 Important Notes for Future Development

### Critical Code Areas
1. **Balance Calculations**: Always verify source_ledger_head_id logic
2. **Date Filters**: Ensure proper date range filtering for real-time calculations
3. **Immutable Logs**: Never attempt to modify TransactionLog records
4. **Port Configuration**: Keep frontend/backend ports synchronized

### Best Practices
1. **Always test balance calculations** with debug scripts before deployment
2. **Verify both real-time and historical report accuracy**
3. **Use proper error handling** for all financial calculations
4. **Maintain audit trail integrity** in all operations

### Common Pitfalls
1. **Date Range Issues**: Always use proper date filtering for current month calculations
2. **Data Structure Confusion**: Frontend uses account_groups, not main credit_heads array
3. **Cache Issues**: Add cache busters for API calls when needed
4. **Type Coercion**: Be careful with decimal calculations and JavaScript number precision

---

*This document serves as a comprehensive reference for understanding and working with the IAFA Software codebase. Keep it updated as the system evolves.*