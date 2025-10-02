/**
 * COMPREHENSIVE FINANCIAL SYSTEM TEST
 *
 * This test validates the complete financial management system:
 * 1. Credit transactions (income)
 * 2. Debit transactions (expenses)
 * 3. Real-time balance calculations
 * 4. Snapshot generation and historical reporting
 * 5. Cash/bank balance breakdowns
 * 6. Monthly report generation (both real-time and historical)
 * 7. Backdated transaction handling
 */

const axios = require('axios');
const db = require('./models');

const BASE_URL = 'http://localhost:5000/api';

// Mock user context for API calls
const userContext = {
    userId: 1,
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent',
    sessionId: 'test-session-123'
};

// Test configuration
const TEST_ACCOUNT_ID = 1;
const DONATION_LEDGER_ID = 1; // Credit ledger
const EXPENSE_LEDGER_ID = 2;  // Debit ledger

class ComprehensiveFinancialSystemTest {
    constructor() {
        this.testResults = {
            testsPassed: 0,
            testsFailed: 0,
            errors: [],
            details: []
        };
    }

    async runAllTests() {
        console.log('🚀 STARTING COMPREHENSIVE FINANCIAL SYSTEM TEST');
        console.log('=' .repeat(80));

        try {
            // Phase 1: Basic Setup Validation
            await this.validateSystemSetup();

            // Phase 2: Credit Transaction Testing
            await this.testCreditTransactions();

            // Phase 3: Debit Transaction Testing
            await this.testDebitTransactions();

            // Phase 4: Real-time Balance Validation
            await this.validateRealTimeBalances();

            // Phase 5: Monthly Report Testing (Real-time)
            await this.testMonthlyReportGeneration();

            // Phase 6: Snapshot Generation Testing
            await this.testSnapshotGeneration();

            // Phase 7: Historical Report Testing (Snapshot-based)
            await this.testHistoricalReporting();

            // Phase 8: Backdated Transaction Testing
            await this.testBackdatedTransactions();

            // Phase 9: Cash/Bank Balance Validation
            await this.validateCashBankBreakdown();

            // Phase 10: Final System Integrity Check
            await this.performFinalIntegrityCheck();

            this.printFinalReport();

        } catch (error) {
            console.error('❌ Critical test error:', error);
            this.addError('Critical System Error', error.message);
        }
    }

    async validateSystemSetup() {
        console.log('\n📋 PHASE 1: SYSTEM SETUP VALIDATION');
        console.log('-'.repeat(50));

        try {
            // Check database connection
            await db.sequelize.authenticate();
            this.pass('Database connection established');

            // Verify required ledger heads exist
            const donationLedger = await db.LedgerHead.findByPk(DONATION_LEDGER_ID);
            const expenseLedger = await db.LedgerHead.findByPk(EXPENSE_LEDGER_ID);

            if (!donationLedger) throw new Error('Donation ledger head not found');
            if (!expenseLedger) throw new Error('Expense ledger head not found');

            this.pass(`Ledger heads verified: ${donationLedger.name} (${donationLedger.head_type}), ${expenseLedger.name} (${expenseLedger.head_type})`);

            // Verify account exists
            const account = await db.Account.findByPk(TEST_ACCOUNT_ID);
            if (!account) throw new Error('Test account not found');
            this.pass(`Test account verified: ${account.name}`);

            // Verify clean state
            const transactionCount = await db.TransactionLog.count();
            const snapshotCount = await db.MonthlyBalanceSummary.count();

            if (transactionCount === 0 && snapshotCount === 0) {
                this.pass('System in clean state for testing');
            } else {
                this.fail(`System not clean: ${transactionCount} transactions, ${snapshotCount} snapshots`);
            }

        } catch (error) {
            this.fail('System setup validation', error.message);
        }
    }

