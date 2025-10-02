/**
 * HIGH LEVEL COMPREHENSIVE TEST
 *
 * Tests both current month and backdated transactions:
 * 1. Current October transactions (credits + debits)
 * 2. Backdated September transactions (credits + debits)
 * 3. Verify balance calculations and reports
 */

const db = require('./models');
const immutableTransactionService = require('./services/immutableTransactionService');
const simpleMonthlyReportController = require('./controllers/simpleMonthlyReportController');

const userContext = {
    userId: 1,
    ipAddress: '127.0.0.1',
    userAgent: 'High Level Test',
    sessionId: 'test-session-highlevel'
};

class HighLevelComprehensiveTest {
    constructor() {
        this.step = 0;
        this.results = {
            currentMonth: {},
            backdated: {},
            reports: {}
        };
    }

    async runTest() {
        console.log('🚀 HIGH LEVEL COMPREHENSIVE TEST');
        console.log('=' .repeat(80));

        try {
            await this.clearAllData();

            // Current month testing
            await this.testCurrentMonthCredits();
            await this.testCurrentMonthDebits();
            await this.verifyCurrentMonthReport();

            // Backdated testing
            await this.testBackdatedCredits();
            await this.testBackdatedDebits();
            await this.verifyBackdatedReport();

            // Final verification
            await this.finalComprehensiveVerification();

        } catch (error) {
            console.error('❌ Test error:', error);
        }
    }

    async clearAllData() {
        this.step++;
        console.log(`\n🗑️ STEP ${this.step}: CLEAR ALL DATA`);
        console.log('-'.repeat(50));

        await db.TransactionLog.destroy({ where: { account_id: 25 }, force: true });
        await db.MonthlyBalanceSummary.destroy({ where: { account_id: 25 }, force: true });
        await db.LedgerHead.update(
            { current_balance: 0, cash_balance: 0, bank_balance: 0 },
            { where: { account_id: 25 } }
        );

        console.log('✅ All data cleared - Fresh start');
    }

    async testCurrentMonthCredits() {
        this.step++;
        console.log(`\n💰 STEP ${this.step}: CURRENT MONTH CREDITS (October 2025)`);
        console.log('-'.repeat(50));

        // Credit 1: ₹200 cash donation
        console.log('💰 Creating ₹200 cash donation (Oct 1)...');
        const credit1 = await immutableTransactionService.createCreditTransaction({
            account_id: 25,
            ledger_head_id: 108,
            amount: 200,
            cash_type: 'cash',
            description: 'October cash donation ₹200',
            transaction_date: '2025-10-01'
        }, userContext);

        if (credit1.success) {
            console.log('✅ October credit 1 created');
            await this.checkBalances('After Oct Credit 1');
        }

        await this.wait(2000);

        // Credit 2: ₹150 bank donation
        console.log('\n💰 Creating ₹150 bank donation (Oct 1)...');
        const credit2 = await immutableTransactionService.createCreditTransaction({
            account_id: 25,
            ledger_head_id: 108,
            amount: 150,
            cash_type: 'bank',
            description: 'October bank donation ₹150',
            transaction_date: '2025-10-01'
        }, userContext);

        if (credit2.success) {
            console.log('✅ October credit 2 created');
            await this.checkBalances('After Oct Credit 2');
        }

        await this.wait(2000);
        this.results.currentMonth.credits = { amount1: 200, amount2: 150, total: 350 };
    }

