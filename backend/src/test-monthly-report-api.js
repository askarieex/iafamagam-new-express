/**
 * Test the monthly report generation directly to see what data is being returned
 */

const db = require('./models');
const controller = require('./controllers/simpleMonthlyReportController');

async function testMonthlyReportGeneration() {
    try {
        console.log('=== TESTING MONTHLY REPORT GENERATION ===\n');

        // Test August 2025 report
        console.log('1. Testing August 2025 Historical Report:');
        const augustReport = await controller.generateHistoricalReport(2025, 8, 25, false);

        console.log('August Report Data:');
        console.log(`   Report Type: ${augustReport.report_type}`);
        console.log(`   Month: ${augustReport.month_name}`);
        console.log(`   Account: ${augustReport.account_display_name}`);

        console.log('\nLedger Heads in August:');
        augustReport.ledger_heads.forEach(ledger => {
            console.log(`   ${ledger.ledger_head.name} (${ledger.ledger_head.type}):`);
            console.log(`      Opening: ₹${ledger.opening_balance}, Closing: ₹${ledger.closing_balance}`);
            console.log(`      Credits: ₹${ledger.total_credits}, Debits: ₹${ledger.total_debits}`);
            console.log(`      Cash: ₹${ledger.cash_amount}, Bank: ₹${ledger.bank_amount}`);
        });

        // Test September 2025 report
        console.log('\n2. Testing September 2025 Real-time Report:');
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
        });

        console.log('\n3. Comparing the two reports:');
        console.log('   This should show the differences between August and September');

        console.log('\n=== TEST COMPLETED ===');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Details:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testMonthlyReportGeneration().then(() => {
    console.log('\nTest complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});