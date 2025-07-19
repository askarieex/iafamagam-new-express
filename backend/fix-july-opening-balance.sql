-- Fix July 2025 opening balance to match June's closing balance
-- This will correct the balance propagation issue

UPDATE monthly_ledger_balances 
SET opening_balance = (
    SELECT closing_balance 
    FROM monthly_ledger_balances june 
    WHERE june.ledger_head_id = monthly_ledger_balances.ledger_head_id 
    AND june.account_id = monthly_ledger_balances.account_id
    AND june.month = 6 
    AND june.year = 2025
)
WHERE month = 7 
AND year = 2025 
AND account_id = 1;

-- Also update the closing balance calculation for July
UPDATE monthly_ledger_balances 
SET closing_balance = opening_balance + receipts - payments
WHERE month = 7 
AND year = 2025 
AND account_id = 1;

-- Verify the changes
SELECT 
    month, 
    year,
    ledger_head_id,
    opening_balance,
    receipts,
    payments,
    closing_balance
FROM monthly_ledger_balances 
WHERE account_id = 1 
AND ((month = 6 AND year = 2025) OR (month = 7 AND year = 2025))
ORDER BY month, ledger_head_id; 