/**
 * Test script to verify backdated transaction snapshot updating is working
 */

const db = require('./models');
const immutableTransactionService = require('./services/immutableTransactionService');

async function testBackdatedTransaction() {
    try {
        console.log('=== TESTING BACKDATED TRANSACTION SYSTEM ===\n');

        const accountId = 25;
        const donationLedgerId = 91; // Based on current data

        // 1. Check current state
        console.log('1. Current state before test:');
        const beforeSnapshots = await db.MonthlyBalanceSummary.findAll({
            where: { account_id: accountId },
            include: [{ model: db.LedgerHead, as: 'ledgerHead', attributes: ['name', 'head_type'] }],
            order: [['month_year', 'ASC']]
        });

        beforeSnapshots.forEach(s => {
            console.log(`   ${s.month_year} | ${s.ledgerHead.name}: ₹${s.closing_balance}`);
        });

        // 2. Create a backdated transaction (15 days ago - within 30-day limit)
        const backdateDate = new Date();
        backdateDate.setDate(backdateDate.getDate() - 15);
        const backdatedDateStr = backdateDate.toISOString().split('T')[0];

        console.log(`\n2. Creating backdated transaction for ${backdatedDateStr} (15 days ago)...`);

        const backdatedTransaction = await immutableTransactionService.createCreditTransaction({
            account_id: accountId,
            ledger_head_id: donationLedgerId,
            amount: 25,
            cash_amount: 15,
            bank_amount: 10,
            cash_type: 'both',
            transaction_date: backdatedDateStr,
            description: 'Backdated test donation (15 days ago)'
        }, {
            userId: 1, // Integer user ID
            ipAddress: '127.0.0.1'
        });

        console.log(`✅ Backdated transaction created: ${backdatedTransaction.transaction.uuid}`);

        // 3. Wait a moment for async processing
        console.log('\n3. Waiting for background snapshot updates...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 4. Check if snapshots were updated
        console.log('\n4. Checking snapshot updates after backdated transaction:');
        const afterSnapshots = await db.MonthlyBalanceSummary.findAll({
            where: { account_id: accountId },
            include: [{ model: db.LedgerHead, as: 'ledgerHead', attributes: ['name', 'head_type'] }],
            order: [['month_year', 'ASC']]
        });

        console.log('Updated snapshots:');
        afterSnapshots.forEach(s => {
            console.log(`   ${s.month_year} | ${s.ledgerHead.name}: ₹${s.closing_balance}`);
        });

        // 5. Verify backdated month snapshot was created/updated
        const backdatedMonth = `${backdateDate.getFullYear()}-${(backdateDate.getMonth() + 1).toString().padStart(2, '0')}-01`;
        const backdatedSnapshot = afterSnapshots.find(s =>
            s.month_year === backdatedMonth && s.ledger_head_id === donationLedgerId
        );

        if (backdatedSnapshot) {
            console.log(`\n✅ SUCCESS: ${backdatedMonth} snapshot created/updated!`);
            console.log(`   Balance: ₹${backdatedSnapshot.closing_balance}`);
            console.log(`   Should include the ₹25 backdated transaction`);
        } else {
            console.log(`\n❌ FAILURE: ${backdatedMonth} snapshot was not created`);
        }

        // 6. Check if current month was updated too
        const currentMonthSnapshot = afterSnapshots.find(s =>
            s.month_year === '2025-09-01' && s.ledger_head_id === donationLedgerId
        );

        if (currentMonthSnapshot) {
            console.log(`\n🔄 Current month balance: ₹${currentMonthSnapshot.closing_balance}`);
            console.log(`   Should reflect backdated transaction in opening balance`);
        }

        console.log('\n=== TEST COMPLETED ===');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Details:', error.message);
    }
}

// Run the test
testBackdatedTransaction().then(() => {
    console.log('\nTest complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});