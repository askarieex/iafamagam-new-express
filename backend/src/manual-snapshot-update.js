/**
 * Manually trigger snapshot updates and diagnose the real-time update issue
 */

const db = require('./models');
const monthlySnapshotService = require('./services/monthlySnapshotService');

async function manualSnapshotUpdate() {
    try {
        console.log('=== MANUAL SNAPSHOT UPDATE & DIAGNOSIS ===\n');

        const accountId = 25;
        const donationLedgerId = 108;
        const expenseLedgerId = 109;

        // 1. Check current September snapshot
        console.log('1. Current September snapshot (BEFORE update):');
        const beforeSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: {
                account_id: accountId,
                ledger_head_id: donationLedgerId,
                month_year: '2025-09-01'
            }
        });

        if (beforeSnapshot) {
            console.log(`   Donation: ₹${beforeSnapshot.closing_balance} (₹${beforeSnapshot.cash_amount} cash + ₹${beforeSnapshot.bank_amount} bank)`);
        }

        // 2. Calculate what September SHOULD be now with all transactions
        console.log('\n2. What September SHOULD be (including Sept 19 transaction):');

        // Manual calculation with all September transactions:
        // Sept 1: +₹80 donation (₹50 cash + ₹30 bank)
        // Sept 2: -₹25 expense (₹15 cash + ₹10 bank)
        // Sept 19: -₹20 expense (₹10 cash + ₹10 bank) <- NEW
        // Sept 29: +₹50 donation (₹30 cash + ₹20 bank)
        // Sept 30: -₹15 expense (₹10 cash + ₹5 bank)
        // Total: ₹80 - ₹25 - ₹20 + ₹50 - ₹15 = ₹70
        // Cash: ₹50 - ₹15 - ₹10 + ₹30 - ₹10 = ₹45
        // Bank: ₹30 - ₹10 - ₹10 + ₹20 - ₹5 = ₹25

        console.log('   Expected: ₹70 total (₹45 cash + ₹25 bank)');

        // 3. Delete and recreate September snapshot
        console.log('\n3. Regenerating September snapshot...');

        await db.MonthlyBalanceSummary.destroy({
            where: {
                account_id: accountId,
                ledger_head_id: donationLedgerId,
                month_year: '2025-09-01'
            }
        });

        await monthlySnapshotService.createMonthlySnapshot(accountId, donationLedgerId, 2025, 9);
        console.log('   ✅ Donation snapshot regenerated');

        await db.MonthlyBalanceSummary.destroy({
            where: {
                account_id: accountId,
                ledger_head_id: expenseLedgerId,
                month_year: '2025-09-01'
            }
        });

        await monthlySnapshotService.createMonthlySnapshot(accountId, expenseLedgerId, 2025, 9);
        console.log('   ✅ Expense snapshot regenerated');

        // 4. Check updated September snapshot
        console.log('\n4. Updated September snapshot (AFTER regeneration):');
        const afterSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: {
                account_id: accountId,
                ledger_head_id: donationLedgerId,
                month_year: '2025-09-01'
            }
        });

        if (afterSnapshot) {
            console.log(`   Donation: ₹${afterSnapshot.closing_balance} (₹${afterSnapshot.cash_amount} cash + ₹${afterSnapshot.bank_amount} bank)`);

            const totalCorrect = afterSnapshot.closing_balance == 70;
            const cashCorrect = afterSnapshot.cash_amount == 45;
            const bankCorrect = afterSnapshot.bank_amount == 25;

            console.log(`   ✅ Total: ${totalCorrect ? 'CORRECT' : 'INCORRECT'}`);
            console.log(`   ✅ Cash: ${cashCorrect ? 'CORRECT' : 'INCORRECT'}`);
            console.log(`   ✅ Bank: ${bankCorrect ? 'CORRECT' : 'INCORRECT'}`);
        }

        // 5. Also regenerate October snapshot to update opening balance
        console.log('\n5. Regenerating October snapshot...');

        await db.MonthlyBalanceSummary.destroy({
            where: {
                account_id: accountId,
                ledger_head_id: donationLedgerId,
                month_year: '2025-10-01'
            }
        });

        await monthlySnapshotService.createMonthlySnapshot(accountId, donationLedgerId, 2025, 10);
        console.log('   ✅ October donation snapshot regenerated');

        await db.MonthlyBalanceSummary.destroy({
            where: {
                account_id: accountId,
                ledger_head_id: expenseLedgerId,
                month_year: '2025-10-01'
            }
        });

        await monthlySnapshotService.createMonthlySnapshot(accountId, expenseLedgerId, 2025, 10);
        console.log('   ✅ October expense snapshot regenerated');

        // 6. Show all current transactions for verification
        console.log('\n6. All transactions for verification:');
        const allTransactions = await db.TransactionLog.findAll({
            where: { account_id: accountId },
            include: [{ model: db.LedgerHead, as: 'ledgerHead', attributes: ['name'] }],
            order: [['transaction_date', 'ASC'], ['log_id', 'ASC']]
        });

        allTransactions.forEach(tx => {
            const source = tx.source_ledger_head_id ? ` (from ledger ${tx.source_ledger_head_id})` : '';
            console.log(`   ${tx.transaction_date} | ${tx.ledgerHead.name} | ${tx.tx_type} | ₹${tx.amount} (₹${tx.cash_amount} cash + ₹${tx.bank_amount} bank)${source}`);
        });

        console.log('\n=== MANUAL SNAPSHOT UPDATE COMPLETED ===');
        console.log('🔧 NOTE: You should now see updated balances in your monthly reports');

    } catch (error) {
        console.error('❌ Update failed:', error);
        console.error('Details:', error.message);
    }
}

// Run the update
manualSnapshotUpdate().then(() => {
    console.log('\nUpdate complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Update error:', error);
    process.exit(1);
});