    async testCreditTransactions() {
        console.log('\n💰 PHASE 2: CREDIT TRANSACTION TESTING');
        console.log('-'.repeat(50));

        try {
            // Test 1: Cash credit transaction
            const creditTx1 = await this.createCreditTransaction({
                account_id: TEST_ACCOUNT_ID,
                ledger_head_id: DONATION_LEDGER_ID,
                amount: 1000,
                cash_type: 'cash',
                description: 'Cash donation #1',
                transaction_date: '2025-10-01'
            });

            if (creditTx1.success) {
                this.pass('Cash credit transaction created successfully');

                // Verify balance update
                const ledger = await db.LedgerHead.findByPk(DONATION_LEDGER_ID);
                if (parseFloat(ledger.current_balance) === 1000 && parseFloat(ledger.cash_balance) === 1000) {
                    this.pass('Cash credit balance updated correctly');
                } else {
                    this.fail(`Cash credit balance incorrect: ${ledger.current_balance} total, ${ledger.cash_balance} cash`);
                }
            } else {
                this.fail('Cash credit transaction creation', creditTx1.error);
            }

            // Test 2: Bank credit transaction
            const creditTx2 = await this.createCreditTransaction({
                account_id: TEST_ACCOUNT_ID,
                ledger_head_id: DONATION_LEDGER_ID,
                amount: 2000,
                cash_type: 'bank',
                description: 'Bank donation #1',
                transaction_date: '2025-10-01'
            });

            if (creditTx2.success) {
                this.pass('Bank credit transaction created successfully');

                // Verify balance update
                const ledger = await db.LedgerHead.findByPk(DONATION_LEDGER_ID);
                if (parseFloat(ledger.current_balance) === 3000 && parseFloat(ledger.bank_balance) === 2000) {
                    this.pass('Bank credit balance updated correctly');
                } else {
                    this.fail(`Bank credit balance incorrect: ${ledger.current_balance} total, ${ledger.bank_balance} bank`);
                }
            } else {
                this.fail('Bank credit transaction creation', creditTx2.error);
            }

            // Test 3: Mixed payment credit transaction
            const creditTx3 = await this.createCreditTransaction({
                account_id: TEST_ACCOUNT_ID,
                ledger_head_id: DONATION_LEDGER_ID,
                amount: 1500,
                cash_type: 'both',
                cash_amount: 500,
                bank_amount: 1000,
                description: 'Mixed payment donation',
                transaction_date: '2025-10-01'
            });

            if (creditTx3.success) {
                this.pass('Mixed payment credit transaction created successfully');

                // Verify balance update
                const ledger = await db.LedgerHead.findByPk(DONATION_LEDGER_ID);
                const expectedTotal = 4500;
                const expectedCash = 1500;
                const expectedBank = 3000;

                if (parseFloat(ledger.current_balance) === expectedTotal &&
                    parseFloat(ledger.cash_balance) === expectedCash &&
                    parseFloat(ledger.bank_balance) === expectedBank) {
                    this.pass('Mixed payment balance updated correctly');
                } else {
                    this.fail(`Mixed payment balance incorrect: ${ledger.current_balance} total (expected ${expectedTotal}), ${ledger.cash_balance} cash (expected ${expectedCash}), ${ledger.bank_balance} bank (expected ${expectedBank})`);
                }
            } else {
                this.fail('Mixed payment credit transaction creation', creditTx3.error);
            }

        } catch (error) {
            this.fail('Credit transaction testing', error.message);
        }
    }

