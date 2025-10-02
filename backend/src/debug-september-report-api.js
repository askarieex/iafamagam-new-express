/**
 * DEBUG SEPTEMBER REPORT API RESPONSE
 */

const simpleMonthlyReportController = require('./controllers/simpleMonthlyReportController');

async function debugSeptemberReport() {
    console.log('🔍 DEBUG: SEPTEMBER REPORT API RESPONSE');
    console.log('=' .repeat(60));

    try {
        // Generate the exact same report that API would return
        const mockReq = {
            params: { year: '2025', month: '9', accountId: '25' },
            query: { all_accounts: 'false' }
        };

        const mockRes = {
            json: function(response) {
                console.log('📊 API RESPONSE STRUCTURE:');
                console.log('Success:', response.success);
                console.log('Report Type:', response.report_type);
                console.log('Message:', response.message);

                if (response.success && response.data) {
                    const data = response.data;

                    console.log('\n📋 RESPONSE DATA:');
                    console.log('Year:', data.year);
                    console.log('Month:', data.month);
                    console.log('Month Name:', data.month_name);

                    console.log('\n📊 TOTALS:');
                    console.log('  Opening Balance:', data.totals.opening_balance);
                    console.log('  Total Credits:', data.totals.total_credits);
                    console.log('  Total Debits:', data.totals.total_debits);
                    console.log('  Closing Balance:', data.totals.closing_balance);
                    console.log('  Transaction Count:', data.totals.transaction_count);

                    console.log('\n📋 ALL LEDGER HEADS:');
                    data.ledger_heads.forEach(lh => {
                        console.log(`  ${lh.ledger_head.name} (${lh.ledger_head.type}):`);
                        console.log(`    Opening Balance: ₹${lh.opening_balance}`);
                        console.log(`    Total Credits: ₹${lh.total_credits}`);
                        console.log(`    Total Debits: ₹${lh.total_debits}`);
                        console.log(`    Closing Balance: ₹${lh.closing_balance}`);
                        console.log(`    Cash Amount: ₹${lh.cash_amount}`);
                        console.log(`    Bank Amount: ₹${lh.bank_amount}`);
                        console.log(`    Transaction Count: ${lh.transaction_count}`);
                    });

                    console.log('\n📈 CREDIT HEADS:');
                    data.credit_heads.forEach(ch => {
                        console.log(`  ${ch.ledger_head.name}: Balance=₹${ch.closing_balance}, Cash=₹${ch.cash_amount}, Bank=₹${ch.bank_amount}`);
                    });

                    console.log('\n📉 DEBIT HEADS:');
                    data.debit_heads.forEach(dh => {
                        console.log(`  ${dh.ledger_head.name}: Balance=₹${dh.closing_balance}, Cash=₹${dh.cash_amount}, Bank=₹${dh.bank_amount}`);
                    });

                    console.log('\n🔍 FRONTEND DISPLAY MAPPING:');
                    console.log('For your frontend table:');
                    data.credit_heads.forEach(ch => {
                        console.log(`  ${ch.ledger_head.name}: BALANCE column should show ₹${ch.closing_balance}`);
                    });
                    data.debit_heads.forEach(dh => {
                        console.log(`  ${dh.ledger_head.name}: BALANCE column should show ₹${dh.closing_balance}`);
                    });
                }

                return this;
            },
            status: function(code) {
                console.log('HTTP Status:', code);
                return this;
            }
        };

        // Call the actual controller method
        await simpleMonthlyReportController.generateMonthlyReport(mockReq, mockRes);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugSeptemberReport().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Debug error:', error);
    process.exit(1);
});