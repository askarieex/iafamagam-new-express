/**
 * Comprehensive cash/bank testing with detailed tracking
 * Clear all data and test complete cash/bank flow for September and August
 */

const db = require('./models');
const immutableTransactionService = require('./services/immutableTransactionService');

async function comprehensiveCashBankTest() {
    try {
        console.log('=== COMPREHENSIVE CASH/BANK TESTING ===\n');

        const accountId = 25;

        // 1. Clear all existing data
        console.log('1. Clearing all existing data...');
        await db.TransactionLog.destroy({ where: { account_id: accountId } });
        await db.MonthlyBalanceSummary.destroy({ where: { account_id: accountId } });
        await db.LedgerHead.destroy({ where: { account_id: accountId } });
        console.log('   ✅ All data cleared');

        // 2. Create clean ledger heads
        console.log('\n2. Creating clean ledger heads...');
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

        console.log(`   ✅ Donation ledger created: ID ${donationLedger.id}`);
        console.log(`   ✅ Expense ledger created: ID ${expenseLedger.id}`);

        // 3. September transactions with detailed cash/bank tracking
        console.log('\n3. Creating September transactions...');

        // September 29: Donation ₹100 (₹60 cash + ₹40 bank)
        const sept29Donation = await immutableTransactionService.createCreditTransaction({
            account_id: accountId,
            ledger_head_id: donationLedger.id,
            amount: 100,
            cash_amount: 60,
            bank_amount: 40,
            cash_type: 'both',
            transaction_date: '2025-09-29',
            description: 'September donation: ₹60 cash + ₹40 bank'
        }, {
            userId: 1,
            ipAddress: '127.0.0.1'
        });
        console.log(`   ✅ Sept 29 Donation: ₹100 (₹60 cash + ₹40 bank)`);

        // September 30: Expense ₹30 (₹20 cash + ₹10 bank) from donation funds
        const sept30Expense = await immutableTransactionService.createDebitTransaction({
            account_id: accountId,
            ledger_head_id: expenseLedger.id,
            source_ledger_head_id: donationLedger.id,
            amount: 30,
            cash_amount: 20,
            bank_amount: 10,
            cash_type: 'both',
            transaction_date: '2025-09-30',
            description: 'September expense: ₹20 cash + ₹10 bank from donations'
        }, {
            userId: 1,
            ipAddress: '127.0.0.1'
        });
        console.log(`   ✅ Sept 30 Expense: ₹30 (₹20 cash + ₹10 bank)`);

        // 4. Check September balance
        console.log('\n4. September balance after transactions:');
        const septDonationBalance = await immutableTransactionService.calculateCurrentBalance(accountId, donationLedger.id, '2025-09-30');
        const septDonationLedgerState = await db.LedgerHead.findByPk(donationLedger.id);

        console.log(`   Donation total: ₹${septDonationBalance}`);
        console.log(`   Donation cash: ₹${septDonationLedgerState.cash_balance}`);
        console.log(`   Donation bank: ₹${septDonationLedgerState.bank_balance}`);
        console.log(`   Expected: Total ₹70 (₹100 - ₹30), Cash ₹40 (₹60 - ₹20), Bank ₹30 (₹40 - ₹10)`);

        // 5. More September transactions to test cash/bank tracking
        console.log('\n5. Creating more September transactions for testing...');

        // September 15: Another donation ₹80 (₹50 cash + ₹30 bank) - simulate historical data
        const sept15Donation = await immutableTransactionService.createCreditTransaction({
            account_id: accountId,
            ledger_head_id: donationLedger.id,
            amount: 80,
            cash_amount: 50,
            bank_amount: 30,
            cash_type: 'both',
            transaction_date: '2025-09-15',
            description: 'September 15 donation: ₹50 cash + ₹30 bank'
        }, {
            userId: 1,
            ipAddress: '127.0.0.1'
        });
        console.log(`   ✅ Sept 15 Donation: ₹80 (₹50 cash + ₹30 bank)`);

        // September 16: Expense ₹25 (₹15 cash + ₹10 bank) from donation funds
        const sept16Expense = await immutableTransactionService.createDebitTransaction({
            account_id: accountId,
            ledger_head_id: expenseLedger.id,
            source_ledger_head_id: donationLedger.id,
            amount: 25,
            cash_amount: 15,
            bank_amount: 10,
            cash_type: 'both',
            transaction_date: '2025-09-16',
            description: 'September 16 expense: ₹15 cash + ₹10 bank from donations'
        }, {
            userId: 1,
            ipAddress: '127.0.0.1'
        });
        console.log(`   ✅ Sept 16 Expense: ₹25 (₹15 cash + ₹10 bank)`);

        // 6. Wait for async processing
        console.log('\n6. Waiting for snapshot processing...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 7. Check September snapshot cash/bank breakdown
        console.log('\n7. Checking September snapshot cash/bank breakdown:');
        const septSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: {
                account_id: accountId,
                ledger_head_id: donationLedger.id,
                month_year: '2025-09-01'
            }
        });

        if (septSnapshot) {
            console.log(`   September Donation snapshot:`);
            console.log(`   Total: ₹${septSnapshot.closing_balance}`);
            console.log(`   Cash: ₹${septSnapshot.cash_amount}`);
            console.log(`   Bank: ₹${septSnapshot.bank_amount}`);

            // Calculate expected values:
            // Sept 29: +₹100 (₹60 cash + ₹40 bank)
            // Sept 30: -₹30 (₹20 cash + ₹10 bank)
            // Sept 15: +₹80 (₹50 cash + ₹30 bank)
            // Sept 16: -₹25 (₹15 cash + ₹10 bank)
            // Total: ₹100 - ₹30 + ₹80 - ₹25 = ₹125
            // Cash: ₹60 - ₹20 + ₹50 - ₹15 = ₹75
            // Bank: ₹40 - ₹10 + ₹30 - ₹10 = ₹50
            console.log(`   Expected: Total ₹125, Cash ₹75, Bank ₹50`);

            const totalCorrect = septSnapshot.closing_balance == 125;
            const cashCorrect = septSnapshot.cash_amount == 75;
            const bankCorrect = septSnapshot.bank_amount == 50;

            console.log(`   ✅ Total: ${totalCorrect ? 'CORRECT' : 'INCORRECT'}`);
            console.log(`   ✅ Cash: ${cashCorrect ? 'CORRECT' : 'INCORRECT'}`);
            console.log(`   ✅ Bank: ${bankCorrect ? 'CORRECT' : 'INCORRECT'}`);
        }

        // 8. Check current donation ledger state
        console.log('\n8. Current donation ledger state:');
        const currentDonationState = await db.LedgerHead.findByPk(donationLedger.id);
        console.log(`   Current total: ₹${currentDonationState.current_balance}`);
        console.log(`   Current cash: ₹${currentDonationState.cash_balance}`);
        console.log(`   Current bank: ₹${currentDonationState.bank_balance}`);

        // 9. Manual calculation verification
        console.log('\n9. Manual calculation verification:');
        console.log('   September transactions:');
        console.log('   Sept 29: +₹100 (₹60 cash + ₹40 bank)');
        console.log('   Sept 30: -₹30 (₹20 cash + ₹10 bank)');
        console.log('   Sept 15: +₹80 (₹50 cash + ₹30 bank)');
        console.log('   Sept 16: -₹25 (₹15 cash + ₹10 bank)');
        console.log('   Final: ₹125 total (₹75 cash + ₹50 bank)');

        console.log('\n=== COMPREHENSIVE TEST COMPLETED ===');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Details:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
comprehensiveCashBankTest().then(() => {
    console.log('\nTest complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});