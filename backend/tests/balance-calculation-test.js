const db = require('../src/models');
const balanceCalculationService = require('../src/services/balanceCalculationService');
const TransactionService = require('../src/services/transactionService');

/**
 * Comprehensive Balance Calculation Test
 * 
 * This test verifies that all balance calculations are working correctly:
 * 1. Credit transactions properly increase balances
 * 2. Debit transactions properly decrease source balances and increase target balances
 * 3. Cash/Bank splits are calculated correctly
 * 4. Monthly snapshots are accurate
 * 5. Account-level balances are consistent
 */

class BalanceCalculationTest {
    constructor() {
        this.transactionService = new TransactionService();
        this.testResults = [];
    }

    async runAllTests() {
        console.log('\n=== Starting Balance Calculation Tests ===\n');

        try {
            // Setup test data
            await this.setupTestData();

            // Run individual tests
            await this.testCreditTransactions();
            await this.testDebitTransactions();
            await this.testMixedPaymentMethods();
            await this.testMonthlySnapshots();
            await this.testBalanceConsistency();

            // Cleanup
            await this.cleanup();

            console.log('\n=== Test Results Summary ===');
            this.testResults.forEach((result, index) => {
                console.log(`${index + 1}. ${result.name}: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
                if (!result.passed) {
                    console.log(`   Error: ${result.error}`);
                }
            });

            const passedCount = this.testResults.filter(r => r.passed).length;
            console.log(`\nOverall: ${passedCount}/${this.testResults.length} tests passed`);

        } catch (error) {
            console.error('Test suite failed:', error);
        }
    }

    async setupTestData() {
        console.log('Setting up test data...');

        // Create test account
        this.testAccount = await db.Account.create({
            name: 'Test Account',
            cash_balance: 0,
            bank_balance: 0,
            closing_balance: 0
        });

        // Create test ledger heads
        this.donationHead = await db.LedgerHead.create({
            account_id: this.testAccount.id,
            name: 'Test Donations',
            head_type: 'credit',
            current_balance: 0,
            cash_balance: 0,
            bank_balance: 0
        });

        this.expenseHead = await db.LedgerHead.create({
            account_id: this.testAccount.id,
            name: 'Test Expenses',
            head_type: 'debit',
            current_balance: 0,
            cash_balance: 0,
            bank_balance: 0
        });

        // Create test booklet
        this.testBooklet = await db.Booklet.create({
            account_id: this.testAccount.id,
            name: 'Test Booklet',
            start_page: 1,
            end_page: 100,
            pages_left: Array.from({ length: 100 }, (_, i) => i + 1),
            is_active: true
        });

        console.log('✅ Test data setup complete');
    }

    async testCreditTransactions() {
        console.log('\n--- Testing Credit Transactions ---');

        try {
            // Test 1: Cash credit transaction
            const cashCredit = await this.transactionService.createCredit({
                account_id: this.testAccount.id,
                ledger_head_id: this.donationHead.id,
                booklet_id: this.testBooklet.id,
                amount: '1000.00',
                cash_type: 'cash',
                tx_date: '2025-01-15',
                description: 'Test cash donation'
            });

            // Verify balances
            await this.donationHead.reload();
            if (parseFloat(this.donationHead.current_balance) !== 1000.00 ||
                parseFloat(this.donationHead.cash_balance) !== 1000.00 ||
                parseFloat(this.donationHead.bank_balance) !== 0.00) {
                throw new Error(`Incorrect cash credit balances: ${this.donationHead.current_balance}, ${this.donationHead.cash_balance}, ${this.donationHead.bank_balance}`);
            }

            // Test 2: Bank credit transaction
            const bankCredit = await this.transactionService.createCredit({
                account_id: this.testAccount.id,
                ledger_head_id: this.donationHead.id,
                booklet_id: this.testBooklet.id,
                amount: '2000.00',
                cash_type: 'bank',
                tx_date: '2025-01-16',
                description: 'Test bank donation'
            });

            // Verify balances
            await this.donationHead.reload();
            if (parseFloat(this.donationHead.current_balance) !== 3000.00 ||
                parseFloat(this.donationHead.cash_balance) !== 1000.00 ||
                parseFloat(this.donationHead.bank_balance) !== 2000.00) {
                throw new Error(`Incorrect bank credit balances: ${this.donationHead.current_balance}, ${this.donationHead.cash_balance}, ${this.donationHead.bank_balance}`);
            }

            // Test 3: Mixed (both) credit transaction
            const mixedCredit = await this.transactionService.createCredit({
                account_id: this.testAccount.id,
                ledger_head_id: this.donationHead.id,
                booklet_id: this.testBooklet.id,
                amount: '1500.00',
                cash_amount: '500.00',
                bank_amount: '1000.00',
                cash_type: 'both',
                tx_date: '2025-01-17',
                description: 'Test mixed donation'
            });

            // Verify balances
            await this.donationHead.reload();
            if (parseFloat(this.donationHead.current_balance) !== 4500.00 ||
                parseFloat(this.donationHead.cash_balance) !== 1500.00 ||
                parseFloat(this.donationHead.bank_balance) !== 3000.00) {
                throw new Error(`Incorrect mixed credit balances: ${this.donationHead.current_balance}, ${this.donationHead.cash_balance}, ${this.donationHead.bank_balance}`);
            }

            this.testResults.push({ name: 'Credit Transactions', passed: true });
            console.log('✅ Credit transaction tests passed');

        } catch (error) {
            this.testResults.push({ name: 'Credit Transactions', passed: false, error: error.message });
            console.log('❌ Credit transaction tests failed:', error.message);
        }
    }

    async testDebitTransactions() {
        console.log('\n--- Testing Debit Transactions ---');

        try {
            // Test debit transaction: Transfer from donation head to expense head
            const debitTransaction = await this.transactionService.createDebit({
                account_id: this.testAccount.id,
                ledger_head_id: this.expenseHead.id, // Target: expense head
                amount: '800.00',
                cash_type: 'cash',
                tx_date: '2025-01-18',
                description: 'Test expense',
                sources: [{
                    ledger_head_id: this.donationHead.id, // Source: donation head
                    amount: '800.00'
                }]
            });

            // Verify source (donation) balance decreased
            await this.donationHead.reload();
            if (parseFloat(this.donationHead.current_balance) !== 3700.00 ||
                parseFloat(this.donationHead.cash_balance) !== 700.00 ||
                parseFloat(this.donationHead.bank_balance) !== 3000.00) {
                throw new Error(`Incorrect source balances after debit: ${this.donationHead.current_balance}, ${this.donationHead.cash_balance}, ${this.donationHead.bank_balance}`);
            }

            // Verify target (expense) balance increased
            await this.expenseHead.reload();
            if (parseFloat(this.expenseHead.current_balance) !== 800.00 ||
                parseFloat(this.expenseHead.cash_balance) !== 800.00 ||
                parseFloat(this.expenseHead.bank_balance) !== 0.00) {
                throw new Error(`Incorrect target balances after debit: ${this.expenseHead.current_balance}, ${this.expenseHead.cash_balance}, ${this.expenseHead.bank_balance}`);
            }

            this.testResults.push({ name: 'Debit Transactions', passed: true });
            console.log('✅ Debit transaction tests passed');

        } catch (error) {
            this.testResults.push({ name: 'Debit Transactions', passed: false, error: error.message });
            console.log('❌ Debit transaction tests failed:', error.message);
        }
    }

    async testMixedPaymentMethods() {
        console.log('\n--- Testing Mixed Payment Methods ---');

        try {
            // Test amount split calculation
            const result1 = balanceCalculationService.calculateAmountSplit('cash', 1000, 0, 0);
            if (!result1.isValid || result1.cashAmount !== 1000 || result1.bankAmount !== 0) {
                throw new Error('Cash split calculation failed');
            }

            const result2 = balanceCalculationService.calculateAmountSplit('bank', 1000, 0, 0);
            if (!result2.isValid || result2.cashAmount !== 0 || result2.bankAmount !== 1000) {
                throw new Error('Bank split calculation failed');
            }

            const result3 = balanceCalculationService.calculateAmountSplit('both', 1000, 400, 600);
            if (!result3.isValid || result3.cashAmount !== 400 || result3.bankAmount !== 600) {
                throw new Error('Both split calculation failed');
            }

            // Test invalid split
            const result4 = balanceCalculationService.calculateAmountSplit('both', 1000, 300, 600);
            if (result4.isValid) {
                throw new Error('Invalid split should have been rejected');
            }

            this.testResults.push({ name: 'Mixed Payment Methods', passed: true });
            console.log('✅ Mixed payment method tests passed');

        } catch (error) {
            this.testResults.push({ name: 'Mixed Payment Methods', passed: false, error: error.message });
            console.log('❌ Mixed payment method tests failed:', error.message);
        }
    }

    async testMonthlySnapshots() {
        console.log('\n--- Testing Monthly Snapshots ---');

        try {
            // Check if monthly snapshots were created correctly
            const donationSnapshot = await db.MonthlyLedgerBalance.findOne({
                where: {
                    account_id: this.testAccount.id,
                    ledger_head_id: this.donationHead.id,
                    month: 1,
                    year: 2025
                }
            });

            if (!donationSnapshot) {
                throw new Error('Monthly snapshot not created for donation head');
            }

            // Verify snapshot values
            const expectedReceipts = 4500.00; // Total credits
            const expectedPayments = 800.00;  // Total debits
            const expectedClosing = expectedReceipts - expectedPayments;

            if (Math.abs(parseFloat(donationSnapshot.receipts) - expectedReceipts) > 0.01 ||
                Math.abs(parseFloat(donationSnapshot.payments) - expectedPayments) > 0.01 ||
                Math.abs(parseFloat(donationSnapshot.closing_balance) - expectedClosing) > 0.01) {
                throw new Error(`Incorrect snapshot values: receipts=${donationSnapshot.receipts}, payments=${donationSnapshot.payments}, closing=${donationSnapshot.closing_balance}`);
            }

            this.testResults.push({ name: 'Monthly Snapshots', passed: true });
            console.log('✅ Monthly snapshot tests passed');

        } catch (error) {
            this.testResults.push({ name: 'Monthly Snapshots', passed: false, error: error.message });
            console.log('❌ Monthly snapshot tests failed:', error.message);
        }
    }

    async testBalanceConsistency() {
        console.log('\n--- Testing Balance Consistency ---');

        try {
            // Reload account to check totals
            await this.testAccount.reload();

            // Account totals should match sum of ledger heads
            const expectedCash = 700.00 + 800.00; // donation cash + expense cash
            const expectedBank = 3000.00 + 0.00;  // donation bank + expense bank
            const expectedTotal = expectedCash + expectedBank;

            if (Math.abs(parseFloat(this.testAccount.cash_balance) - expectedCash) > 0.01 ||
                Math.abs(parseFloat(this.testAccount.bank_balance) - expectedBank) > 0.01 ||
                Math.abs(parseFloat(this.testAccount.closing_balance) - expectedTotal) > 0.01) {
                throw new Error(`Account balance inconsistency: cash=${this.testAccount.cash_balance}, bank=${this.testAccount.bank_balance}, total=${this.testAccount.closing_balance}`);
            }

            this.testResults.push({ name: 'Balance Consistency', passed: true });
            console.log('✅ Balance consistency tests passed');

        } catch (error) {
            this.testResults.push({ name: 'Balance Consistency', passed: false, error: error.message });
            console.log('❌ Balance consistency tests failed:', error.message);
        }
    }

    async cleanup() {
        console.log('\n--- Cleaning up test data ---');

        try {
            // Delete in order to respect foreign key constraints
            await db.TransactionItem.destroy({ where: {} });
            await db.Transaction.destroy({ where: {} });
            await db.MonthlyLedgerBalance.destroy({ where: {} });
            await db.Booklet.destroy({ where: {} });
            await db.LedgerHead.destroy({ where: {} });
            await db.Account.destroy({ where: {} });

            console.log('✅ Cleanup complete');
        } catch (error) {
            console.log('⚠️  Cleanup warning:', error.message);
        }
    }
}

// Export for use in testing
module.exports = BalanceCalculationTest;

// Allow running directly
if (require.main === module) {
    const test = new BalanceCalculationTest();
    test.runAllTests().then(() => {
        console.log('\nBalance calculation tests completed');
        process.exit(0);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}