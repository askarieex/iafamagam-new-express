/**
 * Test script to verify the opening balance calculation fix
 * 
 * This script simulates reopening a past month after closing later months
 * to ensure the opening balance is calculated correctly and propagated forward.
 */
const db = require('./src/models');
const MonthlyClosureService = require('./src/services/monthlyClosureService');
const BalanceCalculator = require('./src/utils/balanceCalculator');
const ImprovedBalanceCalculator = require('./src/utils/improvedBalanceCalculator');

// Create instances of services
const closureService = new MonthlyClosureService();

async function runTest() {
    try {
        console.log('Starting balance calculation test...');

        // 1. Get a test account
        const account = await db.Account.findOne({
            where: { is_active: true }
        });

        if (!account) {
            console.error('No active account found for testing');
            process.exit(1);
        }

        console.log(`Using test account: ${account.id} - ${account.name}`);

        // 2. Get ledger heads for the account
        const ledgerHeads = await db.LedgerHead.findAll({
            where: { account_id: account.id }
        });

        if (!ledgerHeads.length) {
            console.error('No ledger heads found for test account');
            process.exit(1);
        }

        const testLedgerHead = ledgerHeads[0];
        console.log(`Using test ledger head: ${testLedgerHead.id} - ${testLedgerHead.name}`);

        // 3. Get current open period
        const currentPeriod = await closureService.getOpenPeriodForAccount(account.id);
        console.log(`Current open period: ${currentPeriod ? `${currentPeriod.month}/${currentPeriod.year}` : 'None'}`);

        // If no period is open, open the current month
        if (!currentPeriod) {
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            
            console.log(`Opening current period: ${currentMonth}/${currentYear}`);
            await closureService.openAccountingPeriod(currentMonth, currentYear, account.id);
        }

        // 4. Create a scenario with backdated opening
        // First, close the current period to simulate a typical month-end
        const periodToClose = await closureService.getOpenPeriodForAccount(account.id);
        
        if (!periodToClose) {
            console.error('No open period found to close');
            process.exit(1);
        }
        
        console.log(`Closing period: ${periodToClose.month}/${periodToClose.year}`);
        await closureService.closeAccountingPeriod(periodToClose.month, periodToClose.year, account.id);
        
        // Now open a future month (one month ahead)
        let futureMonth = periodToClose.month === 12 ? 1 : periodToClose.month + 1;
        let futureYear = periodToClose.month === 12 ? periodToClose.year + 1 : periodToClose.year;
        
        console.log(`Opening future period: ${futureMonth}/${futureYear}`);
        await closureService.openAccountingPeriod(futureMonth, futureYear, account.id);
        
        // Get the balances before reopening the past period
        const futurePeriodBefore = await db.MonthlyLedgerBalance.findOne({
            where: {
                account_id: account.id,
                ledger_head_id: testLedgerHead.id,
                month: futureMonth,
                year: futureYear
            }
        });
        
        console.log('Future period before reopening past:', {
            opening_balance: futurePeriodBefore.opening_balance,
            closing_balance: futurePeriodBefore.closing_balance
        });
        
        // Now reopen a past period (before the one we just closed)
        let pastMonth = periodToClose.month === 1 ? 12 : periodToClose.month - 1;
        let pastYear = periodToClose.month === 1 ? periodToClose.year - 1 : periodToClose.year;
        
        console.log(`Reopening past period: ${pastMonth}/${pastYear}`);
        await closureService.openAccountingPeriod(pastMonth, pastYear, account.id);
        
        // Check the balances to verify correct propagation
        const pastPeriod = await db.MonthlyLedgerBalance.findOne({
            where: {
                account_id: account.id,
                ledger_head_id: testLedgerHead.id,
                month: pastMonth,
                year: pastYear
            }
        });
        
        const closedPeriod = await db.MonthlyLedgerBalance.findOne({
            where: {
                account_id: account.id,
                ledger_head_id: testLedgerHead.id,
                month: periodToClose.month,
                year: periodToClose.year
            }
        });
        
        const futurePeriodAfter = await db.MonthlyLedgerBalance.findOne({
            where: {
                account_id: account.id,
                ledger_head_id: testLedgerHead.id,
                month: futureMonth,
                year: futureYear
            }
        });
        
        console.log('\n=== TEST RESULTS ===');
        console.log(`Past Period (${pastMonth}/${pastYear}):`, {
            opening_balance: pastPeriod.opening_balance,
            closing_balance: pastPeriod.closing_balance
        });
        
        console.log(`Closed Period (${periodToClose.month}/${periodToClose.year}):`, {
            opening_balance: closedPeriod.opening_balance,
            closing_balance: closedPeriod.closing_balance
        });
        
        console.log(`Future Period (${futureMonth}/${futureYear}) After:`, {
            opening_balance: futurePeriodAfter.opening_balance,
            closing_balance: futurePeriodAfter.closing_balance
        });
        
        // Verify the balance propagation
        console.log('\n=== VERIFICATION ===');
        const pastClosingSameAsClosedOpening = parseFloat(pastPeriod.closing_balance) === parseFloat(closedPeriod.opening_balance);
        const closedClosingSameAsFutureOpening = parseFloat(closedPeriod.closing_balance) === parseFloat(futurePeriodAfter.opening_balance);
        
        console.log(`Past closing balance equals closed period opening balance: ${pastClosingSameAsClosedOpening ? 'PASS ✅' : 'FAIL ❌'}`);
        console.log(`Closed period closing balance equals future period opening balance: ${closedClosingSameAsFutureOpening ? 'PASS ✅' : 'FAIL ❌'}`);
        
        // Final result
        if (pastClosingSameAsClosedOpening && closedClosingSameAsFutureOpening) {
            console.log('\n✅ TEST PASSED: Balance propagation is working correctly!');
        } else {
            console.log('\n❌ TEST FAILED: Balance propagation has issues!');
            if (!pastClosingSameAsClosedOpening) {
                console.log(`  - Past closing (${pastPeriod.closing_balance}) should equal closed opening (${closedPeriod.opening_balance})`);
            }
            if (!closedClosingSameAsFutureOpening) {
                console.log(`  - Closed closing (${closedPeriod.closing_balance}) should equal future opening (${futurePeriodAfter.opening_balance})`);
            }
        }

    } catch (error) {
        console.error('Test failed with error:', error);
    } finally {
        // Close the database connection
        await db.sequelize.close();
    }
}

// Run the test
runTest().then(() => console.log('Test completed.')); 