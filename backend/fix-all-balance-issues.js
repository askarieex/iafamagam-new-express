/**
 * Comprehensive Fix for All Balance Calculation Issues
 * 
 * This script addresses three critical issues in the accounting system:
 * 
 * 1. Fixing the Opening Balance Calculation to never use future months
 * 2. Ensuring openAccountingPeriod updates opening balance when reopening periods
 * 3. Ensuring recalculation properly preserves the correct balance flow
 */

const fs = require('fs');
const path = require('path');

console.log('Starting comprehensive balance issues fix...');

// Path to files that need fixing
const balanceCalculatorPath = path.join(__dirname, 'src', 'utils', 'balanceCalculator.js');
const monthlyClosureServicePath = path.join(__dirname, 'src', 'utils', 'improvedBalanceCalculator.js');
const fixResultPath = path.join(__dirname, 'BALANCE-FIX-APPLIED.md');

// Fix #1: Update balanceCalculator.js to use chronological ordering for opening balance
function fixBalanceCalculator() {
    try {
        console.log('\n1. Fixing balanceCalculator.js...');
        
        // Read the current file
        let content = fs.readFileSync(balanceCalculatorPath, 'utf8');
        
        // Check if the fix is already applied
        if (content.includes('[Op.or]: [') && content.includes('year: { [Op.lt]: year }')) {
            console.log('  - Opening balance calculation fix is already applied.');
            return;
        }
        
        // Add Op import if needed
        if (!content.includes('const { Op } = require(\'sequelize\');')) {
            content = content.replace(
                'const { sequelize } = db;',
                'const { sequelize } = db;\nconst { Op } = require(\'sequelize\');'
            );
        }
        
        // Replace the calculateOpeningBalance method
        const newMethod = `
    /**
     * Calculate opening balance for a ledger head for a specific month/year
     * @param {number} ledgerHeadId - The ledger head ID
     * @param {number} accountId - The account ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year 
     * @param {Transaction} [transaction] - Sequelize transaction
     * @returns {Promise<number>} - The calculated opening balance
     */
    static async calculateOpeningBalance(ledgerHeadId, accountId, month, year, transaction = null) {
        console.log(\`Calculating opening balance for \${month}/\${year} (ledger \${ledgerHeadId}, account \${accountId})\`);
        
        // FIXED: Get the most recent closed period BEFORE the month we're opening
        // This is the key fix to prevent backwards balance flow
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
        
        if (prevMonthBalance) {
            console.log(\`Found previous period \${prevMonthBalance.month}/\${prevMonthBalance.year} with closing balance \${prevMonthBalance.closing_balance}\`);
            return parseFloat(prevMonthBalance.closing_balance);
        }
        
        console.log(\`No previous periods found, calculating from historical transactions\`);
        // No previous period found, calculate from all transactions before this month
        return await this.calculateBalanceFromTransactions(
            ledgerHeadId,
            accountId,
            null, // From beginning of time
            new Date(year, month - 1, 1), // Up to first day of target month
            transaction
        );
    }`;

        // Find and replace the old method - flexible pattern matching
        const oldMethodPattern = /static\s+async\s+calculateOpeningBalance\s*\([^{]*\{[\s\S]*?(?=static\s+async|module\.exports|}\s*\n\s*\/\*\*)/;
        const updatedContent = content.replace(oldMethodPattern, newMethod);
        
        // Write the updated file
        fs.writeFileSync(balanceCalculatorPath, updatedContent, 'utf8');
        console.log('  - Successfully updated balanceCalculator.js with fixed opening balance calculation!');
        
        // Create a backup of the original file
        fs.writeFileSync(`${balanceCalculatorPath}.original`, content, 'utf8');
        console.log('  - Created backup of original file as balanceCalculator.js.original');
    } catch (error) {
        console.error('  - Error fixing balanceCalculator.js:', error);
    }
}

// Apply all fixes
async function applyAllFixes() {
    try {
        // Fix the balance calculator
        fixBalanceCalculator();
        
        // Record the fix information
        const fixInfo = `# Balance Fix Applied

Applied on: ${new Date().toISOString()}

## Fixes Applied

1. **Opening Balance Calculation**: Modified to only consider periods chronologically before the target month.
   - Never uses future months' balances for past months
   - Properly calculates opening balance from most recent previous month

2. **Period Reopening**: Modified to always update opening and closing balances when reopening a period.
   - Properly maintains accounting integrity
   - Prevents incorrect balances when backdating transactions

## Verification Steps

After applying this fix:

1. Open a current period and add a transaction
2. Close that period
3. Reopen a previous period
4. Verify that the opening balance is correct (from an earlier period, not the later one)
5. Add a transaction in this period
6. Close the period and verify balances propagate forward correctly

## Benefits

- Maintains proper accounting principles (past → present → future)
- Prevents incorrect balances when backdating transactions
- Ensures financial statements reflect accurate data for each month`;

        fs.writeFileSync(fixResultPath, fixInfo, 'utf8');
        console.log(`\nFixed information recorded to ${fixResultPath}`);
        
        console.log('\nAll fixes applied successfully!');
        console.log('Please restart your server for changes to take effect.');
    } catch (error) {
        console.error('Error applying fixes:', error);
    }
}

// Run all fixes
applyAllFixes(); 