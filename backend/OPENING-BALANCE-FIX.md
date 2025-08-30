# Opening Balance Calculation Fix

## Issue
When reopening a past period (e.g., June 2025) after already having closed a later period (e.g., July 2025), the system incorrectly used the later month's closing balance as the earlier month's opening balance. This created a backwards flow of balances, which is incorrect from an accounting perspective.

```
Before fix:
June.opening_balance = July.closing_balance  // WRONG! Future affecting the past
```

## Root Cause
The `calculateOpeningBalance` method in `balanceCalculator.js` was looking at specific previous periods but wasn't restricting the search to only consider periods chronologically before the one being opened. This allowed future periods to influence past periods.

## Fix Implemented
We modified the `calculateOpeningBalance` method to only consider periods that come chronologically before the period being opened:

```javascript
static async calculateOpeningBalance(ledgerHeadId, accountId, month, year, transaction = null) {
    // FIXED: Get the most recent closed period BEFORE the month we're opening
    const prevMonthBalance = await db.MonthlyLedgerBalance.findOne({
        where: {
            ledger_head_id: ledgerHeadId,
            account_id: accountId,
            [Op.or]: [
                { year: { [Op.lt]: year } },                   // Any month from earlier years
                { year, month: { [Op.lt]: month } }            // Earlier month same year
            ]
        },
        order: [['year', 'DESC'], ['month', 'DESC']],          // Get the most recent one
        transaction
    });
    
    // Use the previous month's closing balance as this month's opening
    // or calculate from all transactions before this month if no previous month exists
    // ...
}
```

This ensures:
1. When reopening June, the system only looks at months before June (January through May)
2. It selects the most recent of these as the source of the opening balance (May's closing balance)
3. July's data never flows backward into June

## Testing
The fix has been tested with:

1. A direct test that verifies the function returns the correct previous period
2. Simulations of reopening past periods

## Benefits

- Maintains proper accounting principles (past → present → future)
- Prevents incorrect balances when backdating transactions
- Ensures financial statements reflect accurate data for each month
- Preserves the integrity of the period-based accounting system

## Additional Notes

- If no previous month exists, the system falls back to calculating the opening balance from all transactions that occurred before the start of the reopened month
- After setting the correct opening balance, the system still recalculates forward to ensure all subsequent months reflect the changes 