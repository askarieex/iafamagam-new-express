/**
 * TEST OCTOBER REPORT FIX
 * Test to verify the October report now shows correct balances
 */

const simpleMonthlyReportController = require('./controllers/simpleMonthlyReportController');

async function testOctoberReportFix() {
    console.log('🔧 TESTING OCTOBER REPORT FIX');
    console.log('=' .repeat(80));

    const mockReq = {
        params: { year: '2025', month: '10', accountId: '25' },
        query: { all_accounts: 'false' }
    };

    const mockRes = {
        json: function(response) {
            if (response.success && response.data) {
                const data = response.data;

                console.log('📊 OCTOBER REPORT RESULTS (AFTER FIX):');
                console.log('='.repeat(50));
                console.log(`  Total Credits: ₹${data.totals.total_credits}`);
                console.log(`  Total Debits: ₹${data.totals.total_debits}`);
                console.log(`  Closing Balance: ₹${data.totals.closing_balance}`);

                const donationHead = data.credit_heads.find(ch => ch.ledger_head.name === 'Donation');
                const expenseHead = data.debit_heads.find(dh => dh.ledger_head.name === 'Expense');

                if (donationHead) {
                    console.log(`\n  📈 DONATION (Credit Head):`);
                    console.log(`    Opening Balance: ₹${donationHead.opening_balance}`);
                    console.log(`    Received During Month: ₹${donationHead.total_credits}`);
                    console.log(`    Closing Balance: ₹${donationHead.closing_balance}`);
                    console.log(`    Cash: ₹${donationHead.cash_amount}`);
                    console.log(`    Bank: ₹${donationHead.bank_amount}`);

                    // Expected: ₹100 opening + ₹350 received - ₹140 spent = ₹310 remaining
                    const expected = 100 + 350 - 140;
                    if (Math.abs(parseFloat(donationHead.closing_balance) - expected) < 0.01) {
                        console.log(`    ✅ CORRECT: Shows ₹${donationHead.closing_balance} (expected ₹${expected})`);
                    } else {
                        console.log(`    ❌ WRONG: Shows ₹${donationHead.closing_balance} (expected ₹${expected})`);
                    }
                }

                if (expenseHead) {
                    console.log(`\n  📉 EXPENSE (Debit Head):`);
                    console.log(`    Amount Spent: ₹${expenseHead.closing_balance}`);
                    console.log(`    Cash: ₹${expenseHead.cash_amount}`);
                    console.log(`    Bank: ₹${expenseHead.bank_amount}`);

                    if (parseFloat(expenseHead.closing_balance) === 140) {
                        console.log(`    ✅ CORRECT: Shows ₹140 spent in October`);
                    } else {
                        console.log(`    ❌ WRONG: Shows ₹${expenseHead.closing_balance}, expected ₹140`);
                    }
                }

                console.log('\n' + '='.repeat(80));
                console.log('🎯 VERIFICATION:');
                console.log('='.repeat(80));
                console.log('Expected October calculation:');
                console.log('  Opening: ₹100 (from September remaining)');
                console.log('  Credits: ₹350 (₹200 + ₹150)');
                console.log('  Debits: ₹140 (₹80 + ₹60)');
                console.log('  Net: ₹310 (₹100 + ₹350 - ₹140)');
                console.log('');

                if (Math.abs(parseFloat(data.totals.closing_balance) - 310) < 0.01) {
                    console.log('✅ SUCCESS: October report is now showing CORRECT balances! 🎉');
                } else {
                    console.log('❌ ERROR: October report still showing wrong balance');
                }
            }
            return this;
        },
        status: function(code) { return this; }
    };

    await simpleMonthlyReportController.generateMonthlyReport(mockReq, mockRes);
}

testOctoberReportFix().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});