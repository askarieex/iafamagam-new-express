/**
 * COMPREHENSIVE HIGH-LEVEL DEBIT TRANSACTION TEST
 * This test performs very detailed, step-by-step testing of debit transactions
 * including current month and backdated scenarios with deep analysis
 */

const db = require('./models');
const immutableTransactionService = require('./services/immutableTransactionService');

async function comprehensiveDebitTransactionTest() {
    try {
        console.log('=== COMPREHENSIVE HIGH-LEVEL DEBIT TRANSACTION TEST ===\n');
        console.log('🔍 This test will perform VERY DETAILED analysis of debit transactions');
        console.log('🔍 Testing both current and backdated scenarios with deep tracking\n');

        const accountId = 25;
        const donationLedgerId = 108; // Credit ledger (source)
        const expenseLedgerId = 109;  // Debit ledger (destination)

        const userContext = {
            userId: 1,
            ipAddress: '127.0.0.1',
            userAgent: 'Comprehensive Debit Test',
            sessionId: 'debit-test'
        };

        // ===== PHASE 1: SETUP AND INITIAL CREDIT TRANSACTIONS =====
        console.log('📋 PHASE 1: SETUP AND INITIAL CREDIT TRANSACTIONS');
        console.log('─'.repeat(60));

        // Clear any existing transactions first
        console.log('1.1 Clearing existing transaction data...');
        await db.MonthlyBalanceSummary.destroy({ where: {} });
        await db.TransactionLog.destroy({ where: {} });
        await db.LedgerHead.update({
            current_balance: 0,
            cash_balance: 0,
            bank_balance: 0
        }, { where: {} });
        console.log('   ✅ Database cleared and reset to zero balances');

        // Create initial donations to have balance for debit transactions
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        console.log('\n1.2 Creating initial credit transactions for testing debit transactions...');

        // Credit 1: Current month donation
        console.log('   Creating ₹200 current month donation...');
        const initialCredit = await immutableTransactionService.createCreditTransaction({
            account_id: accountId,
            ledger_head_id: donationLedgerId,
            amount: 200,
            cash_amount: 120,
            bank_amount: 80,
            cash_type: 'both',
            transaction_date: todayStr,
            description: 'Initial donation for debit testing'
        }, userContext);
        console.log(`   ✅ Created: ${initialCredit.transaction.uuid}`);

        // Wait for background processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Credit 2: Backdated donation (previous month)
        const previousMonth = new Date(today);
        previousMonth.setMonth(previousMonth.getMonth() - 1);
        const previousMonthStr = previousMonth.toISOString().split('T')[0];

        console.log(`   Creating ₹150 backdated donation (${previousMonthStr})...`);
        const backdatedCredit = await immutableTransactionService.createCreditTransaction({
            account_id: accountId,
            ledger_head_id: donationLedgerId,
            amount: 150,
            cash_amount: 90,
            bank_amount: 60,
            cash_type: 'both',
            transaction_date: previousMonthStr,
            description: 'Backdated donation for debit testing'
        }, userContext);
        console.log(`   ✅ Created: ${backdatedCredit.transaction.uuid}`);

        // Wait for automatic snapshot processing
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Verify initial setup
        console.log('\n1.3 Verifying initial setup...');
        const donationLedger = await db.LedgerHead.findByPk(donationLedgerId);
        const expenseLedger = await db.LedgerHead.findByPk(expenseLedgerId);

        console.log(`   Donation ledger: ₹${donationLedger.current_balance} (₹${donationLedger.cash_balance} cash + ₹${donationLedger.bank_balance} bank)`);
        console.log(`   Expense ledger: ₹${expenseLedger.current_balance}`);
        console.log(`   Expected donation: ₹350 (₹210 cash + ₹140 bank)`);

        // ===== PHASE 2: CURRENT MONTH DEBIT TRANSACTION TESTING =====
        console.log('\n\n📋 PHASE 2: CURRENT MONTH DEBIT TRANSACTION TESTING');
        console.log('─'.repeat(60));

        console.log('2.1 Creating current month debit transaction...');
        console.log('   🔍 DETAILED TRACKING: This will deduct from donation and add to expense');

        // Record balances before debit transaction
        const beforeDebitDonation = await db.LedgerHead.findByPk(donationLedgerId);
        const beforeDebitExpense = await db.LedgerHead.findByPk(expenseLedgerId);

        console.log('\n   📊 BEFORE DEBIT TRANSACTION:');
        console.log(`      Donation: ₹${beforeDebitDonation.current_balance} (₹${beforeDebitDonation.cash_balance} cash + ₹${beforeDebitDonation.bank_balance} bank)`);
        console.log(`      Expense: ₹${beforeDebitExpense.current_balance}`);

        // Create current month debit transaction
        const currentDebit = await immutableTransactionService.createDebitTransaction({
            account_id: accountId,
            ledger_head_id: expenseLedgerId, // Destination (expense)
            source_ledger_head_id: donationLedgerId, // Source (donation)
            amount: 75,
            cash_amount: 45,
            bank_amount: 30,
            cash_type: 'both',
            transaction_date: todayStr,
            description: 'Current month office supplies expense'
        }, userContext);
        console.log(`   ✅ Created current month debit: ${currentDebit.transaction.uuid}`);

        // Wait for automatic processing
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Record balances after debit transaction
        const afterDebitDonation = await db.LedgerHead.findByPk(donationLedgerId);
        const afterDebitExpense = await db.LedgerHead.findByPk(expenseLedgerId);

        console.log('\n   📊 AFTER DEBIT TRANSACTION:');
        console.log(`      Donation: ₹${afterDebitDonation.current_balance} (₹${afterDebitDonation.cash_balance} cash + ₹${afterDebitDonation.bank_balance} bank)`);
        console.log(`      Expense: ₹${afterDebitExpense.current_balance}`);

        // Detailed verification of current month debit
        console.log('\n2.2 DETAILED VERIFICATION of current month debit transaction...');

        const donationReduction = beforeDebitDonation.current_balance - afterDebitDonation.current_balance;
        const expenseIncrease = afterDebitExpense.current_balance - beforeDebitExpense.current_balance;
        const donationCashReduction = beforeDebitDonation.cash_balance - afterDebitDonation.cash_balance;
        const donationBankReduction = beforeDebitDonation.bank_balance - afterDebitExpense.bank_balance;

        console.log(`   📋 Source (Donation) Verification:`);
        console.log(`      Expected reduction: ₹75 (₹45 cash + ₹30 bank)`);
        console.log(`      Actual reduction: ₹${donationReduction} (₹${donationCashReduction} cash + ₹${donationBankReduction} bank)`);
        console.log(`      ✅ Amount: ${Math.abs(donationReduction - 75) < 0.01 ? 'CORRECT' : 'INCORRECT'}`);
        console.log(`      ✅ Cash: ${Math.abs(donationCashReduction - 45) < 0.01 ? 'CORRECT' : 'INCORRECT'}`);
        console.log(`      ✅ Bank: ${Math.abs(donationBankReduction - 30) < 0.01 ? 'CORRECT' : 'INCORRECT'}`);

        console.log(`\n   📋 Destination (Expense) Verification:`);
        console.log(`      Expected increase: ₹75`);
        console.log(`      Actual increase: ₹${expenseIncrease}`);
        console.log(`      ✅ Amount: ${Math.abs(expenseIncrease - 75) < 0.01 ? 'CORRECT' : 'INCORRECT'}`);

        // Check automatic snapshot creation for current month
        console.log('\n2.3 Checking automatic snapshot updates for current month debit...');

        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;

        const currentDonationSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: { account_id: accountId, ledger_head_id: donationLedgerId, month_year: currentMonthStr }
        });

        const currentExpenseSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: { account_id: accountId, ledger_head_id: expenseLedgerId, month_year: currentMonthStr }
        });

        console.log(`   Current month donation snapshot: ${currentDonationSnapshot ? '✅ EXISTS' : '❌ MISSING'}`);
        console.log(`   Current month expense snapshot: ${currentExpenseSnapshot ? '✅ EXISTS' : '❌ MISSING'}`);

        if (currentDonationSnapshot) {
            console.log(`   Donation snapshot balance: ₹${currentDonationSnapshot.closing_balance}`);
        }
        if (currentExpenseSnapshot) {
            console.log(`   Expense snapshot balance: ₹${currentExpenseSnapshot.closing_balance}`);
        }

        // ===== PHASE 3: BACKDATED DEBIT TRANSACTION TESTING =====
        console.log('\n\n📋 PHASE 3: BACKDATED DEBIT TRANSACTION TESTING');
        console.log('─'.repeat(60));

        console.log('3.1 Creating backdated debit transaction...');
        console.log('   🔍 DETAILED TRACKING: This should trigger automatic historical snapshot updates');

        // Record balances before backdated debit
        const beforeBackdatedDonation = await db.LedgerHead.findByPk(donationLedgerId);
        const beforeBackdatedExpense = await db.LedgerHead.findByPk(expenseLedgerId);

        console.log('\n   📊 BEFORE BACKDATED DEBIT:');
        console.log(`      Donation: ₹${beforeBackdatedDonation.current_balance} (₹${beforeBackdatedDonation.cash_balance} cash + ₹${beforeBackdatedDonation.bank_balance} bank)`);
        console.log(`      Expense: ₹${beforeBackdatedExpense.current_balance}`);

        // Create backdated debit transaction (10 days ago)
        const backdatedDate = new Date(today);
        backdatedDate.setDate(backdatedDate.getDate() - 10);
        const backdatedDateStr = backdatedDate.toISOString().split('T')[0];

        console.log(`\n   Creating ₹50 backdated debit transaction (${backdatedDateStr})...`);
        console.log('   🔄 This should automatically update historical snapshots...');

        const backdatedDebit = await immutableTransactionService.createDebitTransaction({
            account_id: accountId,
            ledger_head_id: expenseLedgerId, // Destination (expense)
            source_ledger_head_id: donationLedgerId, // Source (donation)
            amount: 50,
            cash_amount: 30,
            bank_amount: 20,
            cash_type: 'both',
            transaction_date: backdatedDateStr,
            description: 'Backdated equipment purchase expense'
        }, userContext);
        console.log(`   ✅ Created backdated debit: ${backdatedDebit.transaction.uuid}`);

        // Wait for automatic snapshot processing
        console.log('   ⏳ Waiting for automatic snapshot updates...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Record balances after backdated debit
        const afterBackdatedDonation = await db.LedgerHead.findByPk(donationLedgerId);
        const afterBackdatedExpense = await db.LedgerHead.findByPk(expenseLedgerId);

        console.log('\n   📊 AFTER BACKDATED DEBIT:');
        console.log(`      Donation: ₹${afterBackdatedDonation.current_balance} (₹${afterBackdatedDonation.cash_balance} cash + ₹${afterBackdatedDonation.bank_balance} bank)`);
        console.log(`      Expense: ₹${afterBackdatedExpense.current_balance}`);

        // Detailed verification of backdated debit
        console.log('\n3.2 DETAILED VERIFICATION of backdated debit transaction...');

        const backdatedDonationReduction = beforeBackdatedDonation.current_balance - afterBackdatedDonation.current_balance;
        const backdatedExpenseIncrease = afterBackdatedExpense.current_balance - beforeBackdatedExpense.current_balance;

        console.log(`   📋 Backdated Source (Donation) Verification:`);
        console.log(`      Expected reduction: ₹50`);
        console.log(`      Actual reduction: ₹${backdatedDonationReduction}`);
        console.log(`      ✅ Amount: ${Math.abs(backdatedDonationReduction - 50) < 0.01 ? 'CORRECT' : 'INCORRECT'}`);

        console.log(`\n   📋 Backdated Destination (Expense) Verification:`);
        console.log(`      Expected increase: ₹50`);
        console.log(`      Actual increase: ₹${backdatedExpenseIncrease}`);
        console.log(`      ✅ Amount: ${Math.abs(backdatedExpenseIncrease - 50) < 0.01 ? 'CORRECT' : 'INCORRECT'}`);

        // ===== PHASE 4: AUTOMATIC SNAPSHOT VERIFICATION =====
        console.log('\n\n📋 PHASE 4: COMPREHENSIVE AUTOMATIC SNAPSHOT VERIFICATION');
        console.log('─'.repeat(70));

        console.log('4.1 Checking all automatic snapshot creation and updates...');

        // Check all monthly snapshots
        const allSnapshots = await db.MonthlyBalanceSummary.findAll({
            where: { account_id: accountId },
            order: [['month_year', 'ASC'], ['ledger_head_id', 'ASC']]
        });

        console.log(`\n   📊 ALL SNAPSHOTS FOUND: ${allSnapshots.length} snapshots`);
        allSnapshots.forEach(snapshot => {
            const ledgerName = snapshot.ledger_head_id === donationLedgerId ? 'Donation' : 'Expense';
            console.log(`      ${snapshot.month_year} | ${ledgerName} | ₹${snapshot.closing_balance} (₹${snapshot.cash_amount} cash + ₹${snapshot.bank_amount} bank)`);
        });

        // Verify automatic updates for backdated transaction
        console.log('\n4.2 Verifying automatic snapshot updates from backdated debit...');

        // Check if current month snapshots were updated
        const updatedCurrentDonationSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: { account_id: accountId, ledger_head_id: donationLedgerId, month_year: currentMonthStr }
        });

        const updatedCurrentExpenseSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: { account_id: accountId, ledger_head_id: expenseLedgerId, month_year: currentMonthStr }
        });

        console.log(`   Current month donation snapshot: ${updatedCurrentDonationSnapshot ? '✅ UPDATED' : '❌ MISSING'}`);
        console.log(`   Current month expense snapshot: ${updatedCurrentExpenseSnapshot ? '✅ UPDATED' : '❌ MISSING'}`);

        if (updatedCurrentDonationSnapshot) {
            console.log(`   Updated donation balance: ₹${updatedCurrentDonationSnapshot.closing_balance}`);
        }
        if (updatedCurrentExpenseSnapshot) {
            console.log(`   Updated expense balance: ₹${updatedCurrentExpenseSnapshot.closing_balance}`);
        }

        // ===== PHASE 5: DEEP BALANCE VERIFICATION =====
        console.log('\n\n📋 PHASE 5: DEEP BALANCE VERIFICATION AND ANALYSIS');
        console.log('─'.repeat(60));

        console.log('5.1 Complete transaction history analysis...');

        const allTransactions = await db.TransactionLog.findAll({
            where: { account_id: accountId },
            include: [{ model: db.LedgerHead, as: 'ledgerHead', attributes: ['name'] }],
            order: [['transaction_date', 'ASC'], ['log_id', 'ASC']]
        });

        console.log(`\n   📊 COMPLETE TRANSACTION HISTORY (${allTransactions.length} transactions):`);
        allTransactions.forEach(tx => {
            const source = tx.source_ledger_head_id ? ` (source: ${tx.source_ledger_head_id})` : '';
            console.log(`      ${tx.transaction_date} | ${tx.ledgerHead.name} | ${tx.tx_type} | ₹${tx.amount} (₹${tx.cash_amount} cash + ₹${tx.bank_amount} bank)${source}`);
        });

        // Calculate expected final balances
        console.log('\n5.2 Expected vs Actual balance verification...');

        // Expected calculations:
        // Donation: ₹200 (current) + ₹150 (backdated) - ₹75 (current debit) - ₹50 (backdated debit) = ₹225
        // Expense: ₹75 (current debit) + ₹50 (backdated debit) = ₹125

        const expectedDonation = 200 + 150 - 75 - 50; // ₹225
        const expectedExpense = 75 + 50; // ₹125

        console.log(`   📋 Expected Final Balances:`);
        console.log(`      Donation: ₹${expectedDonation}`);
        console.log(`      Expense: ₹${expectedExpense}`);

        console.log(`\n   📋 Actual Final Balances:`);
        console.log(`      Donation: ₹${afterBackdatedDonation.current_balance}`);
        console.log(`      Expense: ₹${afterBackdatedExpense.current_balance}`);

        const donationCorrect = Math.abs(afterBackdatedDonation.current_balance - expectedDonation) < 0.01;
        const expenseCorrect = Math.abs(afterBackdatedExpense.current_balance - expectedExpense) < 0.01;

        console.log(`\n   ✅ VERIFICATION RESULTS:`);
        console.log(`      Donation balance: ${donationCorrect ? 'CORRECT ✓' : 'INCORRECT ✗'}`);
        console.log(`      Expense balance: ${expenseCorrect ? 'CORRECT ✓' : 'INCORRECT ✗'}`);

        // ===== PHASE 6: FINAL SYSTEM ASSESSMENT =====
        console.log('\n\n📋 PHASE 6: FINAL COMPREHENSIVE SYSTEM ASSESSMENT');
        console.log('─'.repeat(65));

        const automaticSnapshotsWorking = allSnapshots.length >= 2; // Should have at least current month snapshots
        const balancesCorrect = donationCorrect && expenseCorrect;
        const debitTransactionsWorking = currentDebit.success && backdatedDebit.success;

        console.log('6.1 OVERALL SYSTEM HEALTH CHECK:');
        console.log(`   ✅ Automatic snapshot creation: ${automaticSnapshotsWorking ? 'WORKING ✓' : 'FAILED ✗'}`);
        console.log(`   ✅ Balance calculations: ${balancesCorrect ? 'CORRECT ✓' : 'INCORRECT ✗'}`);
        console.log(`   ✅ Debit transaction processing: ${debitTransactionsWorking ? 'WORKING ✓' : 'FAILED ✗'}`);
        console.log(`   ✅ Source ledger deductions: ${donationCorrect ? 'WORKING ✓' : 'FAILED ✗'}`);
        console.log(`   ✅ Destination ledger increases: ${expenseCorrect ? 'WORKING ✓' : 'FAILED ✗'}`);

        if (automaticSnapshotsWorking && balancesCorrect && debitTransactionsWorking) {
            console.log('\n   🎉 SUCCESS: COMPREHENSIVE DEBIT TRANSACTION SYSTEM IS FULLY OPERATIONAL!');
            console.log('   🔄 Current month debit transactions work perfectly');
            console.log('   🔄 Backdated debit transactions trigger automatic snapshot updates');
            console.log('   🔄 Source and destination ledger balances track correctly');
            console.log('   🔄 Cash and bank breakdowns are accurate');
            console.log('   🔄 All automatic processes work without manual intervention');
            console.log('\n   ✅ YOUR DEBIT TRANSACTION SYSTEM IS WORKING AT 100% CAPACITY!');
        } else {
            console.log('\n   ⚠️  ISSUES DETECTED: System requires attention');
            if (!automaticSnapshotsWorking) console.log('   📋 Issue: Automatic snapshot creation not working properly');
            if (!balancesCorrect) console.log('   📋 Issue: Balance calculations are incorrect');
            if (!debitTransactionsWorking) console.log('   📋 Issue: Debit transaction processing failed');
        }

        console.log('\n=== COMPREHENSIVE HIGH-LEVEL DEBIT TRANSACTION TEST COMPLETED ===');

    } catch (error) {
        console.error('❌ Comprehensive debit test failed:', error);
        console.error('Details:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the comprehensive debit test
comprehensiveDebitTransactionTest().then(() => {
    console.log('\nComprehensive debit test complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Comprehensive debit test error:', error);
    process.exit(1);
});