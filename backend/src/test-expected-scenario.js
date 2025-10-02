/**
 * TEST EXPECTED SCENARIO
 *
 * Creates exactly the scenario expected in the test:
 * September: ₹75 donation, ₹25 expense → ₹50 remaining
 * October: ₹150 donation, ₹50 expense → ₹150 remaining (₹50 + ₹150 - ₹50)
 */

const db = require('./models');
const immutableTransactionService = require('./services/immutableTransactionService');

const userContext = {
    userId: 1,
    ipAddress: '127.0.0.1',
    userAgent: 'Expected Scenario Test',
    sessionId: 'test-session-expected'
};

class ExpectedScenarioTest {
    constructor() {
        this.step = 0;
    }

    async runTest() {
        console.log('🎯 EXPECTED SCENARIO TEST');
        console.log('=' .repeat(80));

        try {
            await this.clearData();
            await this.createSeptemberData();
            await this.createOctoberData();
            await this.verifySeptember();
            await this.verifyOctober();

        } catch (error) {
            console.error('❌ Test error:', error);
        }
    }

    async clearData() {
        this.step++;
        console.log(`\n🗑️ STEP ${this.step}: CLEAR ALL DATA`);
        console.log('-'.repeat(50));

        await db.TransactionLog.destroy({ where: { account_id: 25 }, force: true });
        await db.MonthlyBalanceSummary.destroy({ where: { account_id: 25 }, force: true });

        // Reset ledger balances
        await db.LedgerHead.update(
            { current_balance: 0, cash_balance: 0, bank_balance: 0 },
            { where: { account_id: 25 } }
        );

        console.log('✅ All data cleared and ledger balances reset');
    }

    async createSeptemberData() {
        this.step++;
        console.log(`\n📅 STEP ${this.step}: CREATE SEPTEMBER DATA`);
        console.log('-'.repeat(50));

        // September: ₹75 donation
        console.log('💰 Creating ₹75 September donation...');
        const septCredit = await immutableTransactionService.createCreditTransaction({
            account_id: 25,
            ledger_head_id: 108, // Donation
            amount: 75,
            cash_type: 'cash',
            description: 'September donation ₹75',
            transaction_date: '2025-09-15'
        }, userContext);

        if (septCredit.success) {
            console.log('✅ September donation created');
        }

        // Wait for processing
        await this.wait(2000);

        // September: ₹25 expense
        console.log('📉 Creating ₹25 September expense...');
        const septDebit = await immutableTransactionService.createDebitTransaction({
            account_id: 25,
            ledger_head_id: 109, // Expense
            source_ledger_head_id: 108, // From Donation
            amount: 25,
            cash_type: 'cash',
            description: 'September expense ₹25',
            transaction_date: '2025-09-20'
        }, userContext);

        if (septDebit.success) {
            console.log('✅ September expense created');
        }

        await this.wait(2000);
    }

    async createOctoberData() {
        this.step++;
        console.log(`\n📅 STEP ${this.step}: CREATE OCTOBER DATA`);
        console.log('-'.repeat(50));

        // October: ₹150 donation
        console.log('💰 Creating ₹150 October donation...');
        const octCredit = await immutableTransactionService.createCreditTransaction({
            account_id: 25,
            ledger_head_id: 108, // Donation
            amount: 150,
            cash_type: 'bank',
            description: 'October donation ₹150',
            transaction_date: '2025-10-10'
        }, userContext);

        if (octCredit.success) {
            console.log('✅ October donation created');
        }

        await this.wait(2000);

        // October: ₹50 expense
        console.log('📉 Creating ₹50 October expense...');
        const octDebit = await immutableTransactionService.createDebitTransaction({
            account_id: 25,
            ledger_head_id: 109, // Expense
            source_ledger_head_id: 108, // From Donation
            amount: 50,
            cash_type: 'cash',
            description: 'October expense ₹50',
            transaction_date: '2025-10-15'
        }, userContext);

        if (octDebit.success) {
            console.log('✅ October expense created');
        }

        await this.wait(3000);
    }

