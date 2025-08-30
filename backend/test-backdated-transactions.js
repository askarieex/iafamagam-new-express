/**
 * Comprehensive test for backdated transactions and opening balance calculation
 * 
 * This script tests the entire flow:
 * 1. Start with July open
 * 2. Add transaction in July
 * 3. Close July 
 * 4. Reopen June
 * 5. Verify June opening balance is NOT from July
 * 6. Add transaction in June
 * 7. Close June
 * 8. Verify July opening balance is now updated from June
 */
const db = require('./src/models');
const BalanceCalculator = require('./src/utils/balanceCalculator');
const monthlyClosureService = require('./src/services/monthlyClosureService');

// Create a closure service instance
const closureService = monthlyClosureService;

// Utility functions
const displayMonthBalance = async (accountId, ledgerHeadId, month, year) => {
    const snapshot = await db.MonthlyLedgerBalance.findOne({
        where: {
            account_id: accountId,
            ledger_head_id: ledgerHeadId,
            month,
            year
        }
    });

    if (snapshot) {
        console.log(`${month}/${year} balance: opening=${snapshot.opening_balance}, closing=${snapshot.closing_balance}`);
        return snapshot;
    } else {
        console.log(`No snapshot found for ${month}/${year}`);
        return null;
    }
};

// Create a transaction in the specified month
const createTransaction = async (accountId, ledgerHeadId, month, year, amount) => {
    // Calculate a date in the middle of the month
    const day = 15;
    const txDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    
    try {
        const transaction = await db.Transaction.create({
            account_id: accountId,
            ledger_head_id: ledgerHeadId,
            tx_type: 'credit',
            amount: amount,
            cash_amount: amount,
            bank_amount: 0,
            cash_type: 'cash',
            tx_date: txDate,
            description: `Test transaction for ${month}/${year}`,
            status: 'completed'
        });
        
        console.log(`Created test transaction of ${amount} on ${txDate}`);
        return transaction;
    } catch (error) {
        console.error('Failed to create test transaction:', error);
        return null;
    }
};

