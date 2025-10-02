/**
 * Comprehensive backdated transaction testing
 * Test both current month and backdated transactions with full verification
 */

const db = require('./models');
const immutableTransactionService = require('./services/immutableTransactionService');

async function comprehensiveBackdateTest() {
    try {
        console.log('=== COMPREHENSIVE BACKDATE TRANSACTION TESTING ===\n');

        const accountId = 25;

        // 1. Clear all data first
        console.log('1. Clearing all existing data...');
        await db.TransactionLog.destroy({ where: { account_id: accountId } });
        await db.MonthlyBalanceSummary.destroy({ where: { account_id: accountId } });
        await db.LedgerHead.destroy({ where: { account_id: accountId } });
        console.log('   ✅ All data cleared');

        // 2. Create fresh ledger heads
        console.log('\n2. Creating fresh ledger heads...');
        const donationLedger = await db.LedgerHead.create({
            account_id: accountId,
            name: 'Donation',
            head_type: 'credit',
            current_balance: 0,
            cash_balance: 0,
            bank_balance: 0,
            description: 'Income from donations'
        });

        const expenseLedger = await db.LedgerHead.create({
            account_id: accountId,
            name: 'Expense',
            head_type: 'debit',
            current_balance: 0,
            cash_balance: 0,
            bank_balance: 0,
            description: 'General expenses'
        });

        console.log(`   ✅ Donation ledger: ID ${donationLedger.id}`);
        console.log(`   ✅ Expense ledger: ID ${expenseLedger.id}`);

        // 3. September (Current Month) Transactions
        console.log('\n3. Creating September (current month) transactions...');

        // Sept 29: Donation ₹50 (₹30 cash + ₹20 bank)
        await immutableTransactionService.createCreditTransaction({
            account_id: accountId,
            ledger_head_id: donationLedger.id,
            amount: 50,
            cash_amount: 30,
            bank_amount: 20,
            cash_type: 'both',
            transaction_date: '2025-09-29',
            description: 'Current month donation Sept 29'
        }, { userId: 1, ipAddress: '127.0.0.1' });
        console.log('   ✅ Sept 29: +₹50 donation (₹30 cash + ₹20 bank)');

        // Sept 30: Expense ₹15 (₹10 cash + ₹5 bank)
        await immutableTransactionService.createDebitTransaction({
            account_id: accountId,
            ledger_head_id: expenseLedger.id,
            source_ledger_head_id: donationLedger.id,
            amount: 15,
            cash_amount: 10,
            bank_amount: 5,
            cash_type: 'both',
            transaction_date: '2025-09-30',
            description: 'Current month expense Sept 30'
        }, { userId: 1, ipAddress: '127.0.0.1' });
        console.log('   ✅ Sept 30: -₹15 expense (₹10 cash + ₹5 bank)');

        // 4. Check current month balance
        console.log('\n4. September balance after current transactions:');
        const septBalance = await immutableTransactionService.calculateCurrentBalance(accountId, donationLedger.id);
        const septLedger = await db.LedgerHead.findByPk(donationLedger.id);
        console.log(`   Donation: ₹${septBalance} (₹${septLedger.cash_balance} cash + ₹${septLedger.bank_balance} bank)`);
        console.log(`   Expected: ₹35 (₹20 cash + ₹15 bank)`);

        // 5. August (Backdated) Transactions - within 30-day limit
        console.log('\n5. Creating August backdated transactions (within 30-day limit)...');

        // Aug 15: Donation ₹80 (₹50 cash + ₹30 bank)
        await immutableTransactionService.createCreditTransaction({
            account_id: accountId,
            ledger_head_id: donationLedger.id,
            amount: 80,
            cash_amount: 50,
            bank_amount: 30,
            cash_type: 'both',
            transaction_date: '2025-09-01', // Early September to avoid 30-day limit
            description: 'Backdated donation Sept 1'
        }, { userId: 1, ipAddress: '127.0.0.1' });
        console.log('   ✅ Sept 1: +₹80 backdated donation (₹50 cash + ₹30 bank)');

        // Aug 16: Expense ₹25 (₹15 cash + ₹10 bank)
        await immutableTransactionService.createDebitTransaction({
            account_id: accountId,
            ledger_head_id: expenseLedger.id,
            source_ledger_head_id: donationLedger.id,
            amount: 25,
            cash_amount: 15,
            bank_amount: 10,
            cash_type: 'both',
            transaction_date: '2025-09-02', // Early September to avoid 30-day limit
            description: 'Backdated expense Sept 2'
        }, { userId: 1, ipAddress: '127.0.0.1' });
        console.log('   ✅ Sept 2: -₹25 backdated expense (₹15 cash + ₹10 bank)');

        // 6. Wait for async processing
        console.log('\n6. Waiting for snapshot processing...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 7. Final verification
        console.log('\n7. Final verification after all transactions:');

        // Check final balances
        const finalBalance = await immutableTransactionService.calculateCurrentBalance(accountId, donationLedger.id);
        const finalLedger = await db.LedgerHead.findByPk(donationLedger.id);

        console.log(`   Final Donation Balance: ₹${finalBalance}`);
        console.log(`   Final Cash: ₹${finalLedger.cash_balance}`);
        console.log(`   Final Bank: ₹${finalLedger.bank_balance}`);

        // Manual calculation:
        // Sept 1: +₹80 (₹50 cash + ₹30 bank)
        // Sept 2: -₹25 (₹15 cash + ₹10 bank)
        // Sept 29: +₹50 (₹30 cash + ₹20 bank)
        // Sept 30: -₹15 (₹10 cash + ₹5 bank)
        // Total: ₹80 - ₹25 + ₹50 - ₹15 = ₹90
        // Cash: ₹50 - ₹15 + ₹30 - ₹10 = ₹55
        // Bank: ₹30 - ₹10 + ₹20 - ₹5 = ₹35

        console.log(`\n   Expected Final: ₹90 (₹55 cash + ₹35 bank)`);

        const totalCorrect = finalBalance == 90;
        const cashCorrect = finalLedger.cash_balance == 55;
        const bankCorrect = finalLedger.bank_balance == 35;

        console.log(`   ✅ Total: ${totalCorrect ? 'CORRECT' : 'INCORRECT'}`);
        console.log(`   ✅ Cash: ${cashCorrect ? 'CORRECT' : 'INCORRECT'}`);
        console.log(`   ✅ Bank: ${bankCorrect ? 'CORRECT' : 'INCORRECT'}`);

        // 8. Check September snapshot
        console.log('\n8. Checking September snapshot:');
        const septSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: {
                account_id: accountId,
                ledger_head_id: donationLedger.id,
                month_year: '2025-09-01'
            }
        });

        if (septSnapshot) {
            console.log(`   Snapshot Total: ₹${septSnapshot.closing_balance}`);
            console.log(`   Snapshot Cash: ₹${septSnapshot.cash_amount}`);
            console.log(`   Snapshot Bank: ₹${septSnapshot.bank_amount}`);

            const snapshotTotalCorrect = septSnapshot.closing_balance == 90;
            const snapshotCashCorrect = septSnapshot.cash_amount == 55;
            const snapshotBankCorrect = septSnapshot.bank_amount == 35;

            console.log(`   ✅ Snapshot Total: ${snapshotTotalCorrect ? 'CORRECT' : 'INCORRECT'}`);
            console.log(`   ✅ Snapshot Cash: ${snapshotCashCorrect ? 'CORRECT' : 'INCORRECT'}`);
            console.log(`   ✅ Snapshot Bank: ${snapshotBankCorrect ? 'CORRECT' : 'INCORRECT'}`);
        }

        // 9. Show all transactions
        console.log('\n9. All transactions created:');
        const allTransactions = await db.TransactionLog.findAll({
            where: { account_id: accountId },
            include: [{ model: db.LedgerHead, as: 'ledgerHead', attributes: ['name'] }],
            order: [['transaction_date', 'ASC'], ['log_id', 'ASC']]
        });

        allTransactions.forEach(tx => {
            console.log(`   ${tx.transaction_date} | ${tx.ledgerHead.name} | ${tx.tx_type} | ₹${tx.amount} (₹${tx.cash_amount} cash + ₹${tx.bank_amount} bank)`);
        });

        if (totalCorrect && cashCorrect && bankCorrect) {
            console.log('\n🎉 ALL BACKDATED TRANSACTION TESTING PASSED!');
        } else {
            console.log('\n❌ Some tests failed - need investigation');
        }

        console.log('\n=== COMPREHENSIVE BACKDATE TEST COMPLETED ===');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Details:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
comprehensiveBackdateTest().then(() => {
    console.log('\nTest complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});