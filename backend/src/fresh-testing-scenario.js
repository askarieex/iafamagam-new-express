/**
 * FRESH TESTING SCENARIO
 * Clean database testing with 2 credits + 2 debits + backdated transactions
 */

const db = require('./models');
const immutableTransactionService = require('./services/immutableTransactionService');

const userContext = {
    userId: 1,
    ipAddress: '127.0.0.1',
    userAgent: 'Fresh Testing',
    sessionId: 'test-session-fresh'
};

class FreshTestingScenario {
    constructor() {
        this.results = [];
        this.step = 0;
    }

    async runTest() {
        console.log('🚀 FRESH TESTING SCENARIO - CLEAN DATABASE');
        console.log('=' .repeat(80));

        try {
            await this.verifyCleanState();
            await this.testTwoCredits();
            await this.testTwoDebits();
            await this.testBackdatedTransactions();
            await this.showFinalResults();

        } catch (error) {
            console.error('❌ Test error:', error);
        }
    }

    async verifyCleanState() {
        this.step++;
        console.log(`\n📋 STEP ${this.step}: VERIFY CLEAN STATE`);
        console.log('-'.repeat(50));

        const donations = await db.LedgerHead.findByPk(108);
        const expenses = await db.LedgerHead.findByPk(109);
        const transactions = await db.TransactionLog.count();

        console.log(`✅ Donation balance: ₹${donations.current_balance}`);
        console.log(`✅ Expense balance: ₹${expenses.current_balance}`);
        console.log(`✅ Transaction count: ${transactions}`);

        if (transactions === 0) {
            console.log('✅ Database is clean and ready for testing');
        }
    }

    async testTwoCredits() {
        this.step++;
        console.log(`\n💰 STEP ${this.step}: CREATE 2 CREDIT TRANSACTIONS`);
        console.log('-'.repeat(50));

        // Credit 1: ₹100 cash donation
        console.log('💰 Creating ₹100 cash donation...');
        const credit1 = await immutableTransactionService.createCreditTransaction({
            account_id: 25,
            ledger_head_id: 108, // Donation
            amount: 100,
            cash_type: 'cash',
            description: 'Cash donation ₹100',
            transaction_date: '2025-10-01'
        }, userContext);

        if (credit1.success) {
            console.log('✅ Credit 1 created successfully');
            await this.checkBalances('After Credit 1');
        }

        // Credit 2: ₹50 bank donation
        console.log('\n💰 Creating ₹50 bank donation...');
        const credit2 = await immutableTransactionService.createCreditTransaction({
            account_id: 25,
            ledger_head_id: 108, // Donation
            amount: 50,
            cash_type: 'bank',
            description: 'Bank donation ₹50',
            transaction_date: '2025-10-01'
        }, userContext);

        if (credit2.success) {
            console.log('✅ Credit 2 created successfully');
            await this.checkBalances('After Credit 2');
        }
    }

    async testTwoDebits() {
        this.step++;
        console.log(`\n📉 STEP ${this.step}: CREATE 2 DEBIT TRANSACTIONS`);
        console.log('-'.repeat(50));

        // Debit 1: ₹30 cash expense
        console.log('📉 Creating ₹30 cash expense...');
        const debit1 = await immutableTransactionService.createDebitTransaction({
            account_id: 25,
            ledger_head_id: 109, // Expense
            source_ledger_head_id: 108, // From Donation
            amount: 30,
            cash_type: 'cash',
            description: 'Cash expense ₹30',
            transaction_date: '2025-10-01'
        }, userContext);

        if (debit1.success) {
            console.log('✅ Debit 1 created successfully');
            await this.checkBalances('After Debit 1');
        }

        // Wait for background processing
        await this.wait(2000);

        // Debit 2: ₹20 bank expense
        console.log('\n📉 Creating ₹20 bank expense...');
        const debit2 = await immutableTransactionService.createDebitTransaction({
            account_id: 25,
            ledger_head_id: 109, // Expense
            source_ledger_head_id: 108, // From Donation
            amount: 20,
            cash_type: 'bank',
            description: 'Bank expense ₹20',
            transaction_date: '2025-10-01'
        }, userContext);

        if (debit2.success) {
            console.log('✅ Debit 2 created successfully');
            await this.checkBalances('After Debit 2');
        }

        await this.wait(2000);
    }

