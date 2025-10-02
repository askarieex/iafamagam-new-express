/**
 * Fix the August expense transaction to include proper source_ledger_head_id
 */

const db = require('./models');
const immutableTransactionService = require('./services/immutableTransactionService');

async function fixAugustSourceLedger() {
    try {
        console.log('=== FIXING AUGUST SOURCE LEDGER LINKAGE ===\n');

        const accountId = 25;
        const donationLedgerId = 100; // Credit ledger (source)
        const expenseLedgerId = 101;   // Debit ledger (expense)

        // 1. First, let's check the current problematic transaction
        console.log('1. Finding the problematic August expense transaction:');
        const problemTransaction = await db.TransactionLog.findOne({
            where: {
                account_id: accountId,
                tx_type: 'debit',
                transaction_date: {
                    [db.Sequelize.Op.between]: ['2025-08-01', '2025-08-31']
                }
            }
        });

        if (problemTransaction) {
            console.log(`   Found transaction: ${problemTransaction.transaction_uuid}`);
            console.log(`   Amount: ₹${problemTransaction.amount}`);
            console.log(`   Source ledger: ${problemTransaction.source_ledger_head_id || 'NOT SET (this is the issue!)'}`);
        }

        // 2. Delete the existing problematic transaction
        console.log('\n2. Removing the problematic transaction...');
        if (problemTransaction) {
            await db.TransactionLog.destroy({
                where: {
                    transaction_uuid: problemTransaction.transaction_uuid
                }
            });
            console.log('   ✅ Removed problematic transaction');
        }

        // 3. Create a new correct debit transaction with source_ledger_head_id
        console.log('\n3. Creating corrected expense transaction with proper source linkage...');
        const correctedTransaction = await immutableTransactionService.createDebitTransaction({
            account_id: accountId,
            ledger_head_id: expenseLedgerId,
            source_ledger_head_id: donationLedgerId, // THIS IS THE KEY FIX!
            amount: 25,
            cash_amount: 15,
            bank_amount: 10,
            cash_type: 'both',
            transaction_date: '2025-08-30',
            description: 'August expense from donation funds (corrected with source)'
        }, {
            userId: 1,
            ipAddress: '127.0.0.1'
        });

        console.log(`   ✅ Created corrected transaction: ${correctedTransaction.transaction.uuid}`);

        // 4. Wait for async processing
        console.log('\n4. Waiting for snapshot updates...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 5. Verify the fix
        console.log('\n5. Verifying the fix:');
        const correctedDonationBalance = await immutableTransactionService.calculateCurrentBalance(
            accountId,
            donationLedgerId,
            '2025-08-31'
        );

        console.log(`   Donation balance after fix: ₹${correctedDonationBalance}`);
        console.log(`   Expected: ₹55 (₹80 - ₹25)`);
        console.log(`   ✅ ${correctedDonationBalance == 55 ? 'CORRECT!' : 'Still wrong - needs more investigation'}`);

        // 6. Check updated snapshot
        console.log('\n6. Checking updated August snapshot:');
        const updatedSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: {
                account_id: accountId,
                ledger_head_id: donationLedgerId,
                month_year: '2025-08-01'
            }
        });

        if (updatedSnapshot) {
            console.log(`   August donation snapshot: ₹${updatedSnapshot.closing_balance}`);
            console.log(`   Expected: ₹55`);
            console.log(`   ✅ ${updatedSnapshot.closing_balance == 55 ? 'SNAPSHOT FIXED!' : 'Snapshot still needs updating'}`);
        }

        console.log('\n=== SOURCE LEDGER FIX COMPLETED ===');

    } catch (error) {
        console.error('❌ Fix failed:', error);
        console.error('Details:', error.message);
    }
}

// Run the fix
fixAugustSourceLedger().then(() => {
    console.log('\nFix complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Fix error:', error);
    process.exit(1);
});