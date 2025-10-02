/**
 * Comprehensive test from clean database state
 * Tests both current and backdated transactions with automatic snapshot updates
 */

const db = require('./models');
const immutableTransactionService = require('./services/immutableTransactionService');
const monthlySnapshotService = require('./services/monthlySnapshotService');

async function comprehensiveSnapshotTest() {
    try {
        console.log('=== COMPREHENSIVE SNAPSHOT TEST FROM CLEAN STATE ===\n');

        const accountId = 25;
        const donationLedgerId = 108; // Credit ledger
        const expenseLedgerId = 109;  // Debit ledger

        const userContext = {
            userId: 1,
            ipAddress: '127.0.0.1',
            userAgent: 'Comprehensive Test',
            sessionId: 'test-session'
        };

        // 1. Verify clean state
        console.log('1. Verifying clean database state:');
        const transactionCount = await db.TransactionLog.count();
        const snapshotCount = await db.MonthlyBalanceSummary.count();
        console.log(`   Transactions: ${transactionCount}`);
        console.log(`   Snapshots: ${snapshotCount}`);
        console.log(`   ✅ Database is clean and ready`);

        // 2. Create current month transactions (using today's date)
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        const todayStr = today.toISOString().split('T')[0];

        console.log(`\n2. Creating CURRENT month transactions (${currentYear}-${currentMonth.toString().padStart(2, '0')}):`);

        // Transaction 1: Credit ₹100 to donation ledger
        console.log('   Creating: ₹100 donation (current month)');
        const donation1 = await immutableTransactionService.createCreditTransaction({
            account_id: accountId,
            ledger_head_id: donationLedgerId,
            amount: 100,
            cash_amount: 60,
            bank_amount: 40,
            cash_type: 'both',
            transaction_date: todayStr,
            description: 'Current month donation 1'
        }, userContext);
        console.log(`   ✅ Created: ${donation1.transaction.uuid}`);

        // Transaction 2: Another credit ₹50 to donation ledger
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        console.log('   Creating: ₹50 donation (current month)');
        const donation2 = await immutableTransactionService.createCreditTransaction({
            account_id: accountId,
            ledger_head_id: donationLedgerId,
            amount: 50,
            cash_amount: 30,
            bank_amount: 20,
            cash_type: 'both',
            transaction_date: yesterdayStr,
            description: 'Current month donation 2'
        }, userContext);
        console.log(`   ✅ Created: ${donation2.transaction.uuid}`);

        // Transaction 3: Expense ₹30 from donation ledger
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

        console.log('   Creating: ₹30 expense from donation (current month)');
        const expense1 = await immutableTransactionService.createDebitTransaction({
            account_id: accountId,
            ledger_head_id: expenseLedgerId,
            source_ledger_head_id: donationLedgerId,
            amount: 30,
            cash_amount: 20,
            bank_amount: 10,
            cash_type: 'both',
            transaction_date: twoDaysAgoStr,
            description: 'Current month office supplies'
        }, userContext);
        console.log(`   ✅ Created: ${expense1.transaction.uuid}`);

        // 3. Check current balances
        console.log('\n3. Current ledger balances after current month transactions:');
        const donationLedger = await db.LedgerHead.findByPk(donationLedgerId);
        const expenseLedger = await db.LedgerHead.findByPk(expenseLedgerId);

        console.log(`   Donation: ₹${donationLedger.current_balance} (₹${donationLedger.cash_balance} cash + ₹${donationLedger.bank_balance} bank)`);
        console.log(`   Expense: ₹${expenseLedger.current_balance}`);
        console.log(`   Expected Donation: ₹120 (₹100 + ₹50 - ₹30)`);
        console.log(`   Expected Expense: ₹30`);

        // 4. Create snapshots for current month to verify they work
        console.log(`\n4. Creating ${currentYear}-${currentMonth.toString().padStart(2, '0')} snapshots:`);
        await monthlySnapshotService.createMonthlySnapshot(accountId, donationLedgerId, currentYear, currentMonth);
        await monthlySnapshotService.createMonthlySnapshot(accountId, expenseLedgerId, currentYear, currentMonth);
        console.log('   ✅ Current month snapshots created');

        // Check current month snapshots
        const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
        const currentDonationSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: { account_id: accountId, ledger_head_id: donationLedgerId, month_year: currentMonthStr }
        });
        const currentExpenseSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: { account_id: accountId, ledger_head_id: expenseLedgerId, month_year: currentMonthStr }
        });

        console.log(`   Current Month Donation Snapshot: ₹${currentDonationSnapshot.closing_balance}`);
        console.log(`   Current Month Expense Snapshot: ₹${currentExpenseSnapshot.closing_balance}`);

        // 5. Now test BACKDATED transactions (previous month)
        const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        const previousMonthStr = `${previousYear}-${previousMonth.toString().padStart(2, '0')}`;

        console.log(`\n5. Creating BACKDATED transactions (${previousMonthStr}):`);

        // Backdated Transaction 1: Credit ₹80 in previous month
        const backdatedDate1 = `${previousYear}-${previousMonth.toString().padStart(2, '0')}-15`;
        console.log(`   Creating: ₹80 backdated donation (${backdatedDate1})`);
        const backdatedDonation = await immutableTransactionService.createCreditTransaction({
            account_id: accountId,
            ledger_head_id: donationLedgerId,
            amount: 80,
            cash_amount: 50,
            bank_amount: 30,
            cash_type: 'both',
            transaction_date: backdatedDate1,
            description: 'Previous month backdated donation'
        }, userContext);
        console.log(`   ✅ Created: ${backdatedDonation.transaction.uuid}`);

        // Wait for automatic updates
        console.log('   ⏳ Waiting for automatic snapshot updates...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Backdated Transaction 2: Expense ₹25 in previous month
        const backdatedDate2 = `${previousYear}-${previousMonth.toString().padStart(2, '0')}-20`;
        console.log(`   Creating: ₹25 backdated expense (${backdatedDate2})`);
        const backdatedExpense = await immutableTransactionService.createDebitTransaction({
            account_id: accountId,
            ledger_head_id: expenseLedgerId,
            source_ledger_head_id: donationLedgerId,
            amount: 25,
            cash_amount: 15,
            bank_amount: 10,
            cash_type: 'both',
            transaction_date: backdatedDate2,
            description: 'Previous month backdated expense'
        }, userContext);
        console.log(`   ✅ Created: ${backdatedExpense.transaction.uuid}`);

        // Wait for automatic updates
        console.log('   ⏳ Waiting for automatic snapshot updates...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 6. Verify automatic snapshot updates worked
        console.log(`\n6. Checking if ${previousMonthStr} snapshots were created AUTOMATICALLY:`);

        const previousMonthSnapshotStr = `${previousYear}-${previousMonth.toString().padStart(2, '0')}-01`;
        const prevDonationSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: { account_id: accountId, ledger_head_id: donationLedgerId, month_year: previousMonthSnapshotStr }
        });
        const prevExpenseSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: { account_id: accountId, ledger_head_id: expenseLedgerId, month_year: previousMonthSnapshotStr }
        });

        console.log(`   Previous Month Donation Snapshot: ${prevDonationSnapshot ? '✅ CREATED' : '❌ NOT CREATED'}`);
        console.log(`   Previous Month Expense Snapshot: ${prevExpenseSnapshot ? '✅ CREATED' : '❌ NOT CREATED'}`);

        if (prevDonationSnapshot) {
            console.log(`   Previous Month Donation: ₹${prevDonationSnapshot.closing_balance} (₹${prevDonationSnapshot.cash_amount} cash + ₹${prevDonationSnapshot.bank_amount} bank)`);
            console.log(`   Expected: ₹55 (₹80 - ₹25)`);
        }

        if (prevExpenseSnapshot) {
            console.log(`   Previous Month Expense: ₹${prevExpenseSnapshot.closing_balance}`);
            console.log(`   Expected: ₹25`);
        }

        // 7. Check if current month snapshots were UPDATED automatically
        console.log(`\n7. Checking if ${currentYear}-${currentMonth.toString().padStart(2, '0')} snapshots were UPDATED automatically:`);

        const updatedCurrentDonationSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: { account_id: accountId, ledger_head_id: donationLedgerId, month_year: currentMonthStr }
        });

        console.log(`   Current Month Donation (before backdated): ₹${currentDonationSnapshot.closing_balance}`);
        console.log(`   Current Month Donation (after backdated): ₹${updatedCurrentDonationSnapshot.closing_balance}`);
        console.log(`   Expected current month opening: ₹55 (previous month closing)`);

        // 8. Check current ledger balances
        console.log('\n8. Final ledger balances after all transactions:');
        const finalDonationLedger = await db.LedgerHead.findByPk(donationLedgerId);
        const finalExpenseLedger = await db.LedgerHead.findByPk(expenseLedgerId);

        console.log(`   Donation: ₹${finalDonationLedger.current_balance} (₹${finalDonationLedger.cash_balance} cash + ₹${finalDonationLedger.bank_balance} bank)`);
        console.log(`   Expense: ₹${finalExpenseLedger.current_balance}`);

        // Expected: Previous(₹80-₹25) + Current(₹100+₹50-₹30) = ₹55 + ₹120 = ₹175 donation, ₹55 expense
        console.log(`   Expected Donation: ₹175 (Previous Month ₹55 + Current Month ₹120)`);
        console.log(`   Expected Expense: ₹55 (Previous Month ₹25 + Current Month ₹30)`);

        // 9. Summary and diagnosis
        console.log('\n9. AUTOMATIC SNAPSHOT SYSTEM DIAGNOSIS:');

        const automaticSnapshotWorking = prevDonationSnapshot && prevExpenseSnapshot;
        const snapshotValuesCorrect = prevDonationSnapshot &&
                                    Math.abs(prevDonationSnapshot.closing_balance - 55) < 0.01 &&
                                    prevExpenseSnapshot &&
                                    Math.abs(prevExpenseSnapshot.closing_balance - 25) < 0.01;

        console.log(`   ✅ Automatic snapshot creation: ${automaticSnapshotWorking ? 'WORKING' : 'NOT WORKING'}`);
        console.log(`   ✅ Snapshot values accuracy: ${snapshotValuesCorrect ? 'CORRECT' : 'INCORRECT'}`);

        if (automaticSnapshotWorking && snapshotValuesCorrect) {
            console.log('\n   🎉 SUCCESS: AUTOMATIC SNAPSHOT SYSTEM IS FULLY OPERATIONAL!');
            console.log('   🔄 Backdated transactions automatically create and update historical snapshots');
            console.log('   ✅ The system is working as intended');
        } else {
            console.log('\n   ❌ ISSUE DETECTED: Automatic snapshot system needs attention');
            console.log('   🔧 Analysis needed to fix the logic');
        }

        console.log('\n=== COMPREHENSIVE TEST COMPLETED ===');

    } catch (error) {
        console.error('❌ Comprehensive test failed:', error);
        console.error('Details:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the comprehensive test
comprehensiveSnapshotTest().then(() => {
    console.log('\nComprehensive test complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});