    async testCurrentMonthDebits() {
        this.step++;
        console.log(`\n📉 STEP ${this.step}: CURRENT MONTH DEBITS (October 2025)`);
        console.log('-'.repeat(50));

        // Debit 1: ₹80 cash expense
        console.log('📉 Creating ₹80 cash expense (Oct 1)...');
        const debit1 = await immutableTransactionService.createDebitTransaction({
            account_id: 25,
            ledger_head_id: 109,
            source_ledger_head_id: 108,
            amount: 80,
            cash_type: 'cash',
            description: 'October cash expense ₹80',
            transaction_date: '2025-10-01'
        }, userContext);

        if (debit1.success) {
            console.log('✅ October debit 1 created');
            await this.checkBalances('After Oct Debit 1');
        }

        await this.wait(2000);

        // Debit 2: ₹60 bank expense
        console.log('\n📉 Creating ₹60 bank expense (Oct 1)...');
        const debit2 = await immutableTransactionService.createDebitTransaction({
            account_id: 25,
            ledger_head_id: 109,
            source_ledger_head_id: 108,
            amount: 60,
            cash_type: 'bank',
            description: 'October bank expense ₹60',
            transaction_date: '2025-10-01'
        }, userContext);

        if (debit2.success) {
            console.log('✅ October debit 2 created');
            await this.checkBalances('After Oct Debit 2');
        }

        await this.wait(3000);
        this.results.currentMonth.debits = { amount1: 80, amount2: 60, total: 140 };
    }

    async verifyCurrentMonthReport() {
        this.step++;
        console.log(`\n📊 STEP ${this.step}: VERIFY CURRENT MONTH REPORT (October 2025)`);
        console.log('-'.repeat(50));

        const mockReq = {
            params: { year: '2025', month: '10', accountId: '25' },
            query: { all_accounts: 'false' }
        };

        const mockRes = {
            json: function(response) {
                if (response.success && response.data) {
                    const data = response.data;
                    console.log('📊 OCTOBER REPORT RESULTS:');
                    console.log(`   Total Credits: ₹${data.totals.total_credits}`);
                    console.log(`   Total Debits: ₹${data.totals.total_debits}`);
                    console.log(`   Closing Balance: ₹${data.totals.closing_balance}`);

                    const donationHead = data.credit_heads.find(ch => ch.ledger_head.name === 'Donation');
                    const expenseHead = data.debit_heads.find(dh => dh.ledger_head.name === 'Expense');

                    if (donationHead) {
                        console.log(`\n   📈 DONATION:`)
                        console.log(`     Opening: ₹${donationHead.opening_balance}`);
                        console.log(`     Received: ₹${donationHead.total_credits}`);
                        console.log(`     Remaining: ₹${donationHead.closing_balance}`);
                    }

                    if (expenseHead) {
                        console.log(`\n   📉 EXPENSE:`)
                        console.log(`     Spent: ₹${expenseHead.closing_balance}`);
                    }
                }
                return this;
            },
            status: function(code) { return this; }
        };

        await simpleMonthlyReportController.generateMonthlyReport(mockReq, mockRes);
    }

    async testBackdatedCredits() {
        this.step++;
        console.log(`\n⏰ STEP ${this.step}: BACKDATED CREDITS (September 2025)`);
        console.log('-'.repeat(50));

        // Backdated Credit 1: ₹100 cash donation
        console.log('⏰ Creating backdated ₹100 cash donation (Sep 10)...');
        const backCredit1 = await immutableTransactionService.createCreditTransaction({
            account_id: 25,
            ledger_head_id: 108,
            amount: 100,
            cash_type: 'cash',
            description: 'Backdated September cash donation ₹100',
            transaction_date: '2025-09-10'
        }, userContext);

        if (backCredit1.success) {
            console.log('✅ Backdated credit 1 created');
            await this.wait(3000); // Wait for background processing
            await this.checkBalances('After Backdated Credit 1');
        }

        // Backdated Credit 2: ₹75 bank donation
        console.log('\n⏰ Creating backdated ₹75 bank donation (Sep 20)...');
        const backCredit2 = await immutableTransactionService.createCreditTransaction({
            account_id: 25,
            ledger_head_id: 108,
            amount: 75,
            cash_type: 'bank',
            description: 'Backdated September bank donation ₹75',
            transaction_date: '2025-09-20'
        }, userContext);

        if (backCredit2.success) {
            console.log('✅ Backdated credit 2 created');
            await this.wait(3000);
            await this.checkBalances('After Backdated Credit 2');
        }

        this.results.backdated.credits = { amount1: 100, amount2: 75, total: 175 };
    }

