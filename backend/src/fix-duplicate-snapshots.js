/**
 * Script to clean up duplicate snapshot entries and fix the snapshot logic
 */

const db = require('./models');

async function cleanupDuplicateSnapshots() {
    try {
        console.log('=== CLEANING UP DUPLICATE SNAPSHOTS ===\n');

        // First, let's see all duplicates
        console.log('1. Finding duplicate snapshot entries...');

        const duplicates = await db.sequelize.query(`
            SELECT
                ledger_head_id,
                account_id,
                month_year,
                COUNT(*) as count,
                ARRAY_AGG(id ORDER BY last_calculated_at DESC) as ids
            FROM monthly_balance_summaries
            WHERE account_id = 25
            GROUP BY ledger_head_id, account_id, month_year
            HAVING COUNT(*) > 1
            ORDER BY month_year, ledger_head_id
        `, { type: db.sequelize.QueryTypes.SELECT });

        console.log(`Found ${duplicates.length} sets of duplicates:`);
        duplicates.forEach(dup => {
            console.log(`  - Ledger ${dup.ledger_head_id}, Month ${dup.month_year}: ${dup.count} entries`);
            console.log(`    IDs: ${dup.ids}`);
        });

        // For each duplicate set, keep the most recently calculated one and delete the rest
        console.log('\n2. Removing duplicate entries...');

        for (const dup of duplicates) {
            const idsToDelete = dup.ids.slice(1); // Keep first (most recent), delete rest

            if (idsToDelete.length > 0) {
                console.log(`Deleting duplicate IDs for ledger ${dup.ledger_head_id}, month ${dup.month_year}: ${idsToDelete}`);

                await db.MonthlyBalanceSummary.destroy({
                    where: {
                        id: idsToDelete
                    }
                });
            }
        }

        // Now check if we have the ₹30 debit transaction that should be included
        console.log('\n3. Checking for missing debit transactions...');

        const augustDebits = await db.TransactionLog.findAll({
            where: {
                account_id: 25,
                transaction_date: {
                    [db.Sequelize.Op.between]: ['2025-08-01', '2025-08-31']
                },
                tx_type: 'debit'
            }
        });

        console.log(`Found ${augustDebits.length} debit transactions in August:`);
        augustDebits.forEach(tx => {
            console.log(`  - Date: ${tx.transaction_date}, Amount: ₹${tx.amount}, Ledger: ${tx.ledger_head_id}`);
        });

        // Regenerate all August snapshots to include the debit transaction
        console.log('\n4. Regenerating August snapshots with correct data...');

        const monthlySnapshotService = require('./services/monthlySnapshotService');

        // Get all ledger heads that have transactions in August
        const augustLedgerHeads = await db.sequelize.query(`
            SELECT DISTINCT ledger_head_id
            FROM transaction_log
            WHERE account_id = 25
            AND transaction_date BETWEEN '2025-08-01' AND '2025-08-31'
        `, { type: db.sequelize.QueryTypes.SELECT });

        for (const ledger of augustLedgerHeads) {
            console.log(`Regenerating snapshot for ledger ${ledger.ledger_head_id}...`);
            await monthlySnapshotService.createMonthlySnapshot(25, ledger.ledger_head_id, 2025, 8);
        }

        // Show final state
        console.log('\n5. Final snapshot state:');
        const finalSnapshots = await db.MonthlyBalanceSummary.findAll({
            where: {
                account_id: 25,
                month_year: '2025-08-01'
            },
            order: [['ledger_head_id', 'ASC']]
        });

        console.log(`Final August snapshots (${finalSnapshots.length} entries):`);
        finalSnapshots.forEach(snap => {
            console.log(`  - Ledger ${snap.ledger_head_id}: Balance ₹${snap.closing_balance}, Credits ₹${snap.total_credits}, Debits ₹${snap.total_debits}`);
        });

        console.log('\n=== CLEANUP COMPLETED ===');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

// Run the cleanup
cleanupDuplicateSnapshots().then(() => {
    console.log('\nCleanup complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Cleanup failed:', error);
    process.exit(1);
});