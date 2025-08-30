/**
 * Test script to verify the fixed opening balance calculation
 */
const db = require('./src/models');
const BalanceCalculator = require('./src/utils/fixed-calculator');

async function testOpeningBalanceCalculation() {
    try {
        console.log('Testing fixed opening balance calculation...');

        // Get a test account
        const account = await db.Account.findOne();
        if (!account) {
            console.error('No account found');
            return;
        }
        console.log(`Using account: ${account.id} - ${account.name}`);

        // Get a test ledger head
        const ledgerHead = await db.LedgerHead.findOne({
            where: { account_id: account.id }
        });
        if (!ledgerHead) {
            console.error('No ledger head found');
            return;
        }
        console.log(`Using ledger head: ${ledgerHead.id} - ${ledgerHead.name}`);

        // Test with a current month
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        console.log(`\nTesting with current month: ${currentMonth}/${currentYear}`);
        
        const openingBalance = await BalanceCalculator.calculateOpeningBalance(
            ledgerHead.id,
            account.id,
            currentMonth,
            currentYear
        );
        
        console.log(`Opening balance: ${openingBalance}`);
        
        // Test with a past month
        const pastMonth = currentMonth > 1 ? currentMonth - 1 : 12;
        const pastYear = pastMonth === 12 ? currentYear - 1 : currentYear;
        
        console.log(`\nTesting with past month: ${pastMonth}/${pastYear}`);
        
        const pastOpeningBalance = await BalanceCalculator.calculateOpeningBalance(
            ledgerHead.id,
            account.id,
            pastMonth,
            pastYear
        );
        
        console.log(`Past month opening balance: ${pastOpeningBalance}`);
        
        console.log('\nTest completed successfully!');
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await db.sequelize.close();
    }
}

testOpeningBalanceCalculation(); 