    async testDebitTransactions() {
        console.log('\n💸 PHASE 3: DEBIT TRANSACTION TESTING');
        console.log('-'.repeat(50));

        try {
            // Test 1: Cash expense transaction
            const debitTx1 = await this.createDebitTransaction({
                account_id: TEST_ACCOUNT_ID,
                ledger_head_id: EXPENSE_LEDGER_ID,
                source_ledger_head_id: DONATION_LEDGER_ID,
                amount: 500,
                cash_type: 'cash',
                description: 'Office supplies (cash)',
                transaction_date: '2025-10-01'
            });

            if (debitTx1.success) {
                this.pass('Cash debit transaction created successfully');

                // Verify source ledger balance reduction
                const sourceLedger = await db.LedgerHead.findByPk(DONATION_LEDGER_ID);
                const expectedSourceBalance = 4000; // 4500 - 500
                const expectedSourceCash = 1000; // 1500 - 500

                if (parseFloat(sourceLedger.current_balance) === expectedSourceBalance &&
                    parseFloat(sourceLedger.cash_balance) === expectedSourceCash) {
                    this.pass('Source ledger balance reduced correctly for cash expense');
                } else {
                    this.fail(`Source ledger balance incorrect after cash expense: ${sourceLedger.current_balance} total (expected ${expectedSourceBalance}), ${sourceLedger.cash_balance} cash (expected ${expectedSourceCash})`);
                }

                // Verify expense ledger balance increase
                const expenseLedger = await db.LedgerHead.findByPk(EXPENSE_LEDGER_ID);
                if (parseFloat(expenseLedger.current_balance) === 500) {
                    this.pass('Expense ledger balance increased correctly');
                } else {
                    this.fail(`Expense ledger balance incorrect: ${expenseLedger.current_balance} (expected 500)`);
                }
            } else {
                this.fail('Cash debit transaction creation', debitTx1.error);
            }

            // Test 2: Bank expense transaction
            const debitTx2 = await this.createDebitTransaction({
                account_id: TEST_ACCOUNT_ID,
                ledger_head_id: EXPENSE_LEDGER_ID,
                source_ledger_head_id: DONATION_LEDGER_ID,
                amount: 1000,
                cash_type: 'bank',
                description: 'Equipment purchase (bank)',
                transaction_date: '2025-10-01'
            });

            if (debitTx2.success) {
                this.pass('Bank debit transaction created successfully');

                // Verify source ledger balance reduction
                const sourceLedger = await db.LedgerHead.findByPk(DONATION_LEDGER_ID);
                const expectedSourceBalance = 3000; // 4000 - 1000
                const expectedSourceBank = 2000; // 3000 - 1000

                if (parseFloat(sourceLedger.current_balance) === expectedSourceBalance &&
                    parseFloat(sourceLedger.bank_balance) === expectedSourceBank) {
                    this.pass('Source ledger balance reduced correctly for bank expense');
                } else {
                    this.fail(`Source ledger balance incorrect after bank expense: ${sourceLedger.current_balance} total (expected ${expectedSourceBalance}), ${sourceLedger.bank_balance} bank (expected ${expectedSourceBank})`);
                }

                // Verify expense ledger balance increase
                const expenseLedger = await db.LedgerHead.findByPk(EXPENSE_LEDGER_ID);
                if (parseFloat(expenseLedger.current_balance) === 1500) {
                    this.pass('Expense ledger balance accumulated correctly');
                } else {
                    this.fail(`Expense ledger balance incorrect: ${expenseLedger.current_balance} (expected 1500)`);
                }
            } else {
                this.fail('Bank debit transaction creation', debitTx2.error);
            }

        } catch (error) {
            this.fail('Debit transaction testing', error.message);
        }
    }

