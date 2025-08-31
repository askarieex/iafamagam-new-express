# Cascading Balance System for Backdated Transactions

## Problem Statement

When users add backdated transactions (e.g., adding a missed transaction in April after May is already open), the system would correctly update April's closing balance but fail to update May's opening balance. This broke the fundamental accounting principle where one month's closing balance must equal the next month's opening balance.

**Example Issue:**
- April initially: Opening ₹0, Receipts ₹10,000, Payments ₹6,000, Closing ₹4,000
- May initially: Opening ₹4,000, Receipts ₹2,000, Payments ₹1,000, Closing ₹5,000
- User adds backdated transaction in April: +₹1,000 receipt
- April after: Opening ₹0, Receipts ₹11,000, Payments ₹6,000, Closing ₹5,000
- May (BROKEN): Opening ₹4,000, Receipts ₹2,000, Payments ₹1,000, Closing ₹5,000
- **Problem**: April's closing (₹5,000) ≠ May's opening (₹4,000)

## Solution Implemented

### 1. Enhanced Balance Calculation Service

**File**: `backend/src/services/balanceCalculationService.js`

#### New Core Functions:

**`recalculateForwardBalances(accountId, ledgerHeadId, startMonth, startYear, transaction)`**
- Recalculates all monthly balance records from the specified month forward
- Ensures proper opening/closing balance chain across all subsequent months
- Only processes credit heads (debit heads don't carry forward balances)

**`triggerCascadingUpdate(accountId, ledgerHeadId, txDate, transaction)`**
- Main entry point called by transaction controllers
- Automatically detects the month of the backdated transaction
- Triggers cascading updates for all months from that point forward

**`recalculateMonthTransactions(accountId, ledgerHeadId, month, year, transaction)`**
- Recalculates a specific month's totals from actual transaction data
- Handles complex cash/bank splits correctly
- Ensures data integrity by rebuilding from source transactions

**`syncLedgerHeadCurrentBalance(ledgerHeadId, transaction)`**
- Synchronizes ledger head's current balance with latest monthly snapshot
- Maintains consistency between real-time and snapshot balances

### 2. Updated Transaction Controllers

**File**: `backend/src/controllers/transactionController.js`

#### Enhanced Transaction Processing:
- **Credit Transactions**: Triggers cascading updates for primary ledger and all split ledgers
- **Debit Transactions**: Triggers cascading updates for target ledger and all source ledgers  
- **Transaction Voiding**: Handles cascading updates when admin voids transactions in closed periods

#### Automatic Detection:
```javascript
const isBackdated = txDateObj < today;
if (isBackdated || periodCheck.requiresRecalculation) {
    await balanceCalculationService.triggerCascadingUpdate(
        accountId, ledgerHeadId, txDate, transaction
    );
}
```

### 3. Smart Period Management Integration

The system works seamlessly with the existing period management:
- Respects period open/closed status
- Handles admin overrides for closed periods
- Maintains audit trail of backdated changes

## How It Works

### Step-by-Step Process:

1. **Transaction Added**: User adds a backdated transaction (e.g., April receipt)

2. **Detection**: System detects transaction date < current date

3. **Cascading Trigger**: `triggerCascadingUpdate()` is called with April's date

4. **Forward Recalculation**: System finds all monthly records from April forward:
   - April 2025
   - May 2025  
   - June 2025
   - July 2025
   - August 2025 (current)

5. **Sequential Processing**: Each month is processed in chronological order:
   
   **April Recalculation:**
   - Recalculates receipts/payments from actual transactions
   - Updates closing balance: Opening + Receipts - Payments
   
   **May Recalculation:**
   - Sets opening balance = April's closing balance (₹5,000)
   - Recalculates receipts/payments from actual transactions  
   - Updates closing balance: ₹5,000 + Receipts - Payments
   
   **June Recalculation:**
   - Sets opening balance = May's closing balance
   - And so on...

6. **Chain Verification**: System ensures each month's closing = next month's opening

## Benefits

### ✅ **Accounting Integrity**
- Maintains proper opening/closing balance chain
- Ensures financial reports are always accurate
- Prevents phantom balances or discrepancies

### ✅ **Automatic Processing**  
- No manual intervention required
- Works transparently when users add backdated transactions
- Handles complex scenarios (splits, multiple ledgers, etc.)

### ✅ **Performance Optimized**
- Only recalculates affected months
- Uses efficient SQL queries to rebuild from source data
- Maintains database consistency throughout process

### ✅ **Audit Trail**
- Logs all cascading updates
- Clear visibility into what changed and why
- Maintains history of admin overrides

## Example Scenario

**Initial State:**
```
April 2025:  Opening=₹0,     Receipts=₹10,000, Payments=₹6,000, Closing=₹4,000
May 2025:    Opening=₹4,000, Receipts=₹2,000,  Payments=₹1,000, Closing=₹5,000  
June 2025:   Opening=₹5,000, Receipts=₹3,000,  Payments=₹2,000, Closing=₹6,000
```

**User Action:** Add backdated receipt of ₹1,000 in April

**System Processing:**
1. Detects backdated transaction in April
2. Triggers cascading update from April forward
3. Recalculates April: New closing = ₹0 + ₹11,000 - ₹6,000 = ₹5,000
4. Updates May opening = ₹5,000, recalculates May closing = ₹6,000  
5. Updates June opening = ₹6,000, recalculates June closing = ₹7,000

**Final State:**
```
April 2025:  Opening=₹0,     Receipts=₹11,000, Payments=₹6,000, Closing=₹5,000
May 2025:    Opening=₹5,000, Receipts=₹2,000,  Payments=₹1,000, Closing=₹6,000
June 2025:   Opening=₹6,000, Receipts=₹3,000,  Payments=₹2,000, Closing=₹7,000
```

✅ **Perfect Chain**: April closing (₹5,000) = May opening (₹5,000), etc.

## Testing

A comprehensive test script is available: `backend/test-cascading-balances.js`

Run the test:
```bash
cd backend
node test-cascading-balances.js
```

The test verifies:
- Cascading updates work correctly
- Balance chains are properly maintained
- System handles edge cases gracefully

## Technical Implementation Details

### Database Operations
- Uses database transactions to ensure atomicity
- Leverages row-level locking to prevent race conditions
- Rebuilds monthly snapshots from authoritative transaction data

### Error Handling
- Graceful failure with rollback on errors
- Comprehensive logging for troubleshooting
- Non-blocking: UI remains responsive during recalculation

### Performance Considerations
- Only processes affected ledger heads and months
- Uses efficient bulk SQL queries
- Minimal impact on user experience

## Usage in Production

The system is now active and will automatically handle:
- ✅ Backdated credit transactions (donations, receipts)
- ✅ Backdated debit transactions (expenses, transfers)
- ✅ Split transactions across multiple ledger heads
- ✅ Admin transaction voids in closed periods
- ✅ Period reopening and corrections

**No user action required** - the system works automatically behind the scenes to maintain accounting integrity.

---

*This system solves the core problem of maintaining accurate financial records when users need to enter backdated transactions, ensuring the accounting system remains reliable and trustworthy.*