/**
 * Clear all transaction data from database while keeping users and accounts
 * This will give us a clean slate for comprehensive testing
 */

const db = require('./models');

async function clearAllTransactionData() {
    try {
        console.log('=== CLEARING ALL TRANSACTION DATA ===\n');

        // 1. Show what we're keeping
        console.log('1. Data that will be PRESERVED:');
        const users = await db.User.count();
        const accounts = await db.Account.count();
        console.log(`   Users: ${users}`);
        console.log(`   Accounts: ${accounts}`);

        // 2. Show what we're clearing
        console.log('\n2. Data that will be CLEARED:');
        const transactions = await db.TransactionLog.count();
        const snapshots = await db.MonthlyBalanceSummary.count();
        console.log(`   Transaction Logs: ${transactions}`);
        console.log(`   Monthly Balance Summaries: ${snapshots}`);

        // 3. Clear all transaction-related data
        console.log('\n3. Clearing transaction data...');

        // Clear monthly balance summaries first (they reference transactions)
        await db.MonthlyBalanceSummary.destroy({ where: {} });
        console.log('   ✅ Cleared all monthly balance summaries');

        // Clear transaction logs
        await db.TransactionLog.destroy({ where: {} });
        console.log('   ✅ Cleared all transaction logs');

        // 4. Reset ledger head balances to zero
        console.log('\n4. Resetting ledger head balances to zero...');
        await db.LedgerHead.update({
            current_balance: 0,
            cash_balance: 0,
            bank_balance: 0
        }, { where: {} });

        const ledgerHeads = await db.LedgerHead.findAll({
            attributes: ['id', 'name', 'head_type', 'current_balance', 'cash_balance', 'bank_balance']
        });

        ledgerHeads.forEach(lh => {
            console.log(`   ${lh.name} (${lh.head_type}): ₹${lh.current_balance} (₹${lh.cash_balance} cash + ₹${lh.bank_balance} bank)`);
        });

        // 5. Reset account balances
        console.log('\n5. Resetting account balances...');
        await db.Account.update({
            opening_balance: 0,
            closing_balance: 0,
            cash_balance: 0,
            bank_balance: 0
        }, { where: {} });

        const accountsData = await db.Account.findAll({
            attributes: ['id', 'name', 'opening_balance', 'closing_balance', 'cash_balance', 'bank_balance']
        });

        accountsData.forEach(acc => {
            console.log(`   ${acc.name}: ₹${acc.closing_balance} (₹${acc.cash_balance} cash + ₹${acc.bank_balance} bank)`);
        });

        console.log('\n=== TRANSACTION DATA CLEARED SUCCESSFULLY ===');
        console.log('✅ Database is now in clean state for comprehensive testing');
        console.log('✅ Users and accounts preserved');
        console.log('✅ All ledger heads reset to zero balance');
        console.log('✅ Ready for fresh transaction testing');

    } catch (error) {
        console.error('❌ Error clearing transaction data:', error);
        console.error('Details:', error.message);
    }
}

// Run the cleanup
clearAllTransactionData().then(() => {
    console.log('\nCleanup complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Cleanup error:', error);
    process.exit(1);
});