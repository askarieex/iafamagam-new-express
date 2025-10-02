/**
 * Final test of monthly report API with corrected cash/bank breakdown
 */

const db = require('./models');
const controller = require('./controllers/simpleMonthlyReportController');

async function testFinalMonthlyReport() {
    try {
        console.log('=== FINAL MONTHLY REPORT API TEST ===\n');

        // Test September 2025 real-time report (should show correct cash/bank breakdown)
        console.log('1. Testing September 2025 Real-time Report:');
        const septemberReport = await controller.generateRealTimeReport(2025, 9, 25, false);

        console.log('September Report Data:');
        console.log(`   Month: ${septemberReport.month_name}`);
        console.log(`   Account: ${septemberReport.account_display_name}`);

        console.log('\nLedger Heads in September:');
        septemberReport.ledger_heads.forEach(ledger => {
            console.log(`   ${ledger.ledger_head.name} (${ledger.ledger_head.type}):`);
            console.log(`      Opening: ₹${ledger.opening_balance}, Closing: ₹${ledger.closing_balance}`);
            console.log(`      Credits: ₹${ledger.total_credits}, Debits: ₹${ledger.total_debits}`);
            console.log(`      Cash: ₹${ledger.cash_amount}, Bank: ₹${ledger.bank_amount}`);

            // Verify Donation ledger specifically
            if (ledger.ledger_head.name === 'Donation') {
                console.log(`\n   📊 DONATION VERIFICATION:`);
                console.log(`      Expected: Total ₹125, Cash ₹75, Bank ₹50`);
                console.log(`      Actual: Total ₹${ledger.closing_balance}, Cash ₹${ledger.cash_amount}, Bank ₹${ledger.bank_amount}`);

                const totalCorrect = ledger.closing_balance == 125;
                const cashCorrect = ledger.cash_amount == 75;
                const bankCorrect = ledger.bank_amount == 50;

                console.log(`      ✅ Total: ${totalCorrect ? 'CORRECT' : 'INCORRECT'}`);
                console.log(`      ✅ Cash: ${cashCorrect ? 'CORRECT' : 'INCORRECT'}`);
                console.log(`      ✅ Bank: ${bankCorrect ? 'CORRECT' : 'INCORRECT'}`);

                if (totalCorrect && cashCorrect && bankCorrect) {
                    console.log(`\n      🎉 MONTHLY REPORT CASH/BANK IS PERFECT!`);
                }
            }
        });

        // 2. Show transaction breakdown for reference
        console.log('\n2. Transaction breakdown for reference:');
        console.log('   Sept 15: +₹80 (₹50 cash + ₹30 bank) donation');
        console.log('   Sept 16: -₹25 (₹15 cash + ₹10 bank) expense from donations');
        console.log('   Sept 29: +₹100 (₹60 cash + ₹40 bank) donation');
        console.log('   Sept 30: -₹30 (₹20 cash + ₹10 bank) expense from donations');
        console.log('   Result: ₹125 total (₹75 cash + ₹50 bank)');

        console.log('\n=== FINAL MONTHLY REPORT TEST COMPLETED ===');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Details:', error.message);
    }
}

// Run the test
testFinalMonthlyReport().then(() => {
    console.log('\nTest complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});