    async verifySeptember() {
        this.step++;
        console.log(`\n✅ STEP ${this.step}: VERIFY SEPTEMBER RESULTS`);
        console.log('-'.repeat(50));

        const donation = await db.LedgerHead.findByPk(108);
        const expense = await db.LedgerHead.findByPk(109);

        // Check transaction logs
        const septTransactions = await db.TransactionLog.findAll({
            where: {
                account_id: 25,
                transaction_date: { [db.Sequelize.Op.between]: ['2025-09-01', '2025-09-30'] }
            },
            order: [['transaction_date', 'ASC']]
        });

        console.log(`📊 September transactions: ${septTransactions.length}`);
        septTransactions.forEach(tx => {
            console.log(`   ${tx.tx_type.toUpperCase()} ₹${tx.amount} - ${tx.description} (source: ${tx.source_ledger_head_id || 'N/A'})`);
        });

        console.log(`\n💰 Current balances:`);
        console.log(`   Donation: ₹${donation.current_balance}`);
        console.log(`   Expense: ₹${expense.current_balance}`);
        console.log(`   Net: ₹${parseFloat(donation.current_balance) - parseFloat(expense.current_balance)}`);

        // Expected: ₹75 - ₹25 = ₹50 net
        const expectedNet = 50;
        const actualNet = parseFloat(donation.current_balance) - parseFloat(expense.current_balance);

        if (Math.abs(actualNet - expectedNet) < 0.01) {
            console.log(`✅ CORRECT: Net balance is ₹${actualNet} (expected ₹${expectedNet})`);
        } else {
            console.log(`❌ WRONG: Net balance is ₹${actualNet} (expected ₹${expectedNet})`);
        }
    }

    async verifyOctober() {
        this.step++;
        console.log(`\n✅ STEP ${this.step}: VERIFY OCTOBER RESULTS`);
        console.log('-'.repeat(50));

        const donation = await db.LedgerHead.findByPk(108);
        const expense = await db.LedgerHead.findByPk(109);

        // Check all transactions
        const allTransactions = await db.TransactionLog.findAll({
            where: { account_id: 25 },
            order: [['transaction_date', 'ASC'], ['created_at', 'ASC']]
        });

        console.log(`📊 All transactions: ${allTransactions.length}`);
        allTransactions.forEach((tx, index) => {
            console.log(`   ${index + 1}. ${tx.transaction_date} - ${tx.tx_type.toUpperCase()} ₹${tx.amount} - ${tx.description} (source: ${tx.source_ledger_head_id || 'N/A'})`);
        });

        let totalCredits = 0;
        let totalDebits = 0;

        allTransactions.forEach(tx => {
            if (tx.tx_type === 'credit') totalCredits += parseFloat(tx.amount);
            if (tx.tx_type === 'debit') totalDebits += parseFloat(tx.amount);
        });

        console.log(`\n💰 Final balances:`);
        console.log(`   Donation: ₹${donation.current_balance}`);
        console.log(`   Expense: ₹${expense.current_balance}`);
        console.log(`   Net: ₹${parseFloat(donation.current_balance) - parseFloat(expense.current_balance)}`);

        console.log(`\n📈 Totals:`);
        console.log(`   Total Credits: ₹${totalCredits} (₹75 + ₹150)`);
        console.log(`   Total Debits: ₹${totalDebits} (₹25 + ₹50)`);
        console.log(`   Expected Net: ₹${totalCredits - totalDebits} (₹225 - ₹75 = ₹150)`);

        // Expected: ₹75 + ₹150 - ₹25 - ₹50 = ₹150 net
        const expectedNet = 150;
        const actualNet = parseFloat(donation.current_balance) - parseFloat(expense.current_balance);

        if (Math.abs(actualNet - expectedNet) < 0.01) {
            console.log(`✅ CORRECT: Final net balance is ₹${actualNet} (expected ₹${expectedNet})`);
        } else {
            console.log(`❌ WRONG: Final net balance is ₹${actualNet} (expected ₹${expectedNet})`);
        }

        // Verify source_ledger_head_id is working
        const expenseTransactions = allTransactions.filter(tx => tx.tx_type === 'debit');
        const allHaveSource = expenseTransactions.every(tx => tx.source_ledger_head_id === 108);

        if (allHaveSource) {
            console.log(`✅ SUCCESS: All expense transactions have source_ledger_head_id = 108`);
        } else {
            console.log(`❌ ERROR: Some expense transactions missing source_ledger_head_id`);
        }
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the test
if (require.main === module) {
    const test = new ExpectedScenarioTest();
    test.runTest().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('Test error:', error);
        process.exit(1);
    });
}

module.exports = ExpectedScenarioTest;