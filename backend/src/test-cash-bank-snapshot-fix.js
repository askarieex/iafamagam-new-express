/**
 * Test the fixed snapshot cash/bank calculation with our clean data
 */

const db = require('./models');
const monthlySnapshotService = require('./services/monthlySnapshotService');

async function testCashBankSnapshotFix() {
    try {
        console.log('=== TESTING FIXED CASH/BANK SNAPSHOT CALCULATION ===\n');

        const accountId = 25;
        const donationLedgerId = 106; // From our clean test data

        // 1. Regenerate September snapshot with fixed logic
        console.log('1. Regenerating September snapshot with fixed cash/bank logic...');

        // Delete existing snapshot
        await db.MonthlyBalanceSummary.destroy({
            where: {
                account_id: accountId,
                ledger_head_id: donationLedgerId,
                month_year: '2025-09-01'
            }
        });

        // Regenerate with fixed logic
        await monthlySnapshotService.createMonthlySnapshot(accountId, donationLedgerId, 2025, 9);
        console.log('   ✅ Snapshot regenerated');

        // 2. Check the corrected snapshot
        console.log('\n2. Checking corrected September snapshot:');
        const correctedSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: {
                account_id: accountId,
                ledger_head_id: donationLedgerId,
                month_year: '2025-09-01'
            }
        });

        if (correctedSnapshot) {
            console.log(`   Total: ₹${correctedSnapshot.closing_balance}`);
            console.log(`   Cash: ₹${correctedSnapshot.cash_amount}`);
            console.log(`   Bank: ₹${correctedSnapshot.bank_amount}`);

            // Manual calculation verification:
            // Sept 29: +₹100 (₹60 cash + ₹40 bank)
            // Sept 30: -₹30 (₹20 cash + ₹10 bank)
            // Sept 15: +₹80 (₹50 cash + ₹30 bank)
            // Sept 16: -₹25 (₹15 cash + ₹10 bank)
            // Total: ₹100 - ₹30 + ₹80 - ₹25 = ₹125
            // Cash: ₹60 - ₹20 + ₹50 - ₹15 = ₹75
            // Bank: ₹40 - ₹10 + ₹30 - ₹10 = ₹50

            console.log(`\n   Expected: Total ₹125, Cash ₹75, Bank ₹50`);

            const totalCorrect = correctedSnapshot.closing_balance == 125;
            const cashCorrect = correctedSnapshot.cash_amount == 75;
            const bankCorrect = correctedSnapshot.bank_amount == 50;

            console.log(`   ✅ Total: ${totalCorrect ? 'CORRECT' : 'INCORRECT'}`);
            console.log(`   ✅ Cash: ${cashCorrect ? 'CORRECT' : 'INCORRECT'}`);
            console.log(`   ✅ Bank: ${bankCorrect ? 'CORRECT' : 'INCORRECT'}`);

            if (totalCorrect && cashCorrect && bankCorrect) {
                console.log('\n🎉 ALL CASH/BANK CALCULATIONS ARE NOW CORRECT!');
            } else {
                console.log('\n❌ Some calculations are still incorrect');
            }
        }

        // 3. Show transaction breakdown for verification
        console.log('\n3. Transaction breakdown for verification:');

        // Direct transactions to donation ledger
        const directTxs = await db.TransactionLog.findAll({
            where: {
                account_id: accountId,
                ledger_head_id: donationLedgerId
            },
            order: [['transaction_date', 'ASC']]
        });

        console.log('   Direct transactions to Donation ledger:');
        directTxs.forEach(tx => {
            console.log(`     ${tx.transaction_date} | ${tx.tx_type} | ₹${tx.amount} (₹${tx.cash_amount} cash + ₹${tx.bank_amount} bank)`);
        });

        // Source deductions from donation ledger
        const sourceTxs = await db.TransactionLog.findAll({
            where: {
                account_id: accountId,
                source_ledger_head_id: donationLedgerId,
                tx_type: 'debit'
            },
            order: [['transaction_date', 'ASC']]
        });

        console.log('\n   Source deductions FROM Donation ledger:');
        sourceTxs.forEach(tx => {
            console.log(`     ${tx.transaction_date} | debit | -₹${tx.amount} (-₹${tx.cash_amount} cash + -₹${tx.bank_amount} bank)`);
        });

        console.log('\n=== CASH/BANK SNAPSHOT FIX TEST COMPLETED ===');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Details:', error.message);
    }
}

// Run the test
testCashBankSnapshotFix().then(() => {
    console.log('\nTest complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});