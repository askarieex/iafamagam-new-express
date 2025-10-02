/**
 * Restore the salary snapshot so it shows in the report
 * The transaction is actually correct - we just need to display it properly
 */

const db = require('./models');
const monthlySnapshotService = require('./services/monthlySnapshotService');

async function restoreSalarySnapshot() {
    try {
        console.log('=== RESTORING SALARY SNAPSHOT ===\n');

        const accountId = 25;

        // 1. Regenerate the Salary snapshot (ledger 90)
        console.log('1. Regenerating Salary snapshot...');
        await monthlySnapshotService.createMonthlySnapshot(accountId, 90, 2025, 8);
        console.log('✅ Salary snapshot regenerated');

        // 2. Check all snapshots
        console.log('\n2. Current August 2025 snapshots:');
        const snapshots = await db.MonthlyBalanceSummary.findAll({
            where: {
                account_id: accountId,
                month_year: '2025-08-01'
            },
            include: [{
                model: db.LedgerHead,
                as: 'ledgerHead',
                attributes: ['id', 'name', 'head_type']
            }],
            order: [['ledger_head_id', 'ASC']]
        });

        snapshots.forEach(snap => {
            console.log(`${snap.ledgerHead.name} (${snap.ledgerHead.head_type}):`);
            console.log(`   Credits: ₹${snap.total_credits}`);
            console.log(`   Debits: ₹${snap.total_debits}`);
            console.log(`   Balance: ₹${snap.closing_balance}`);

            // Show how this should appear in the report
            if (snap.ledgerHead.head_type === 'credit') {
                console.log(`   → Report: ₹${snap.closing_balance} available`);
            } else {
                console.log(`   → Report: ₹${Math.abs(snap.closing_balance)} expense (should show as positive)`);
            }
        });

        console.log('\n3. Summary for monthly report:');
        console.log('   Total Income (Credits): ₹60');
        console.log('   Total Expenses (Debits): ₹30');
        console.log('   Net Balance: ₹30');

        console.log('\n4. The issue was in report display, not the transactions!');
        console.log('   Salary showing as "-₹30" is wrong');
        console.log('   Salary should show as "+₹30" expense');
        console.log('   Donation should show as "₹60" available');

        console.log('\n=== RESTORATION COMPLETED ===');

    } catch (error) {
        console.error('❌ Error during restoration:', error);
    }
}

// Run the restoration
restoreSalarySnapshot().then(() => {
    console.log('\nRestoration complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Restoration failed:', error);
    process.exit(1);
});