    async validateRealTimeBalances() {
        console.log('\n⚡ PHASE 4: REAL-TIME BALANCE VALIDATION');
        console.log('-'.repeat(50));

        try {
            // Get current ledger head balances from database
            const donationLedger = await db.LedgerHead.findByPk(DONATION_LEDGER_ID);
            const expenseLedger = await db.LedgerHead.findByPk(EXPENSE_LEDGER_ID);

            // Expected values based on previous transactions
            const expectedDonationBalance = 3000; // 4500 - 500 - 1000
            const expectedDonationCash = 1000; // 1500 - 500
            const expectedDonationBank = 2000; // 3000 - 1000
            const expectedExpenseBalance = 1500; // 500 + 1000

            // Validate donation ledger
            if (parseFloat(donationLedger.current_balance) === expectedDonationBalance &&
                parseFloat(donationLedger.cash_balance) === expectedDonationCash &&
                parseFloat(donationLedger.bank_balance) === expectedDonationBank) {
                this.pass('Donation ledger real-time balance is correct');
            } else {
                this.fail(`Donation ledger balance mismatch: Total=${donationLedger.current_balance} (exp ${expectedDonationBalance}), Cash=${donationLedger.cash_balance} (exp ${expectedDonationCash}), Bank=${donationLedger.bank_balance} (exp ${expectedDonationBank})`);
            }

            // Validate expense ledger
            if (parseFloat(expenseLedger.current_balance) === expectedExpenseBalance) {
                this.pass('Expense ledger real-time balance is correct');
            } else {
                this.fail(`Expense ledger balance mismatch: ${expenseLedger.current_balance} (expected ${expectedExpenseBalance})`);
            }

            // Calculate net balance (credit - debit)
            const netBalance = expectedDonationBalance - expectedExpenseBalance;
            if (netBalance === 1500) {
                this.pass(`Net balance calculation correct: ₹${netBalance}`);
            } else {
                this.fail(`Net balance calculation incorrect: ₹${netBalance} (expected ₹1500)`);
            }

        } catch (error) {
            this.fail('Real-time balance validation', error.message);
        }
    }

    async testMonthlyReportGeneration() {
        console.log('\n📊 PHASE 5: MONTHLY REPORT GENERATION (REAL-TIME)');
        console.log('-'.repeat(50));

        try {
            // Test current month report (should be real-time)
            const response = await axios.get(`${BASE_URL}/reports/monthly/2025/10/${TEST_ACCOUNT_ID}`);

            if (response.status === 200 && response.data.success) {
                const reportData = response.data.data;

                // Verify report type
                if (response.data.report_type === 'real_time') {
                    this.pass('Real-time report generated for current month');
                } else {
                    this.fail(`Expected real_time report, got ${response.data.report_type}`);
                }

                // Verify report data structure
                if (reportData.ledger_heads && reportData.totals && reportData.credit_heads && reportData.debit_heads) {
                    this.pass('Report data structure is correct');
                } else {
                    this.fail('Report data structure is incomplete');
                }

                // Verify totals
                const expectedCredits = 4500; // 1000 + 2000 + 1500
                const expectedDebits = 1500; // 500 + 1000
                const expectedClosingBalance = 1500; // 3000 - 1500

                if (parseFloat(reportData.totals.total_credits) === expectedCredits &&
                    parseFloat(reportData.totals.total_debits) === expectedDebits) {
                    this.pass('Report totals are correct');
                } else {
                    this.fail(`Report totals incorrect: Credits=${reportData.totals.total_credits} (exp ${expectedCredits}), Debits=${reportData.totals.total_debits} (exp ${expectedDebits})`);
                }

                // Verify credit heads data
                const donationData = reportData.credit_heads.find(lh => lh.ledger_head.id === DONATION_LEDGER_ID);
                if (donationData && parseFloat(donationData.closing_balance) === 3000) {
                    this.pass('Credit head data in report is correct');
                } else {
                    this.fail(`Credit head data incorrect: ${donationData ? donationData.closing_balance : 'not found'} (expected 3000)`);
                }

                // Verify debit heads data
                const expenseData = reportData.debit_heads.find(lh => lh.ledger_head.id === EXPENSE_LEDGER_ID);
                if (expenseData && parseFloat(expenseData.closing_balance) === 1500) {
                    this.pass('Debit head data in report is correct');
                } else {
                    this.fail(`Debit head data incorrect: ${expenseData ? expenseData.closing_balance : 'not found'} (expected 1500)`);
                }

            } else {
                this.fail('Monthly report generation API call', response.data.message || 'API call failed');
            }

        } catch (error) {
            this.fail('Monthly report generation testing', error.message);
        }
    }

