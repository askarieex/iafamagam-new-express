/**
 * TEST FIXED BALANCE CALCULATIONS
 *
 * This script tests the fixed balance calculation logic to ensure:
 * 1. September shows correct remaining balance (₹75 - ₹25 = ₹50)
 * 2. October shows correct opening balance (₹50 from September)
 * 3. October shows correct remaining balance after expenses
 */

const simpleMonthlyReportController = require('./controllers/simpleMonthlyReportController');

async function testFixedBalanceCalculations() {
    console.log('🔬 TESTING FIXED BALANCE CALCULATIONS');
    console.log('=' .repeat(80));

    try {
        // Test September 2025 report
        console.log('\n📅 TESTING SEPTEMBER 2025 REPORT:');
        console.log('-'.repeat(50));

        const mockReqSep = {
            params: { year: '2025', month: '9', accountId: '25' },
            query: { all_accounts: 'false' }
        };

        const mockRes = {
            json: function(response) {
                if (response.success && response.data) {
                    const data = response.data;

                    console.log('📊 SEPTEMBER RESULTS:');
                    console.log(`  Total Credits: ₹${data.totals.total_credits}`);
                    console.log(`  Total Debits: ₹${data.totals.total_debits}`);
                    console.log(`  Closing Balance: ₹${data.totals.closing_balance}`);

                    // Check credit heads (Donation)
                    const donationHead = data.credit_heads.find(ch => ch.ledger_head.name === 'Donation');
                    if (donationHead) {
                        console.log(`\n  📈 DONATION (Credit Head):`);
                        console.log(`    Opening Balance: ₹${donationHead.opening_balance}`);
                        console.log(`    Received During Month: ₹${donationHead.total_credits}`);
                        console.log(`    Closing Balance: ₹${donationHead.closing_balance}`);

                        // Expected: ₹75 received - ₹25 spent = ₹50 remaining
                        if (parseFloat(donationHead.closing_balance) === 50) {
                            console.log(`    ✅ CORRECT: Shows ₹50 remaining after ₹25 expense`);
                        } else {
                            console.log(`    ❌ WRONG: Shows ₹${donationHead.closing_balance}, expected ₹50`);
                        }
                    }

                    // Check debit heads (Expense)
                    const expenseHead = data.debit_heads.find(dh => dh.ledger_head.name === 'Expense');
                    if (expenseHead) {
                        console.log(`\n  📉 EXPENSE (Debit Head):`);
                        console.log(`    Amount Spent: ₹${expenseHead.closing_balance}`);

                        if (parseFloat(expenseHead.closing_balance) === 25) {
                            console.log(`    ✅ CORRECT: Shows ₹25 spent`);
                        } else {
                            console.log(`    ❌ WRONG: Shows ₹${expenseHead.closing_balance}, expected ₹25`);
                        }
                    }
                }
                return this;
            },
            status: function(code) {
                return this;
            }
        };

        await simpleMonthlyReportController.generateMonthlyReport(mockReqSep, mockRes);

        // Test October 2025 report
        console.log('\n\n📅 TESTING OCTOBER 2025 REPORT:');
        console.log('-'.repeat(50));

        const mockReqOct = {
            params: { year: '2025', month: '10', accountId: '25' },
            query: { all_accounts: 'false' }
        };

        const mockResOct = {
            json: function(response) {
                if (response.success && response.data) {
                    const data = response.data;

                    console.log('📊 OCTOBER RESULTS:');
                    console.log(`  Total Credits: ₹${data.totals.total_credits}`);
                    console.log(`  Total Debits: ₹${data.totals.total_debits}`);
                    console.log(`  Closing Balance: ₹${data.totals.closing_balance}`);

                    // Check credit heads (Donation)
                    const donationHead = data.credit_heads.find(ch => ch.ledger_head.name === 'Donation');
                    if (donationHead) {
                        console.log(`\n  📈 DONATION (Credit Head):`);
                        console.log(`    Opening Balance: ₹${donationHead.opening_balance}`);
                        console.log(`    Received During Month: ₹${donationHead.total_credits}`);
                        console.log(`    Closing Balance: ₹${donationHead.closing_balance}`);

                        // Expected opening: ₹50 (remaining from September)
                        if (parseFloat(donationHead.opening_balance) === 50) {
                            console.log(`    ✅ CORRECT: Opening balance ₹50 (carried from September)`);
                        } else {
                            console.log(`    ❌ WRONG: Opening balance ₹${donationHead.opening_balance}, expected ₹50`);
                        }

                        // Expected closing: ₹50 + ₹150 - ₹50 = ₹150
                        // But should show NET remaining after all expenses
                        const expectedClosing = parseFloat(donationHead.opening_balance) + parseFloat(donationHead.total_credits) - 50; // ₹50 spent in October
                        console.log(`    Expected closing (₹${donationHead.opening_balance} + ₹${donationHead.total_credits} - ₹50): ₹${expectedClosing}`);

                        if (Math.abs(parseFloat(donationHead.closing_balance) - expectedClosing) < 0.01) {
                            console.log(`    ✅ CORRECT: Closing balance calculation is accurate`);
                        } else {
                            console.log(`    ❌ WRONG: Closing balance ₹${donationHead.closing_balance}, expected ₹${expectedClosing}`);
                        }
                    }

                    // Check debit heads (Expense)
                    const expenseHead = data.debit_heads.find(dh => dh.ledger_head.name === 'Expense');
                    if (expenseHead) {
                        console.log(`\n  📉 EXPENSE (Debit Head):`);
                        console.log(`    Amount Spent in October: ₹${expenseHead.closing_balance}`);

                        if (parseFloat(expenseHead.closing_balance) === 50) {
                            console.log(`    ✅ CORRECT: Shows ₹50 spent in October`);
                        } else {
                            console.log(`    ❌ WRONG: Shows ₹${expenseHead.closing_balance}, expected ₹50`);
                        }
                    }
                }
                return this;
            },
            status: function(code) {
                return this;
            }
        };

        await simpleMonthlyReportController.generateMonthlyReport(mockReqOct, mockResOct);

        console.log('\n' + '='.repeat(80));
        console.log('🎯 SUMMARY OF EXPECTED BEHAVIOR:');
        console.log('='.repeat(80));
        console.log('📅 SEPTEMBER 2025:');
        console.log('   • Donation Opening: ₹0');
        console.log('   • Donation Received: ₹75');
        console.log('   • Expense Spent: ₹25');
        console.log('   • Donation Remaining: ₹50 (₹75 - ₹25)');
        console.log('');
        console.log('📅 OCTOBER 2025:');
        console.log('   • Donation Opening: ₹50 (carried from September)');
        console.log('   • Donation Received: ₹150');
        console.log('   • Expense Spent: ₹50');
        console.log('   • Donation Remaining: ₹150 (₹50 + ₹150 - ₹50)');
        console.log('');
        console.log('✅ This ensures SECURE balance tracking with NO phantom money!');

    } catch (error) {
        console.error('❌ Test error:', error.message);
    }
}

testFixedBalanceCalculations().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Test execution error:', error);
    process.exit(1);
});