    async testBackdatedTransactions() {
        this.step++;
        console.log(`\n⏰ STEP ${this.step}: TEST BACKDATED TRANSACTIONS`);
        console.log('-'.repeat(50));

        // Backdated credit: ₹75 in September
        console.log('⏰ Creating backdated ₹75 September donation...');
        const backCredit = await immutableTransactionService.createCreditTransaction({
            account_id: 25,
            ledger_head_id: 108, // Donation
            amount: 75,
            cash_type: 'cash',
            description: 'Backdated September donation',
            transaction_date: '2025-09-15'
        }, userContext);

        if (backCredit.success) {
            console.log('✅ Backdated credit created');
            await this.wait(3000); // Wait for background processing
            await this.checkBalances('After Backdated Credit');
        }

        // Backdated debit: ₹25 in September
        console.log('\n⏰ Creating backdated ₹25 September expense...');
        const backDebit = await immutableTransactionService.createDebitTransaction({
            account_id: 25,
            ledger_head_id: 109, // Expense
            source_ledger_head_id: 108, // From Donation
            amount: 25,
            cash_type: 'cash',
            description: 'Backdated September expense',
            transaction_date: '2025-09-20'
        }, userContext);

        if (backDebit.success) {
            console.log('✅ Backdated debit created');
            await this.wait(3000); // Wait for background processing
            await this.checkBalances('After Backdated Debit');
        }
    }

    async checkBalances(stage) {
        const donation = await db.LedgerHead.findByPk(108);
        const expense = await db.LedgerHead.findByPk(109);

        console.log(`   📊 ${stage}:`);
        console.log(`     Donation: ₹${donation.current_balance} (₹${donation.cash_balance} cash + ₹${donation.bank_balance} bank)`);
        console.log(`     Expense: ₹${expense.current_balance}`);
        console.log(`     Available: ₹${parseFloat(donation.current_balance) - parseFloat(expense.current_balance)}`);
    }

    async showFinalResults() {
        console.log('\n' + '='.repeat(80));
        console.log('🏁 FINAL TEST RESULTS');
        console.log('='.repeat(80));

        // Get final balances
        const donation = await db.LedgerHead.findByPk(108);
        const expense = await db.LedgerHead.findByPk(109);
        const transactions = await db.TransactionLog.findAll({
            where: { account_id: 25 },
            order: [['transaction_date', 'ASC'], ['created_at', 'ASC']]
        });

        console.log('\n📊 FINAL LEDGER BALANCES:');
        console.log(`   Donation: ₹${donation.current_balance} (₹${donation.cash_balance} cash + ₹${donation.bank_balance} bank)`);
        console.log(`   Expense: ₹${expense.current_balance}`);
        console.log(`   Net Available: ₹${parseFloat(donation.current_balance) - parseFloat(expense.current_balance)}`);

        console.log('\n📜 TRANSACTION SUMMARY:');
        console.log(`   Total Transactions: ${transactions.length}`);

        let totalCredits = 0;
        let totalDebits = 0;

        transactions.forEach((tx, index) => {
            console.log(`   ${index + 1}. ${tx.transaction_date} - ${tx.tx_type.toUpperCase()} ₹${tx.amount} - ${tx.description}`);
            if (tx.tx_type === 'credit') totalCredits += parseFloat(tx.amount);
            if (tx.tx_type === 'debit') totalDebits += parseFloat(tx.amount);
        });

        console.log(`\n📈 TOTALS:`);
        console.log(`   Total Credits: ₹${totalCredits}`);
        console.log(`   Total Debits: ₹${totalDebits}`);
        console.log(`   Net Balance: ₹${totalCredits - totalDebits}`);

        // Test expectations
        console.log('\n✅ TEST EXPECTATIONS:');
        console.log(`   Expected Donation Balance: ₹${totalCredits - totalDebits} (Credits - Debits)`);
        console.log(`   Actual Donation Balance: ₹${donation.current_balance}`);
        console.log(`   Expected Expense Balance: ₹${totalDebits}`);
        console.log(`   Actual Expense Balance: ₹${expense.current_balance}`);

        if (parseFloat(donation.current_balance) === (totalCredits - totalDebits)) {
            console.log('   🎉 SUCCESS: Donation balance calculation is CORRECT!');
        } else {
            console.log('   ❌ ERROR: Donation balance calculation is wrong!');
        }

        if (parseFloat(expense.current_balance) === totalDebits) {
            console.log('   🎉 SUCCESS: Expense balance calculation is CORRECT!');
        } else {
            console.log('   ❌ ERROR: Expense balance calculation is wrong!');
        }
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the test
if (require.main === module) {
    const test = new FreshTestingScenario();
    test.runTest().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('Test error:', error);
        process.exit(1);
    });
}

module.exports = FreshTestingScenario;