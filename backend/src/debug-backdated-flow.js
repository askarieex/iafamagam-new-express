/**
 * Debug script to test the complete backdated transaction flow
 */

const db = require('./models');
const monthlySnapshotService = require('./services/monthlySnapshotService');

async function testBackdatedFlow() {
    try {
        console.log('=== TESTING BACKDATED TRANSACTION FLOW ===\n');

        // Test account ID from previous context
        const accountId = 25;

        // Check what ledger heads exist for this account
        console.log('1. Checking existing ledger heads for account 25...');
        const ledgerHeads = await db.LedgerHead.findAll({
            where: {
                account_id: accountId,
                head_type: 'credit',
                is_active: true
            },
            attributes: ['id', 'name', 'head_type'],
            limit: 3
        });

        console.log(`Found ${ledgerHeads.length} credit heads:`);
        ledgerHeads.forEach(lh => {
            console.log(`  - ID: ${lh.id}, Name: ${lh.name}, Type: ${lh.head_type}`);
        });

        if (ledgerHeads.length === 0) {
            console.log('❌ No credit heads found for account 25');
            return;
        }

        const testLedgerHeadId = ledgerHeads[0].id;
        console.log(`\nUsing ledger head ID: ${testLedgerHeadId} (${ledgerHeads[0].name})`);

        // Check existing snapshots for August 2025
        console.log('\n2. Checking existing August 2025 snapshots...');
        const augustSnapshots = await db.MonthlyBalanceSummary.findAll({
            where: {
                account_id: accountId,
                ledger_head_id: testLedgerHeadId,
                month_year: '2025-08-01'
            }
        });

        console.log(`Found ${augustSnapshots.length} August 2025 snapshots for this ledger head`);
        if (augustSnapshots.length > 0) {
            augustSnapshots.forEach(snapshot => {
                console.log(`  - Closing Balance: ₹${snapshot.closing_balance}`);
                console.log(`  - Last Calculated: ${snapshot.last_calculated_at}`);
            });
        }

        // Check if there are any transactions for August 2025
        console.log('\n3. Checking transactions for August 2025...');
        const augustTransactions = await db.TransactionLog.findAll({
            where: {
                account_id: accountId,
                ledger_head_id: testLedgerHeadId,
                transaction_date: {
                    [db.Sequelize.Op.between]: ['2025-08-01', '2025-08-31']
                }
            },
            order: [['transaction_date', 'DESC']]
        });

        console.log(`Found ${augustTransactions.length} transactions in August 2025:`);
        augustTransactions.forEach(tx => {
            console.log(`  - Date: ${tx.transaction_date}, Amount: ₹${tx.amount}, Type: ${tx.tx_type}`);
            console.log(`    UUID: ${tx.transaction_uuid}`);
        });

        // Test the updateSnapshotsAfterTransaction method manually
        if (augustTransactions.length > 0) {
            console.log('\n4. Testing snapshot update for existing August transaction...');
            const testTransaction = augustTransactions[0];

            console.log(`Testing with transaction: ${testTransaction.transaction_uuid}`);
            console.log(`  Date: ${testTransaction.transaction_date}`);
            console.log(`  Amount: ₹${testTransaction.amount}`);

            // Simulate the updateSnapshotsAfterTransaction call
            await monthlySnapshotService.updateSnapshotsAfterTransaction(testTransaction);

            // Check if snapshot was updated
            console.log('\n5. Checking snapshot after update...');
            const updatedSnapshot = await db.MonthlyBalanceSummary.findOne({
                where: {
                    account_id: accountId,
                    ledger_head_id: testLedgerHeadId,
                    month_year: '2025-08-01'
                }
            });

            if (updatedSnapshot) {
                console.log(`✅ Snapshot updated successfully:`);
                console.log(`  - Closing Balance: ₹${updatedSnapshot.closing_balance}`);
                console.log(`  - Total Credits: ₹${updatedSnapshot.total_credits}`);
                console.log(`  - Transaction Count: ${updatedSnapshot.transaction_count}`);
                console.log(`  - Last Calculated: ${updatedSnapshot.last_calculated_at}`);
            } else {
                console.log('❌ No snapshot found after update');
            }
        } else {
            console.log('\n4. No August transactions found to test with');
        }

        console.log('\n=== TEST COMPLETED ===');

    } catch (error) {
        console.error('❌ Error during backdated flow test:', error);
    }
}

// Run the test
testBackdatedFlow().then(() => {
    console.log('\nTest complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});