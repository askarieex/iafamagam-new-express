/**
 * Test script to verify that the fixed upsert logic prevents duplicates
 */

const db = require('./models');
const monthlySnapshotService = require('./services/monthlySnapshotService');

async function testNoDuplicates() {
    try {
        console.log('=== TESTING DUPLICATE PREVENTION ===\n');

        const accountId = 25;
        const ledgerHeadId = 89; // Donation
        const year = 2025;
        const month = 8;

        console.log('1. Current snapshot count for August 2025, Ledger 89:');
        let currentCount = await db.MonthlyBalanceSummary.count({
            where: {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                month_year: '2025-08-01'
            }
        });
        console.log(`   Current count: ${currentCount}`);

        console.log('\n2. Running snapshot creation multiple times (should not create duplicates)...');

        // Try to create the same snapshot multiple times
        for (let i = 1; i <= 3; i++) {
            console.log(`   Attempt ${i}:`);
            await monthlySnapshotService.createMonthlySnapshot(accountId, ledgerHeadId, year, month);

            const newCount = await db.MonthlyBalanceSummary.count({
                where: {
                    account_id: accountId,
                    ledger_head_id: ledgerHeadId,
                    month_year: '2025-08-01'
                }
            });
            console.log(`   Count after attempt ${i}: ${newCount}`);
        }

        console.log('\n3. Final verification:');
        const finalSnapshots = await db.MonthlyBalanceSummary.findAll({
            where: {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                month_year: '2025-08-01'
            }
        });

        console.log(`   Final count: ${finalSnapshots.length} (should be 1)`);
        if (finalSnapshots.length === 1) {
            console.log('   ✅ SUCCESS: No duplicates created!');
            const snapshot = finalSnapshots[0];
            console.log(`   Snapshot details:`);
            console.log(`     - Closing Balance: ₹${snapshot.closing_balance}`);
            console.log(`     - Total Credits: ₹${snapshot.total_credits}`);
            console.log(`     - Total Debits: ₹${snapshot.total_debits}`);
            console.log(`     - Last Updated: ${snapshot.last_calculated_at}`);
        } else {
            console.log('   ❌ PROBLEM: Still creating duplicates!');
        }

        console.log('\n=== TEST COMPLETED ===');

    } catch (error) {
        console.error('❌ Error during test:', error);
    }
}

// Run the test
testNoDuplicates().then(() => {
    console.log('\nTest complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});