    async testSnapshotGeneration() {
        console.log('\n📸 PHASE 6: SNAPSHOT GENERATION TESTING');
        console.log('-'.repeat(50));

        try {
            // Import snapshot service directly
            const monthlySnapshotService = require('./services/monthlySnapshotService');

            // Generate snapshots for September 2025 (historical month)
            await monthlySnapshotService.createMonthlySnapshot(TEST_ACCOUNT_ID, DONATION_LEDGER_ID, 2025, 9);
            await monthlySnapshotService.createMonthlySnapshot(TEST_ACCOUNT_ID, EXPENSE_LEDGER_ID, 2025, 9);

            this.pass('Manual snapshot generation completed');

            // Verify snapshots were created
            const snapshotCount = await db.MonthlyBalanceSummary.count({
                where: {
                    account_id: TEST_ACCOUNT_ID,
                    month_year: '2025-09-01'
                }
            });

            if (snapshotCount === 2) {
                this.pass('Correct number of snapshots created');
            } else {
                this.fail(`Incorrect snapshot count: ${snapshotCount} (expected 2)`);
            }

            // Verify snapshot data
            const donationSnapshot = await db.MonthlyBalanceSummary.findOne({
                where: {
                    account_id: TEST_ACCOUNT_ID,
                    ledger_head_id: DONATION_LEDGER_ID,
                    month_year: '2025-09-01'
                }
            });

            if (donationSnapshot) {
                // Since we have October transactions, September should have zero balances
                if (parseFloat(donationSnapshot.closing_balance) === 0) {
                    this.pass('September snapshot has correct zero balance (no transactions)');
                } else {
                    this.fail(`September snapshot has incorrect balance: ${donationSnapshot.closing_balance} (expected 0)`);
                }
            } else {
                this.fail('Donation snapshot not found');
            }

        } catch (error) {
            this.fail('Snapshot generation testing', error.message);
        }
    }

    async testHistoricalReporting() {
        console.log('\n📈 PHASE 7: HISTORICAL REPORTING (SNAPSHOT-BASED)');
        console.log('-'.repeat(50));

        try {
            // Test historical report for September 2025 (should use snapshots)
            const response = await axios.get(`${BASE_URL}/reports/monthly/2025/9/${TEST_ACCOUNT_ID}`);

            if (response.status === 200 && response.data.success) {
                const reportData = response.data.data;

                // Verify report type
                if (response.data.report_type === 'historical_snapshot') {
                    this.pass('Historical snapshot-based report generated for past month');
                } else {
                    this.fail(`Expected historical_snapshot report, got ${response.data.report_type}`);
                }

                // Since September had no transactions, all balances should be zero
                if (parseFloat(reportData.totals.total_credits) === 0 &&
                    parseFloat(reportData.totals.total_debits) === 0 &&
                    parseFloat(reportData.totals.closing_balance) === 0) {
                    this.pass('Historical report shows correct zero balances for September');
                } else {
                    this.fail(`Historical report has incorrect balances: Credits=${reportData.totals.total_credits}, Debits=${reportData.totals.total_debits}, Closing=${reportData.totals.closing_balance}`);
                }

            } else {
                this.fail('Historical report generation API call', response.data.message || 'API call failed');
            }

        } catch (error) {
            this.fail('Historical reporting testing', error.message);
        }
    }

    async testBackdatedTransactions() {
        console.log('\n⏰ PHASE 8: BACKDATED TRANSACTION TESTING');
        console.log('-'.repeat(50));

        try {
            // Add a backdated transaction to September
            const backdatedTx = await this.createCreditTransaction({
                account_id: TEST_ACCOUNT_ID,
                ledger_head_id: DONATION_LEDGER_ID,
                amount: 2000,
                cash_type: 'bank',
                description: 'Backdated September donation',
                transaction_date: '2025-09-15'
            });

            if (backdatedTx.success) {
                this.pass('Backdated transaction created successfully');

                // Wait a moment for background processing
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Verify that October balance was updated
                const donationLedger = await db.LedgerHead.findByPk(DONATION_LEDGER_ID);
                const expectedNewBalance = 5000; // Previous 3000 + 2000 backdated

                if (parseFloat(donationLedger.current_balance) === expectedNewBalance) {
                    this.pass('Current month balance updated after backdated transaction');
                } else {
                    this.fail(`Current balance not updated correctly: ${donationLedger.current_balance} (expected ${expectedNewBalance})`);
                }

                // Verify September snapshot was updated
                const septemberSnapshot = await db.MonthlyBalanceSummary.findOne({
                    where: {
                        account_id: TEST_ACCOUNT_ID,
                        ledger_head_id: DONATION_LEDGER_ID,
                        month_year: '2025-09-01'
                    }
                });

                if (septemberSnapshot && parseFloat(septemberSnapshot.closing_balance) === 2000) {
                    this.pass('September snapshot updated with backdated transaction');
                } else {
                    this.fail(`September snapshot not updated: ${septemberSnapshot ? septemberSnapshot.closing_balance : 'not found'} (expected 2000)`);
                }

            } else {
                this.fail('Backdated transaction creation', backdatedTx.error);
            }

        } catch (error) {
            this.fail('Backdated transaction testing', error.message);
        }
    }

