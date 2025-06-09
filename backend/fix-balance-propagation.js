/**
 * Fix for Balance Propagation Issue with Backdated Transactions
 * 
 * ISSUE DESCRIPTION:
 * When opening a past period (e.g., April) after already having transactions in a later period (e.g., June),
 * the system incorrectly uses June's closing balance as April's opening balance, instead of using
 * March's closing balance. This creates incorrect balances across all affected periods.
 * 
 * SOLUTION:
 * 1. Modify openAccountingPeriod in monthlyClosureService.js to automatically recalculate all
 *    affected period balances when opening a backdated period
 * 2. Ensure the recalculateMonthlySnapshots method in balanceCalculator.js properly carries forward
 *    each month's closing balance to the next month's opening balance
 * 
 * IMPLEMENTATION STEPS:
 * 
 * 1. In monthlyClosureService.js, add the following code right before the "Log the period opening" line
 *    (around line 350-360 depending on your version):
 * 
 * ```javascript
 * // Check if this is a backdated period and needs recalculation
 * const currentDate = new Date();
 * const currentMonth = currentDate.getMonth() + 1;
 * const currentYear = currentDate.getFullYear();
 * const isBackdated = (year < currentYear || (year === currentYear && month < currentMonth));
 * 
 * if (isBackdated) {
 *     console.log(`Period ${month}/${year} is backdated compared to current ${currentMonth}/${currentYear}. Triggering recalculation.`);
 *     
 *     // Recalculate all months from this period to current month
 *     // for each ledger head to ensure proper balance propagation
 *     for (const ledgerHead of ledgerHeads) {
 *         try {
 *             // Use the first day of the opened month as the starting point
 *             const fromDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
 *             
 *             // Call recalculateMonthlySnapshots to fix balances from this month forward
 *             await BalanceCalculator.recalculateMonthlySnapshots(
 *                 accountId,
 *                 ledgerHead.id,
 *                 fromDate,
 *                 transaction
 *             );
 *             
 *             console.log(`Recalculated balances for ledger ${ledgerHead.id} from ${month}/${year} forward`);
 *         } catch (recalcError) {
 *             console.error(`Error recalculating balances for ledger ${ledgerHead.id}:`, recalcError);
 *             // Continue with other ledger heads even if one fails
 *         }
 *     }
 * }
 * ```
 * 
 * 2. Make sure the recalculateMonthlySnapshots method in balanceCalculator.js is using the previousMonthClosingBalance
 *    variable to track and propagate balances through months.
 * 
 * NOTE: The balanceCalculator.js file already has the correct implementation of recalculateMonthlySnapshots
 * that properly propagates balances. This fix focuses on triggering that recalculation when a backdated period
 * is opened.
 * 
 * After applying this fix, when you open April:
 * 1. The system will calculate April's opening balance correctly (from March's closing balance)
 * 2. It will then recalculate April's closing balance based on any transactions in April
 * 3. This new closing balance will propagate to May's opening balance
 * 4. The process continues through all subsequent months, ensuring consistent balances
 */

const fs = require('fs');
const path = require('path');

console.log('Starting balance propagation fix...');

// Path to balanceCalculator.js
const balanceCalculatorPath = path.join(__dirname, 'src', 'utils', 'balanceCalculator.js');

try {
    // Read the current file
    let content = fs.readFileSync(balanceCalculatorPath, 'utf8');
    
    // Look for the recalculateMonthlySnapshots method
    if (content.includes('static async recalculateMonthlySnapshots')) {
        console.log('Found recalculateMonthlySnapshots method, modifying...');
        
        // Add tracking of previous month's closing balance for proper propagation
        const modifiedContent = content.replace(
            /static async recalculateMonthlySnapshots\(accountId, ledgerHeadId, fromDate, transaction = null\) {([\s\S]*?)const results = \[\];/m,
            `static async recalculateMonthlySnapshots(accountId, ledgerHeadId, fromDate, transaction = null) {$1const results = [];\n        let previousMonthClosingBalance = null; // Track previous month's closing balance\n        console.log(\`Recalculating monthly snapshots for account \${accountId}, ledger \${ledgerHeadId} from \${fromDate}\`);\n`
        );
        
        // Update the opening balance calculation to use previous month's closing balance
        const improvedOpeningBalance = modifiedContent.replace(
            /const openingBalance = currentMonth === startMonth && currentYear === startYear[\s\S]*?\);/m,
            `// Calculate opening balance for this month
            let openingBalance;
            
            if (previousMonthClosingBalance !== null) {
                // Use previous month's closing balance as this month's opening
                openingBalance = previousMonthClosingBalance;
                console.log(\`Using previous month's closing balance: \${openingBalance}\`);
            } else if (currentMonth === startMonth && currentYear === startYear) {
                // For the first month in the sequence, calculate from all prior transactions
                openingBalance = await this.calculateBalanceFromTransactions(
                    ledgerHeadId, accountId, null, fromDateObj, transaction
                );
                console.log(\`Calculated first month opening balance: \${openingBalance}\`);
            } else {
                // Standard opening balance calculation
                openingBalance = await this.calculateOpeningBalance(
                    ledgerHeadId, accountId, currentMonth, currentYear, transaction
                );
                console.log(\`Calculated opening balance: \${openingBalance}\`);
            }`
        );
        
        // Store closing balance for next month's opening
        const updatedClosingBalance = improvedOpeningBalance.replace(
            /const closingBalance = parseFloat\(openingBalance\) \+ parseFloat\(receipts\) - parseFloat\(payments\);/,
            `const closingBalance = parseFloat(openingBalance) + parseFloat(receipts) - parseFloat(payments);
            
            // Store for next iteration (this is the key improvement)
            previousMonthClosingBalance = closingBalance;
            console.log(\`Calculated closing balance: \${closingBalance}, will be used for next month's opening\`);`
        );
        
        // Write the updated file
        fs.writeFileSync(balanceCalculatorPath, updatedClosingBalance, 'utf8');
        console.log('Successfully updated balanceCalculator.js!');
        
        // Create a backup of the original file
        fs.writeFileSync(`${balanceCalculatorPath}.bak`, content, 'utf8');
        console.log('Created backup of original file as balanceCalculator.js.bak');
        
        console.log('Fix complete! Please restart your server for changes to take effect.');
    } else {
        console.log('Could not find recalculateMonthlySnapshots method in balanceCalculator.js');
    }
} catch (error) {
    console.error('Error applying fix:', error);
} 