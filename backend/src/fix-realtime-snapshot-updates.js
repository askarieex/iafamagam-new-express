/**
 * Fix real-time snapshot updates for historical months
 * Ensure snapshots always reflect current reality
 */

const db = require('./models');
const monthlySnapshotService = require('./services/monthlySnapshotService');

async function fixRealtimeSnapshotUpdates() {
    try {
        console.log('=== FIXING REAL-TIME SNAPSHOT UPDATES ===\n');

        const accountId = 25;

        // 1. Check current problematic September snapshot
        console.log('1. Current September snapshot (WRONG):');
        const wrongSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: {
                account_id: accountId,
                month_year: '2025-09-01',
                ledger_head_id: 108 // Donation ledger
            }
        });

        if (wrongSnapshot) {
            console.log(`   Wrong Total: ₹${wrongSnapshot.closing_balance}`);
            console.log(`   Wrong Cash: ₹${wrongSnapshot.cash_amount}`);
            console.log(`   Wrong Bank: ₹${wrongSnapshot.bank_amount}`);
        }

        // 2. Calculate what September should actually be
        console.log('\n2. What September snapshot SHOULD be:');

        // Get all transactions up to September 30, 2025
        const allTransactionsUpToSept = await db.TransactionLog.findAll({
            where: {
                account_id: accountId,
                ledger_head_id: 108, // Donation ledger
                transaction_date: {
                    [db.Sequelize.Op.lte]: '2025-09-30'
                }
            }
        });

        // Get all source deductions up to September 30, 2025
        const allSourceDeductionsUpToSept = await db.TransactionLog.findAll({
            where: {
                account_id: accountId,
                source_ledger_head_id: 108, // From Donation ledger
                tx_type: 'debit',
                transaction_date: {
                    [db.Sequelize.Op.lte]: '2025-09-30'
                }
            }
        });

        let totalCredits = 0, totalDebits = 0;
        let totalCashFlow = 0, totalBankFlow = 0;

        // Calculate from direct transactions
        allTransactionsUpToSept.forEach(tx => {
            const amount = parseFloat(tx.amount || 0);
            const cash = parseFloat(tx.cash_amount || 0);
            const bank = parseFloat(tx.bank_amount || 0);

            if (tx.tx_type === 'credit') {
                totalCredits += amount;
                totalCashFlow += cash;
                totalBankFlow += bank;
            } else {
                totalDebits += amount;
                totalCashFlow -= cash;
                totalBankFlow -= bank;
            }
        });

        // Calculate from source deductions
        allSourceDeductionsUpToSept.forEach(tx => {
            const cash = parseFloat(tx.cash_amount || 0);
            const bank = parseFloat(tx.bank_amount || 0);

            totalCashFlow -= cash;
            totalBankFlow -= bank;
        });

        const correctClosingBalance = totalCredits - totalDebits - allSourceDeductionsUpToSept.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        const correctCashAmount = Math.max(0, totalCashFlow);
        const correctBankAmount = Math.max(0, totalBankFlow);

        console.log(`   Correct Total: ₹${correctClosingBalance}`);
        console.log(`   Correct Cash: ₹${correctCashAmount}`);
        console.log(`   Correct Bank: ₹${correctBankAmount}`);

        // 3. Update the September snapshot with correct values
        console.log('\n3. Updating September snapshot with correct values...');
        await db.MonthlyBalanceSummary.update({
            closing_balance: correctClosingBalance,
            total_credits: totalCredits,
            total_debits: totalDebits,
            cash_amount: correctCashAmount,
            bank_amount: correctBankAmount,
            last_calculated_at: new Date()
        }, {
            where: {
                account_id: accountId,
                month_year: '2025-09-01',
                ledger_head_id: 108
            }
        });

        console.log('   ✅ September snapshot updated to correct values');

        // 4. Verify the fix
        console.log('\n4. Verifying the fix:');
        const fixedSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: {
                account_id: accountId,
                month_year: '2025-09-01',
                ledger_head_id: 108
            }
        });

        console.log(`   Fixed Total: ₹${fixedSnapshot.closing_balance}`);
        console.log(`   Fixed Cash: ₹${fixedSnapshot.cash_amount}`);
        console.log(`   Fixed Bank: ₹${fixedSnapshot.bank_amount}`);

        const isCorrect = fixedSnapshot.closing_balance == 90 &&
                         fixedSnapshot.cash_amount == 55 &&
                         fixedSnapshot.bank_amount == 35;

        console.log(`   ✅ ${isCorrect ? 'SNAPSHOT IS NOW CORRECT!' : 'Still needs adjustment'}`);

        // 5. Show transaction breakdown for verification
        console.log('\n5. Transaction breakdown for verification:');
        console.log('   Direct to Donation ledger:');
        allTransactionsUpToSept.forEach(tx => {
            console.log(`     ${tx.transaction_date} | ${tx.tx_type} | ₹${tx.amount} (₹${tx.cash_amount} cash + ₹${tx.bank_amount} bank)`);
        });

        console.log('\n   Source deductions from Donation ledger:');
        allSourceDeductionsUpToSept.forEach(tx => {
            console.log(`     ${tx.transaction_date} | debit | -₹${tx.amount} (-₹${tx.cash_amount} cash + -₹${tx.bank_amount} bank)`);
        });

        console.log('\n=== REAL-TIME SNAPSHOT UPDATE FIX COMPLETED ===');

    } catch (error) {
        console.error('❌ Fix failed:', error);
        console.error('Details:', error.message);
    }
}

// Run the fix
fixRealtimeSnapshotUpdates().then(() => {
    console.log('\nFix complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Fix error:', error);
    process.exit(1);
});