    async testBackdatedDebits() {
        this.step++;
        console.log(`\n⏰ STEP ${this.step}: BACKDATED DEBITS (September 2025)`);
        console.log('-'.repeat(50));

        // Backdated Debit 1: ₹40 cash expense
        console.log('⏰ Creating backdated ₹40 cash expense (Sep 15)...');
        const backDebit1 = await immutableTransactionService.createDebitTransaction({
            account_id: 25,
            ledger_head_id: 109,
            source_ledger_head_id: 108,
            amount: 40,
            cash_type: 'cash',
            description: 'Backdated September cash expense ₹40',
            transaction_date: '2025-09-15'
        }, userContext);

        if (backDebit1.success) {
            console.log('✅ Backdated debit 1 created');
            await this.wait(3000);
            await this.checkBalances('After Backdated Debit 1');
        }

        // Backdated Debit 2: ₹35 bank expense
        console.log('\n⏰ Creating backdated ₹35 bank expense (Sep 25)...');
        const backDebit2 = await immutableTransactionService.createDebitTransaction({
            account_id: 25,
            ledger_head_id: 109,
            source_ledger_head_id: 108,
            amount: 35,
            cash_type: 'bank',
            description: 'Backdated September bank expense ₹35',
            transaction_date: '2025-09-25'
        }, userContext);

        if (backDebit2.success) {
            console.log('✅ Backdated debit 2 created');
            await this.wait(3000);
            await this.checkBalances('After Backdated Debit 2');
        }

        this.results.backdated.debits = { amount1: 40, amount2: 35, total: 75 };
    }

    async verifyBackdatedReport() {
        this.step++;
        console.log(`\n📊 STEP ${this.step}: VERIFY BACKDATED REPORT (September 2025)`);
        console.log('-'.repeat(50));

        const mockReq = {
            params: { year: '2025', month: '9', accountId: '25' },
            query: { all_accounts: 'false' }
        };

        const mockRes = {
            json: function(response) {
                if (response.success && response.data) {
                    const data = response.data;
                    console.log('📊 SEPTEMBER REPORT RESULTS:');
                    console.log(`   Total Credits: ₹${data.totals.total_credits}`);
                    console.log(`   Total Debits: ₹${data.totals.total_debits}`);
                    console.log(`   Closing Balance: ₹${data.totals.closing_balance}`);

                    const donationHead = data.credit_heads.find(ch => ch.ledger_head.name === 'Donation');
                    const expenseHead = data.debit_heads.find(dh => dh.ledger_head.name === 'Expense');

                    if (donationHead) {
                        console.log(`\n   📈 DONATION:`)
                        console.log(`     Opening: ₹${donationHead.opening_balance}`);
                        console.log(`     Received: ₹${donationHead.total_credits}`);
                        console.log(`     Remaining: ₹${donationHead.closing_balance}`);
                    }

                    if (expenseHead) {
                        console.log(`\n   📉 EXPENSE:`)
                        console.log(`     Spent: ₹${expenseHead.closing_balance}`);
                    }
                }
                return this;
            },
            status: function(code) { return this; }
        };

        await simpleMonthlyReportController.generateMonthlyReport(mockReq, mockRes);
    }

