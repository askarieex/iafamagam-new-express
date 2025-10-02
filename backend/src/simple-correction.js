/**
 * Simple correction approach:
 * 1. Delete the incorrect Salary snapshot (since salary payments shouldn't create balance)
 * 2. Create correct debit transaction to Donation
 * 3. Regenerate Donation snapshot
 */

const db = require('./models');
const immutableTransactionService = require('./services/immutableTransactionService');
const monthlySnapshotService = require('./services/monthlySnapshotService');

async function simpleCorrection() {
    try {
        console.log('=== SIMPLE CORRECTION APPROACH ===\n');

        const accountId = 25;

        // 1. Delete the incorrect Salary snapshot
        console.log('1. Removing incorrect Salary snapshot...');
        const deletedSnapshots = await db.MonthlyBalanceSummary.destroy({
            where: {
                account_id: accountId,
                ledger_head_id: 90, // Salary
                month_year: '2025-08-01'
            }
        });
        console.log(`✅ Deleted ${deletedSnapshots} Salary snapshot(s)`);

        // 2. Create the correct debit transaction for Donation ledger
        console.log('\n2. Creating correct debit transaction for Donation ledger...');

        const correctDebitResult = await immutableTransactionService.createDebitTransaction({
            account_id: accountId,
            ledger_head_id: 89, // Donation ledger
            amount: 30,
            cash_amount: 30,
            bank_amount: 0,
            cash_type: 'both',
            transaction_date: '2025-08-30',
            description: 'Salary payment from donation funds',
            purpose: 'Staff salary expense using donation money'
        }, {
            userId: 'system',
            ipAddress: '127.0.0.1'
        });

        console.log('✅ Correct debit transaction created for Donation ledger');

        // 3. Regenerate Donation snapshot
        console.log('\n3. Regenerating Donation snapshot...');
        await monthlySnapshotService.createMonthlySnapshot(accountId, 89, 2025, 8);
        console.log('✅ Donation snapshot regenerated');

        // 4. Check final results
        console.log('\n4. Final verification:');

        const finalSnapshots = await db.MonthlyBalanceSummary.findAll({
            where: {
                account_id: accountId,
                month_year: '2025-08-01'
            },
            order: [['ledger_head_id', 'ASC']]
        });

        console.log(`Found ${finalSnapshots.length} August snapshots:`);
        finalSnapshots.forEach(snap => {
            console.log(`   Ledger ${snap.ledger_head_id}:`);
            console.log(`     Credits: ₹${snap.total_credits}, Debits: ₹${snap.total_debits}`);
            console.log(`     Balance: ₹${snap.closing_balance}`);
        });

        // Check the Donation transactions
        console.log('\n5. Donation ledger transactions:');
        const donationTxs = await db.TransactionLog.findAll({
            where: {
                account_id: accountId,
                ledger_head_id: 89,
                transaction_date: {
                    [db.Sequelize.Op.between]: ['2025-08-01', '2025-08-31']
                }
            },
            order: [['transaction_date', 'ASC']]
        });

        donationTxs.forEach(tx => {
            console.log(`   ${tx.transaction_date}: ${tx.tx_type} ₹${tx.amount} - ${tx.description}`);
        });

        console.log('\nExpected final result:');
        console.log('   Donation: Credits ₹60, Debits ₹30, Balance ₹30');

        console.log('\n=== CORRECTION COMPLETED ===');

    } catch (error) {
        console.error('❌ Error during correction:', error);
        console.error('Error details:', error.message);
    }
}

// Run the correction
simpleCorrection().then(() => {
    console.log('\nCorrection complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Correction failed:', error);
    process.exit(1);
});