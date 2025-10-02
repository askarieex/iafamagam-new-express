/**
 * Regenerate August snapshots with corrected balance calculation logic
 */

const db = require('./models');
const monthlySnapshotService = require('./services/monthlySnapshotService');

async function regenerateAugustSnapshots() {
    try {
        console.log('=== REGENERATING AUGUST SNAPSHOTS WITH CORRECTED LOGIC ===\n');

        const accountId = 25;
        const year = 2025;
        const month = 8;

        // 1. Delete existing August snapshots
        console.log('1. Removing existing August snapshots...');
        const deletedCount = await db.MonthlyBalanceSummary.destroy({
            where: {
                account_id: accountId,
                month_year: '2025-08-01'
            }
        });
        console.log(`   ✅ Removed ${deletedCount} existing snapshots`);

        // 2. Get all ledger heads for this account
        console.log('\n2. Finding all ledger heads to regenerate...');
        const ledgerHeads = await db.LedgerHead.findAll({
            where: { account_id: accountId },
            attributes: ['id', 'name', 'head_type']
        });

        console.log(`   Found ${ledgerHeads.length} ledger heads:`);
        ledgerHeads.forEach(ledger => {
            console.log(`   - ${ledger.name} (${ledger.head_type}, ID: ${ledger.id})`);
        });

        // 3. Regenerate snapshots for each ledger head
        console.log('\n3. Regenerating snapshots with corrected balance logic...');
        for (const ledgerHead of ledgerHeads) {
            console.log(`\n   Processing ${ledgerHead.name}...`);

            const snapshot = await monthlySnapshotService.calculateMonthlyBalances(
                accountId,
                ledgerHead.id,
                year,
                month
            );

            // Create the snapshot
            await monthlySnapshotService.createMonthlySnapshot(
                accountId,
                ledgerHead.id,
                year,
                month
            );

            console.log(`   ✅ ${ledgerHead.name}: Opening ₹${snapshot.openingBalance}, Closing ₹${snapshot.closingBalance}`);
        }

        // 4. Verify the corrected snapshots
        console.log('\n4. Verifying corrected August snapshots:');
        const correctedSnapshots = await db.MonthlyBalanceSummary.findAll({
            where: {
                account_id: accountId,
                month_year: '2025-08-01'
            },
            include: [{
                model: db.LedgerHead,
                as: 'ledgerHead',
                attributes: ['name', 'head_type']
            }],
            order: [['ledger_head_id', 'ASC']]
        });

        correctedSnapshots.forEach(snapshot => {
            console.log(`   ${snapshot.ledgerHead.name} (${snapshot.ledgerHead.head_type}): ₹${snapshot.closing_balance}`);
            console.log(`      Credits: ₹${snapshot.total_credits}, Debits: ₹${snapshot.total_debits}`);
            console.log(`      Cash: ₹${snapshot.cash_amount}, Bank: ₹${snapshot.bank_amount}`);
        });

        // 5. Show expected vs actual for donation
        console.log('\n5. Final verification for Donation ledger:');
        const donationSnapshot = correctedSnapshots.find(s => s.ledgerHead.name === 'Donation');
        if (donationSnapshot) {
            console.log(`   Expected: ₹55 (₹80 donation - ₹25 expense)`);
            console.log(`   Actual: ₹${donationSnapshot.closing_balance}`);
            console.log(`   ✅ ${donationSnapshot.closing_balance == 55 ? 'CORRECT!' : 'Still incorrect'}`);
        }

        console.log('\n=== SNAPSHOT REGENERATION COMPLETED ===');

    } catch (error) {
        console.error('❌ Regeneration failed:', error);
        console.error('Details:', error.message);
    }
}

// Run the regeneration
regenerateAugustSnapshots().then(() => {
    console.log('\nRegeneration complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Regeneration error:', error);
    process.exit(1);
});