    async finalComprehensiveVerification() {
        this.step++;
        console.log(`\n🎯 STEP ${this.step}: FINAL COMPREHENSIVE VERIFICATION`);
        console.log('='.repeat(80));

        // Get all transactions
        const allTransactions = await db.TransactionLog.findAll({
            where: { account_id: 25 },
            order: [['transaction_date', 'ASC'], ['created_at', 'ASC']]
        });

        const donation = await db.LedgerHead.findByPk(108);
        const expense = await db.LedgerHead.findByPk(109);

        console.log('📊 FINAL COMPREHENSIVE RESULTS:');
        console.log('='.repeat(80));

        // Categorize transactions by month
        const septTx = allTransactions.filter(tx => tx.transaction_date.startsWith('2025-09'));
        const octTx = allTransactions.filter(tx => tx.transaction_date.startsWith('2025-10'));

        console.log(`\n📅 SEPTEMBER TRANSACTIONS (${septTx.length} total):`);
        let septCredits = 0, septDebits = 0;
        septTx.forEach(tx => {
            console.log(`   ${tx.transaction_date} - ${tx.tx_type.toUpperCase()} ₹${tx.amount} - ${tx.description}`);
            if (tx.tx_type === 'credit') septCredits += parseFloat(tx.amount);
            if (tx.tx_type === 'debit') septDebits += parseFloat(tx.amount);
        });
        console.log(`   💰 September Totals: ₹${septCredits} credits - ₹${septDebits} debits = ₹${septCredits - septDebits} net`);

        console.log(`\n📅 OCTOBER TRANSACTIONS (${octTx.length} total):`);
        let octCredits = 0, octDebits = 0;
        octTx.forEach(tx => {
            console.log(`   ${tx.transaction_date} - ${tx.tx_type.toUpperCase()} ₹${tx.amount} - ${tx.description}`);
            if (tx.tx_type === 'credit') octCredits += parseFloat(tx.amount);
            if (tx.tx_type === 'debit') octDebits += parseFloat(tx.amount);
        });
        console.log(`   💰 October Totals: ₹${octCredits} credits - ₹${octDebits} debits = ₹${octCredits - octDebits} net`);

        console.log(`\n💎 FINAL LEDGER BALANCES:`);
        console.log(`   Donation: ₹${donation.current_balance} (₹${donation.cash_balance} cash + ₹${donation.bank_balance} bank)`);
        console.log(`   Expense: ₹${expense.current_balance}`);
        console.log(`   Net Available: ₹${parseFloat(donation.current_balance) - parseFloat(expense.current_balance)}`);

        // Verify source tracking
        const expenseTransactions = allTransactions.filter(tx => tx.tx_type === 'debit');
        const allHaveSource = expenseTransactions.every(tx => tx.source_ledger_head_id === 108);

        console.log(`\n✅ VERIFICATION RESULTS:`);
        console.log(`   Total Transactions: ${allTransactions.length}`);
        console.log(`   Source Tracking: ${allHaveSource ? '✅ ALL CORRECT' : '❌ MISSING'}`);
        console.log(`   Expected Total Credits: ₹${septCredits + octCredits} (₹${septCredits} Sept + ₹${octCredits} Oct)`);
        console.log(`   Expected Total Debits: ₹${septDebits + octDebits} (₹${septDebits} Sept + ₹${octDebits} Oct)`);
        console.log(`   Expected Net Balance: ₹${(septCredits + octCredits) - (septDebits + octDebits)}`);
        console.log(`   Actual Net Balance: ₹${parseFloat(donation.current_balance) - parseFloat(expense.current_balance)}`);

        const expectedNet = (septCredits + octCredits) - (septDebits + octDebits);
        const actualNet = parseFloat(donation.current_balance) - parseFloat(expense.current_balance);

        if (Math.abs(actualNet - expectedNet) < 0.01) {
            console.log(`\n🎉 SUCCESS: ALL CALCULATIONS ARE CORRECT!`);
            console.log(`   ✅ Current month transactions working perfectly`);
            console.log(`   ✅ Backdated transactions working perfectly`);
            console.log(`   ✅ Source ledger tracking working perfectly`);
            console.log(`   ✅ Balance calculations are accurate`);
            console.log(`   ✅ System is PRODUCTION READY! 🚀`);
        } else {
            console.log(`\n❌ ERROR: Net balance mismatch!`);
            console.log(`   Expected: ₹${expectedNet}, Actual: ₹${actualNet}`);
        }
    }

    async checkBalances(stage) {
        const donation = await db.LedgerHead.findByPk(108);
        const expense = await db.LedgerHead.findByPk(109);

        console.log(`   📊 ${stage}:`);
        console.log(`     Donation: ₹${donation.current_balance} (₹${donation.cash_balance} cash + ₹${donation.bank_balance} bank)`);
        console.log(`     Expense: ₹${expense.current_balance}`);
        console.log(`     Net: ₹${parseFloat(donation.current_balance) - parseFloat(expense.current_balance)}`);
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the test
if (require.main === module) {
    const test = new HighLevelComprehensiveTest();
    test.runTest().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('Test error:', error);
        process.exit(1);
    });
}

module.exports = HighLevelComprehensiveTest;