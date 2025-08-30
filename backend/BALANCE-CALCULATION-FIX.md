# Opening Balance Calculation Bug Fix

## Issue Description

There was a critical bug in how opening balances were calculated when opening historical (backdated) accounting periods:

1. When opening a period before the current month (e.g., opening June when current month is July), the system incorrectly used July's closing balance as June's opening balance.

2. This caused confusion for users who would see incorrect opening balances until they posted a transaction in the backdated period, at which point the system would correct the balance.

3. The root cause was in the query that determined opening balances - it was taking the latest snapshot's closing balance without restricting to periods earlier than the one being opened.

4. The issue also appeared in the UI layer, where API queries weren't properly filtering by date when fetching monthly balances.

## Fix Implemented

### Backend Fixes

The fix ensures that when calculating opening balances for a period, the system only considers snapshots from strictly earlier periods:

1. In `balanceCalculator.js` and `improvedBalanceCalculator.js`, the query for finding previous balances now uses:
   ```javascript
   [Op.or]: [
       { year: { [Op.lt]: year } },                   // Any month from earlier years
       { year, month: { [Op.lt]: month } }            // Earlier month same year
   ]
   ```

2. In `monthlyClosureController.js`, the `manuallyOpenPeriod` function was fixed to use the same approach when finding previous balances.

3. In `monthlyLedgerBalanceController.js`, a special handling was added for month/year specific queries to ensure the UI layer gets the correct opening balances:
   ```javascript
   // Process each balance to ensure opening balances are correct
   const processedBalances = [];
   
   for (const balance of monthlyBalances) {
       // If this is an existing record with a valid opening balance, use it as is
       if (balance.opening_balance !== null && balance.opening_balance !== undefined) {
           processedBalances.push(balance);
           continue;
       }
       
       // Calculate proper opening balance from strictly earlier periods
       const prevPeriod = await db.MonthlyLedgerBalance.findOne({
           where: {
               account_id: balance.account_id,
               ledger_head_id: balance.ledger_head_id,
               [Op.or]: [
                   { year: { [Op.lt]: targetYear } },
                   { year: targetYear, month: { [Op.lt]: targetMonth } }
               ]
           },
           order: [['year', 'DESC'], ['month', 'DESC']]
       });
       
       // Set opening balance based on previous period or default to zero
       // ...
   }
   ```

4. The fix has been implemented in:
   - `balanceCalculator.js` in the `calculateOpeningBalance` method
   - `improvedBalanceCalculator.js` when determining opening balances
   - `monthlyClosureService.js` in the `openAccountingPeriod` method
   - `monthlyClosureController.js` in the `manuallyOpenPeriod` function
   - `monthlyLedgerBalanceController.js` in the `getAllMonthlyBalances` method

### Frontend Fixes

To ensure the UI is updated correctly and doesn't use cached data:

1. Added a refresh mechanism in the monthly snapshots page:
   - Created a shared `refreshMonthlySnapshots` function that can be called from other components
   - The function ensures all monthly balance data is refreshed when called
   - Added cache-busting parameters to prevent stale data:
     ```javascript
     const cacheParam = forceRefresh ? `&_t=${new Date().getTime()}` : '';
     ```

2. Modified the transaction forms to call this refresh function after successful transaction submission:
   - Updated `CreditTransactionForm` to call `refreshMonthlySnapshots` after transaction creation/update
   - Updated `DebitTransactionForm` to do the same

## Testing

A test script has been added at `src/tests/test-opening-balance.js` that verifies:

1. When opening June 2025 after having transactions in July 2025, June's opening balance is correctly set to 0, not July's 1000.

2. After adding a 500 transaction to June and recalculating periods, July's opening balance is correctly updated to 500.

3. When opening May 2025, its opening balance is also correctly set to 0, not copying from June or July.

## Business Impact Resolution

With this fix:

1. Users will see correct opening balances (0 or previous month's closing) when opening backdated periods.

2. The system will still properly propagate changes forward when transactions are added to backdated periods.

3. User trust in the system data will be maintained as they will no longer see figures that appear to be "from the future".

4. The UI will now refresh properly after transactions are posted, showing the correct balances immediately without requiring a page reload.

5. The API layer will ensure that queries for monthly balances always respect the proper date filters, even if the database has outdated values.

## SQL Implementation

The fix follows the suggested guardrail SQL approach to only consider earlier periods:

```sql
SELECT closing_balance
FROM monthly_ledger_balances
WHERE account_id = :acc
    AND ledger_head_id = :lh
    AND (year < :yr OR (year = :yr AND month < :mn))
ORDER BY year DESC, month DESC
LIMIT 1;
```

This ensures we get the most recent closing balance, but only from periods before the one being opened. 