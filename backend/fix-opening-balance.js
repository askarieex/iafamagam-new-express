/**
 * Fix for Opening Balance Calculation Issue
 * 
 * This script fixes the issue where reopening a past period incorrectly uses
 * a future month's closing balance as the opening balance, rather than using
 * the most recent earlier month's closing balance.
 * 
 * SOLUTION:
 * Modify the calculateOpeningBalance method in balanceCalculator.js to only consider 
 * periods that come chronologically BEFORE the target month.
 */

const fs = require('fs');
const path = require('path');

console.log('Starting opening balance calculation fix...');

// Path to balanceCalculator.js
const balanceCalculatorPath = path.join(__dirname, 'src', 'utils', 'balanceCalculator.js');

try {
    // Read the current file
    let content = fs.readFileSync(balanceCalculatorPath, 'utf8');
    
    // Check if the fix is already applied
    if (content.includes('[Op.or]: [') && content.includes('year: { [Op.lt]: year }')) {
        console.log('Fix is already applied. No changes needed.');
        process.exit(0);
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

    // Find and replace the old method
    const oldMethodRegex = /static async calculateOpeningBalance\([^{]*\{[\s\S]*?(?=static async|module.exports|}\n\n\/\*\*)/;
    const updatedContent = content.replace(oldMethodRegex, newMethod);
    
    // Write the updated file
    fs.writeFileSync(balanceCalculatorPath, updatedContent, 'utf8');
    console.log('Successfully updated balanceCalculator.js with the fixed opening balance calculation!');
    
    // Create a backup of the original file
    fs.writeFileSync(`${balanceCalculatorPath}.original`, content, 'utf8');
    console.log('Created backup of original file as balanceCalculator.js.original');
    
    console.log('Fix complete! Please restart your server for changes to take effect.');
} catch (error) {
    console.error('Error applying fix:', error);
} 