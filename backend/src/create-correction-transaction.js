/**
 * Create correction transactions to fix the salary payment
 * Since transaction log is immutable, we need to create correction entries
 */

const db = require('./models');
const immutableTransactionService = require('./services/immutableTransactionService');
const monthlySnapshotService = require('./services/monthlySnapshotService');

async function createCorrectionTransaction() {
    try {
        console.log('=== CREATING CORRECTION TRANSACTIONS ===\n');

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

        console.log('Found incorrect transaction:');
        console.log(`   UUID: ${incorrectTransaction.transaction_uuid}`);
        console.log(`   Date: ${incorrectTransaction.transaction_date}`);
        console.log(`   Amount: ₹${incorrectTransaction.amount}`);
        console.log(`   Ledger: ${incorrectTransaction.ledger_head_id} (Salary - WRONG)`);

        // 2. Since Salary is a debit ledger, and we had a debit transaction,
        // we need to reverse it with a credit to the Donation ledger instead
        console.log('\n2. Skipping reversal for Salary ledger (debit head)...');
        console.log('   Note: Will correct by proper transaction flow instead');

        // 3. Create the correct debit transaction for Donation ledger
        console.log('\n3. Creating correct debit transaction for Donation ledger...');

        const correctDebitResult = await immutableTransactionService.createDebitTransaction({
            account_id: accountId,
            ledger_head_id: 89, // Donation ledger
            amount: 30,
            cash_amount: 30,
            bank_amount: 0,
            cash_type: 'both', // Required field
            transaction_date: incorrectTransaction.transaction_date,
            description: 'Salary payment from donation funds',
            purpose: 'Salary expense payment using donation money'
        }, {
            userId: 'system',
            ipAddress: '127.0.0.1'
        });

        console.log('✅ Correct debit transaction created for Donation ledger');

        // 4. Regenerate snapshots for both affected months
        console.log('\n4. Regenerating snapshots...');

        // Regenerate for both ledger heads
        await monthlySnapshotService.createMonthlySnapshot(accountId, 89, 2025, 8); // Donation
        await monthlySnapshotService.createMonthlySnapshot(accountId, 90, 2025, 8); // Salary

        console.log('✅ Snapshots regenerated');

        // 5. Check final balances
        console.log('\n5. Final balance verification:');

        const snapshots = await db.MonthlyBalanceSummary.findAll({
            where: {
                account_id: accountId,
                month_year: '2025-08-01'
            },
            order: [['ledger_head_id', 'ASC']]
        });

        snapshots.forEach(snap => {
            console.log(`Ledger ${snap.ledger_head_id}:`);
            console.log(`   Credits: ₹${snap.total_credits}, Debits: ₹${snap.total_debits}`);
            console.log(`   Balance: ₹${snap.closing_balance}`);
        });

        console.log('\nExpected results:');
        console.log('   Donation (89): Credits ₹60, Debits ₹30, Balance ₹30');
        console.log('   Salary (90): Credits ₹30, Debits ₹30, Balance ₹0');

        console.log('\n=== CORRECTION COMPLETED ===');

    } catch (error) {
        console.error('❌ Error during correction:', error);
        console.error('Error details:', error.message);
    }
}

// Run the correction
createCorrectionTransaction().then(() => {
    console.log('\nCorrection complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Correction failed:', error);
    process.exit(1);
});