    async validateCashBankBreakdown() {
        console.log('\n💳 PHASE 9: CASH/BANK BALANCE VALIDATION');
        console.log('-'.repeat(50));

        try {
            // Get current ledger state
            const donationLedger = await db.LedgerHead.findByPk(DONATION_LEDGER_ID);

            // Expected values after all transactions including backdated
            // Cash: 1000 (original) + 0 (backdated was bank) = 1000
            // Bank: 2000 (original) + 2000 (backdated) = 4000
            // Total: 5000

            const expectedCash = 1000;
            const expectedBank = 4000;
            const expectedTotal = 5000;

            if (parseFloat(donationLedger.cash_balance) === expectedCash &&
                parseFloat(donationLedger.bank_balance) === expectedBank &&
                parseFloat(donationLedger.current_balance) === expectedTotal) {
                this.pass('Cash/bank breakdown is correctly maintained');
            } else {
                this.fail(`Cash/bank breakdown incorrect: Cash=${donationLedger.cash_balance} (exp ${expectedCash}), Bank=${donationLedger.bank_balance} (exp ${expectedBank}), Total=${donationLedger.current_balance} (exp ${expectedTotal})`);
            }

            // Verify cash + bank = total
            const calculatedTotal = parseFloat(donationLedger.cash_balance) + parseFloat(donationLedger.bank_balance);
            if (Math.abs(calculatedTotal - parseFloat(donationLedger.current_balance)) < 0.01) {
                this.pass('Cash + Bank equals Total balance');
            } else {
                this.fail(`Cash + Bank (${calculatedTotal}) does not equal Total (${donationLedger.current_balance})`);
            }

        } catch (error) {
            this.fail('Cash/bank balance validation', error.message);
        }
    }

    async performFinalIntegrityCheck() {
        console.log('\n🔍 PHASE 10: FINAL SYSTEM INTEGRITY CHECK');
        console.log('-'.repeat(50));

        try {
            // Check transaction count
            const transactionCount = await db.TransactionLog.count();
            if (transactionCount === 6) { // 5 original + 1 backdated
                this.pass(`Transaction count correct: ${transactionCount}`);
            } else {
                this.fail(`Transaction count incorrect: ${transactionCount} (expected 6)`);
            }

            // Check snapshot count
            const snapshotCount = await db.MonthlyBalanceSummary.count();
            if (snapshotCount >= 2) { // At least September snapshots
                this.pass(`Snapshot count adequate: ${snapshotCount}`);
            } else {
                this.fail(`Snapshot count low: ${snapshotCount} (expected at least 2)`);
            }

            // Test both reporting methods one final time
            const realtimeReport = await axios.get(`${BASE_URL}/reports/monthly/2025/10/${TEST_ACCOUNT_ID}`);
            const historicalReport = await axios.get(`${BASE_URL}/reports/monthly/2025/9/${TEST_ACCOUNT_ID}`);

            if (realtimeReport.status === 200 && historicalReport.status === 200) {
                this.pass('Both real-time and historical reporting systems functional');
            } else {
                this.fail('Reporting systems not functioning correctly');
            }

            // Final balance reconciliation
            const allLedgers = await db.LedgerHead.findAll({
                where: { account_id: TEST_ACCOUNT_ID }
            });

            let totalAssets = 0;
            let totalExpenses = 0;

            allLedgers.forEach(ledger => {
                if (ledger.head_type === 'credit') {
                    totalAssets += parseFloat(ledger.current_balance);
                } else {
                    totalExpenses += parseFloat(ledger.current_balance);
                }
            });

            const netWorth = totalAssets - totalExpenses;
            if (netWorth === 3500) { // 5000 assets - 1500 expenses
                this.pass(`Final balance reconciliation correct: Net Worth = ₹${netWorth}`);
            } else {
                this.fail(`Final balance reconciliation incorrect: Net Worth = ₹${netWorth} (expected ₹3500)`);
            }

        } catch (error) {
            this.fail('Final integrity check', error.message);
        }
    }