// Main test function
async function testBackdatedTransactions() {
    try {
        console.log('\n=== TESTING BACKDATED TRANSACTIONS ===\n');

        // Get a test account
        const account = await db.Account.findOne();
        
        if (!account) {
            console.error('No active account found for testing');
            return;
        }
        console.log(`Using account: ${account.id} - ${account.name}`);

        // Get a test ledger head
        const ledgerHead = await db.LedgerHead.findOne({
            where: { 
                account_id: account.id
            }
        });
        
        if (!ledgerHead) {
            console.error('No suitable ledger head found');
            return;
        }
        console.log(`Using ledger head: ${ledgerHead.id} - ${ledgerHead.name}`);

        // Test with specific months
        const julyMonth = 7;
        const julyYear = 2025;
        const juneMonth = 6; 
        const juneYear = 2025;
        const mayMonth = 5;
        const mayYear = 2025;

        // Step 1: Close any open periods to start fresh
        console.log('\n=== STEP 1: Close any open periods ===');
        await db.MonthlyLedgerBalance.update(
            { is_open: false },
            { where: { account_id: account.id } }
        );
        
        // Step 2: Open July
        console.log('\n=== STEP 2: Open July 2025 ===');
        await closureService.openAccountingPeriod(julyMonth, julyYear, account.id);
        await displayMonthBalance(account.id, ledgerHead.id, julyMonth, julyYear);
        
        // Step 3: Create a transaction in July for 500
        console.log('\n=== STEP 3: Add 500 transaction in July ===');
        await createTransaction(account.id, ledgerHead.id, julyMonth, julyYear, 500);
        
        // Recalculate to update balances
        await closureService.recalculateMonthlySnapshots(
            account.id, ledgerHead.id, `${julyYear}-${julyMonth.toString().padStart(2, '0')}-01`
        );
        await displayMonthBalance(account.id, ledgerHead.id, julyMonth, julyYear);
        
        // Step 4: Close July
        console.log('\n=== STEP 4: Close July 2025 ===');
        await closureService.closeAccountingPeriod(julyMonth, julyYear, account.id);
        const julySnapshot = await displayMonthBalance(account.id, ledgerHead.id, julyMonth, julyYear);
        
        // Step 5: Open June
        console.log('\n=== STEP 5: Open June 2025 ===');
        await closureService.openAccountingPeriod(juneMonth, juneYear, account.id);
        const juneSnapshot = await displayMonthBalance(account.id, ledgerHead.id, juneMonth, juneYear);
        
        // Verify June's opening balance is not from July (KEY TEST)
        console.log('\n=== VERIFICATION: June opening should NOT be July\'s closing ===');
        const isJuneOpeningFromJuly = parseFloat(juneSnapshot.opening_balance) === parseFloat(julySnapshot.closing_balance);
        console.log(`June opening (${juneSnapshot.opening_balance}) equals July closing (${julySnapshot.closing_balance})? ${isJuneOpeningFromJuly ? 'FAIL ❌' : 'CORRECT ✅'}`);
        
        if (!isJuneOpeningFromJuly) {
            console.log('✅ FIX WORKING: June is not using July\'s balance');
        } else {
            console.log('❌ FIX NOT WORKING: June is still using July\'s balance incorrectly');
        }
        
        // Step 6: Create a transaction in June for 750
        console.log('\n=== STEP 6: Add 750 transaction in June ===');
        await createTransaction(account.id, ledgerHead.id, juneMonth, juneYear, 750);
        
        // Recalculate to update balances
        await closureService.recalculateMonthlySnapshots(
            account.id, ledgerHead.id, `${juneYear}-${juneMonth.toString().padStart(2, '0')}-01`
        );
        const juneSnapshotAfterTx = await displayMonthBalance(account.id, ledgerHead.id, juneMonth, juneYear);
        
        // Step 7: Close June
        console.log('\n=== STEP 7: Close June 2025 ===');
        await closureService.closeAccountingPeriod(juneMonth, juneYear, account.id);
        
        // Check July's opening balance again - should now be updated from June's closing
        console.log('\n=== VERIFICATION: July opening should now be June\'s closing ===');
        // Re-get July snapshot
        const julySnapshotAfterJuneClosed = await displayMonthBalance(account.id, ledgerHead.id, julyMonth, julyYear);
        const juneSnapshotAfterClose = await displayMonthBalance(account.id, ledgerHead.id, juneMonth, juneYear);
        
        const isJulyOpeningFromJune = parseFloat(julySnapshotAfterJuneClosed.opening_balance) === parseFloat(juneSnapshotAfterClose.closing_balance);
        console.log(`July opening (${julySnapshotAfterJuneClosed.opening_balance}) equals June closing (${juneSnapshotAfterClose.closing_balance})? ${isJulyOpeningFromJune ? 'CORRECT ✅' : 'FAIL ❌'}`);
        
        // Test opening May
        console.log('\n=== STEP 8: Open May 2025 ===');
        await closureService.openAccountingPeriod(mayMonth, mayYear, account.id);
        const maySnapshot = await displayMonthBalance(account.id, ledgerHead.id, mayMonth, mayYear);
        
        // Verify May's opening balance is NOT from June or July (KEY TEST)
        console.log('\n=== VERIFICATION: May opening should NOT be June\'s or July\'s closing ===');
        const isMayOpeningFromJune = parseFloat(maySnapshot.opening_balance) === parseFloat(juneSnapshotAfterClose.closing_balance);
        const isMayOpeningFromJuly = parseFloat(maySnapshot.opening_balance) === parseFloat(julySnapshotAfterJuneClosed.closing_balance);
        
        console.log(`May opening (${maySnapshot.opening_balance}) equals June closing (${juneSnapshotAfterClose.closing_balance})? ${isMayOpeningFromJune ? 'FAIL ❌' : 'CORRECT ✅'}`);
        console.log(`May opening (${maySnapshot.opening_balance}) equals July closing (${julySnapshotAfterJuneClosed.closing_balance})? ${isMayOpeningFromJuly ? 'FAIL ❌' : 'CORRECT ✅'}`);
        
        // Final verdict
        if (!isJuneOpeningFromJuly && isJulyOpeningFromJune && !isMayOpeningFromJune && !isMayOpeningFromJuly) {
            console.log('\n✅✅✅ ALL TESTS PASSED: Balance propagation is working correctly! ✅✅✅');
        } else {
            console.log('\n❌❌❌ TESTS FAILED: Balance propagation still has issues! ❌❌❌');
        }
        
    } catch (error) {
        console.error('Test failed with error:', error);
    } finally {
        console.log('\nTest complete. Closing database connection.');
        await db.sequelize.close();
    }
}

// Run the test
testBackdatedTransactions(); 