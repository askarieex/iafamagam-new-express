/**
 * Simple focused test to demonstrate automatic snapshot updates
 * This test creates transactions in the correct order and verifies automatic updates
 */

const db = require('./models');
const immutableTransactionService = require('./services/immutableTransactionService');

async function simpleAutomaticSnapshotTest() {
    try {
        console.log('=== SIMPLE AUTOMATIC SNAPSHOT TEST ===\n');

        const accountId = 25;
        const donationLedgerId = 108; // Credit ledger
        const expenseLedgerId = 109;  // Debit ledger

        const userContext = {
            userId: 1,
            ipAddress: '127.0.0.1',
            userAgent: 'Simple Test',
            sessionId: 'simple-test'
        };

        // Step 1: Create current month donation
        console.log('1. Creating current month donation (₹100):');
        const todayStr = new Date().toISOString().split('T')[0];

        const currentDonation = await immutableTransactionService.createCreditTransaction({
            account_id: accountId,
            ledger_head_id: donationLedgerId,
            amount: 100,
            cash_amount: 60,
            bank_amount: 40,
            cash_type: 'both',
            transaction_date: todayStr,
            description: 'Current month donation'
        }, userContext);
        console.log(`   ✅ Created current month donation: ${currentDonation.transaction.uuid}`);

        // Wait for any background processes
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 2: Check current balances
        console.log('\n2. Current ledger balances:');
        const donationLedger = await db.LedgerHead.findByPk(donationLedgerId);
        console.log(`   Donation: ₹${donationLedger.current_balance} (₹${donationLedger.cash_balance} cash + ₹${donationLedger.bank_balance} bank)`);

        // Step 3: Create backdated donation (this should trigger automatic snapshot creation)
        console.log('\n3. Creating BACKDATED donation (15 days ago):');
        const backdatedDate = new Date();
        backdatedDate.setDate(backdatedDate.getDate() - 15);
        const backdatedDateStr = backdatedDate.toISOString().split('T')[0];

        console.log(`   Creating ₹80 backdated donation on ${backdatedDateStr}`);
        console.log('   🔄 This should automatically create/update historical snapshots...');

        const backdatedDonation = await immutableTransactionService.createCreditTransaction({
            account_id: accountId,
            ledger_head_id: donationLedgerId,
            amount: 80,
            cash_amount: 50,
            bank_amount: 30,
            cash_type: 'both',
            transaction_date: backdatedDateStr,
            description: 'Backdated donation - automatic snapshot test'
        }, userContext);
        console.log(`   ✅ Created backdated donation: ${backdatedDonation.transaction.uuid}`);

        // Step 4: Wait for automatic snapshot processing
        console.log('\n4. Waiting for automatic snapshot updates to complete...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Step 5: Check if snapshots were created automatically
        console.log('\n5. Checking for automatically created snapshots:');

        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const backdatedMonth = backdatedDate.getMonth() + 1;
        const backdatedYear = backdatedDate.getFullYear();

        // Check if backdated month snapshot was created
        const backdatedMonthStr = `${backdatedYear}-${backdatedMonth.toString().padStart(2, '0')}-01`;
        const backdatedSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: { account_id: accountId, ledger_head_id: donationLedgerId, month_year: backdatedMonthStr }
        });

        console.log(`   Backdated month (${backdatedYear}-${backdatedMonth.toString().padStart(2, '0')}) snapshot: ${backdatedSnapshot ? '✅ CREATED AUTOMATICALLY' : '❌ NOT CREATED'}`);

        if (backdatedSnapshot) {
            console.log(`   Snapshot balance: ₹${backdatedSnapshot.closing_balance} (₹${backdatedSnapshot.cash_amount} cash + ₹${backdatedSnapshot.bank_amount} bank)`);
        }

        // Check if current month snapshot exists or was updated
        const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
        const currentSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: { account_id: accountId, ledger_head_id: donationLedgerId, month_year: currentMonthStr }
        });

        console.log(`   Current month (${currentYear}-${currentMonth.toString().padStart(2, '0')}) snapshot: ${currentSnapshot ? '✅ EXISTS' : '❌ NOT FOUND'}`);

        if (currentSnapshot) {
            console.log(`   Current snapshot balance: ₹${currentSnapshot.closing_balance}`);
        }

        // Step 6: Check final ledger balances
        console.log('\n6. Final ledger balances:');
        const finalDonationLedger = await db.LedgerHead.findByPk(donationLedgerId);
        console.log(`   Donation: ₹${finalDonationLedger.current_balance} (₹${finalDonationLedger.cash_balance} cash + ₹${finalDonationLedger.bank_balance} bank)`);
        console.log(`   Expected: ₹180 (₹100 current + ₹80 backdated)`);

        // Step 7: Verify automatic snapshot system
        console.log('\n7. AUTOMATIC SNAPSHOT SYSTEM VERIFICATION:');

        const snapshotCreated = backdatedSnapshot !== null;
        const balanceCorrect = finalDonationLedger.current_balance == 180;

        console.log(`   ✅ Automatic snapshot creation: ${snapshotCreated ? 'WORKING ✓' : 'NOT WORKING ✗'}`);
        console.log(`   ✅ Balance calculation: ${balanceCorrect ? 'CORRECT ✓' : 'INCORRECT ✗'}`);

        if (snapshotCreated && balanceCorrect) {
            console.log('\n   🎉 SUCCESS: AUTOMATIC SNAPSHOT SYSTEM IS WORKING!');
            console.log('   🔄 Backdated transactions automatically create historical snapshots');
            console.log('   ✅ The system is operating in real-time mode');
            console.log('   ✅ No manual intervention required');
        } else {
            console.log('\n   ⚠️  DIAGNOSTIC REQUIRED: System needs analysis');
            if (!snapshotCreated) {
                console.log('   📋 Issue: Automatic snapshot creation not working');
            }
            if (!balanceCorrect) {
                console.log('   📋 Issue: Balance calculation incorrect');
            }
        }

        console.log('\n=== SIMPLE AUTOMATIC SNAPSHOT TEST COMPLETED ===');

    } catch (error) {
        console.error('❌ Simple test failed:', error);
        console.error('Details:', error.message);
    }
}

// Run the simple test
simpleAutomaticSnapshotTest().then(() => {
    console.log('\nSimple test complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Simple test error:', error);
    process.exit(1);
});