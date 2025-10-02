/**
 * Fix the incorrect salary transaction
 * The ₹30 debit should be FROM Donation ledger (89), not TO Salary ledger (90)
 */

const db = require('./models');
const monthlySnapshotService = require('./services/monthlySnapshotService');

async function fixSalaryTransaction() {
    try {
        console.log('=== FIXING SALARY TRANSACTION ===\n');

        const accountId = 25;

        // 1. Find the incorrect transaction
        console.log('1. Finding the incorrect ₹30 debit transaction...');
        const incorrectTransaction = await db.TransactionLog.findOne({
            where: {
                account_id: accountId,
                amount: 30,
                tx_type: 'debit',
                ledger_head_id: 90 // Salary ledger
            }
        });

        if (!incorrectTransaction) {
            console.log('❌ Transaction not found');
            return;
        }

        console.log('Found transaction:');
        console.log(`   UUID: ${incorrectTransaction.transaction_uuid}`);
        console.log(`   Date: ${incorrectTransaction.transaction_date}`);
        console.log(`   Amount: ₹${incorrectTransaction.amount}`);
        console.log(`   Current Ledger: ${incorrectTransaction.ledger_head_id} (Salary)`);

        // 2. Update the transaction to debit from Donation instead
        console.log('\n2. Correcting the transaction...');
        await incorrectTransaction.update({
            ledger_head_id: 89, // Change to Donation ledger
            description: 'Salary payment from donation funds',
            correction_reason: 'Fixed: Changed from crediting salary to debiting donation'
        });

        console.log('✅ Transaction corrected:');
        console.log(`   New Ledger: 89 (Donation)`);
        console.log(`   Type: debit (reduces donation balance)`);

        // 3. Regenerate snapshots for both August
        console.log('\n3. Regenerating snapshots...');

        // Delete the incorrect Salary snapshot
        await db.MonthlyBalanceSummary.destroy({
            where: {
                account_id: accountId,
                ledger_head_id: 90, // Salary
                month_year: '2025-08-01'
            }
        });
        console.log('✅ Removed incorrect Salary snapshot');

        // Regenerate Donation snapshot (will now include the debit)
        await monthlySnapshotService.createMonthlySnapshot(accountId, 89, 2025, 8);
        console.log('✅ Regenerated Donation snapshot');

        // 4. Check final balances
        console.log('\n4. Final balance verification:');

        const donationSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: {
                account_id: accountId,
                ledger_head_id: 89,
                month_year: '2025-08-01'
            }
        });

        if (donationSnapshot) {
            console.log(`Donation Ledger:`);
            console.log(`   Credits: ₹${donationSnapshot.total_credits}`);
            console.log(`   Debits: ₹${donationSnapshot.total_debits}`);
            console.log(`   Balance: ₹${donationSnapshot.closing_balance}`);
            console.log(`   Expected: ₹${60 - 30} = ₹30`);
        }

        // Check if there are any salary snapshots left
        const salarySnapshots = await db.MonthlyBalanceSummary.findAll({
            where: {
                account_id: accountId,
                ledger_head_id: 90,
                month_year: '2025-08-01'
            }
        });

        console.log(`Salary snapshots remaining: ${salarySnapshots.length} (should be 0)`);

        console.log('\n=== FIX COMPLETED ===');

    } catch (error) {
        console.error('❌ Error during fix:', error);
    }
}

// Run the fix
fixSalaryTransaction().then(() => {
    console.log('\nFix complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Fix failed:', error);
    process.exit(1);
});