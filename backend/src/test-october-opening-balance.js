/**
 * Test October opening balance fix
 */

const db = require('./models');
const controller = require('./controllers/simpleMonthlyReportController');

async function testOctoberOpeningBalance() {
    try {
        console.log('=== TESTING OCTOBER OPENING BALANCE FIX ===\n');

        // Test October 2025 real-time report
        console.log('1. Testing October 2025 Real-time Report:');
        const octoberReport = await controller.generateRealTimeReport(2025, 10, 25, false);

        console.log('October Report Data:');
        console.log(`   Month: ${octoberReport.month_name}`);
        console.log(`   Account: ${octoberReport.account_display_name}`);

        console.log('\nLedger Heads in October:');
        octoberReport.ledger_heads.forEach(ledger => {
            console.log(`   ${ledger.ledger_head.name} (${ledger.ledger_head.type}):`);
            console.log(`      Opening: ₹${ledger.opening_balance}, Closing: ₹${ledger.closing_balance}`);
            console.log(`      Credits: ₹${ledger.total_credits}, Debits: ₹${ledger.total_debits}`);
            console.log(`      Cash: ₹${ledger.cash_amount}, Bank: ₹${ledger.bank_amount}`);

            // Verify Donation ledger specifically
            if (ledger.ledger_head.name === 'Donation') {
                console.log(`\n   📊 DONATION OPENING BALANCE VERIFICATION:`);
                console.log(`      Expected Opening: ₹90 (September closing balance)`);
                console.log(`      Actual Opening: ₹${ledger.opening_balance}`);

                const openingCorrect = ledger.opening_balance == 90;
                console.log(`      ✅ Opening Balance: ${openingCorrect ? 'CORRECT!' : 'Still incorrect'}`);

                if (openingCorrect) {
                    console.log(`\n      🎉 OCTOBER OPENING BALANCE IS NOW CORRECT!`);
                    console.log(`      🔄 The system is now REAL-TIME UPDATED!`);
                }
            }
        });

        // 2. Show the calculation logic
        console.log('\n2. Opening balance calculation logic:');
        console.log('   For October, opening balance should be:');
        console.log('   September transactions up to Sept 30:');
        console.log('   - Sept 1: +₹80 donation');
        console.log('   - Sept 2: -₹25 expense from donations');
        console.log('   - Sept 29: +₹50 donation');
        console.log('   - Sept 30: -₹15 expense from donations');
        console.log('   Result: ₹80 - ₹25 + ₹50 - ₹15 = ₹90');

        console.log('\n=== OCTOBER OPENING BALANCE TEST COMPLETED ===');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Details:', error.message);
    }
}

// Run the test
testOctoberOpeningBalance().then(() => {
    console.log('\nTest complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});