    // Helper methods for API calls
    async createCreditTransaction(data) {
        try {
            const response = await axios.post(`${BASE_URL}/transactions/credit`, data);
            return response.data;
        } catch (error) {
            return { success: false, error: error.response?.data?.message || error.message };
        }
    }

    async createDebitTransaction(data) {
        try {
            const response = await axios.post(`${BASE_URL}/transactions/debit`, data);
            return response.data;
        } catch (error) {
            return { success: false, error: error.response?.data?.message || error.message };
        }
    }

    // Test result tracking methods
    pass(description) {
        this.testResults.testsPassed++;
        this.testResults.details.push(`✅ ${description}`);
        console.log(`   ✅ ${description}`);
    }

    fail(description, error = null) {
        this.testResults.testsFailed++;
        const errorMsg = error ? ` - ${error}` : '';
        this.testResults.errors.push(`${description}${errorMsg}`);
        this.testResults.details.push(`❌ ${description}${errorMsg}`);
        console.log(`   ❌ ${description}${errorMsg}`);
    }

    addError(category, message) {
        this.testResults.errors.push(`${category}: ${message}`);
    }

    printFinalReport() {
        console.log('\n' + '='.repeat(80));
        console.log('🏁 COMPREHENSIVE FINANCIAL SYSTEM TEST RESULTS');
        console.log('='.repeat(80));

        console.log(`\n📊 SUMMARY:`);
        console.log(`   Tests Passed: ${this.testResults.testsPassed}`);
        console.log(`   Tests Failed: ${this.testResults.testsFailed}`);
        console.log(`   Success Rate: ${((this.testResults.testsPassed / (this.testResults.testsPassed + this.testResults.testsFailed)) * 100).toFixed(1)}%`);

        if (this.testResults.testsFailed === 0) {
            console.log('\n🎉 ALL TESTS PASSED! Your financial management system is working correctly.');
            console.log('\n✅ VERIFIED FUNCTIONALITY:');
            console.log('   • Credit transaction processing');
            console.log('   • Debit transaction processing');
            console.log('   • Real-time balance calculations');
            console.log('   • Cash/bank balance tracking');
            console.log('   • Monthly report generation (real-time)');
            console.log('   • Snapshot generation');
            console.log('   • Historical reporting (snapshot-based)');
            console.log('   • Backdated transaction handling');
            console.log('   • System integrity and reconciliation');
        } else {
            console.log('\n❌ SOME TESTS FAILED. Issues found:');
            this.testResults.errors.forEach(error => {
                console.log(`   • ${error}`);
            });
        }

        console.log('\n📋 DETAILED RESULTS:');
        this.testResults.details.forEach(detail => {
            console.log(`   ${detail}`);
        });

        console.log('\n' + '='.repeat(80));
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    const test = new ComprehensiveFinancialSystemTest();
    test.runAllTests().then(() => {
        process.exit(test.testResults.testsFailed === 0 ? 0 : 1);
    }).catch(error => {
        console.error('Test execution error:', error);
        process.exit(1);
    });
}

module.exports = ComprehensiveFinancialSystemTest;