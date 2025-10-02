/**
 * DEBUG API RESPONSE
 * Check what the API is actually returning for October report
 */

const simpleMonthlyReportController = require('./controllers/simpleMonthlyReportController');

async function debugApiResponse() {
    console.log('🔍 DEBUG API RESPONSE FOR OCTOBER REPORT');
    console.log('=' .repeat(80));

    const mockReq = {
        params: { year: '2025', month: '10', accountId: '25' },
        query: { all_accounts: 'false' }
    };

    let apiResponse = null;

    const mockRes = {
        json: function(response) {
            apiResponse = response;
            console.log('📡 FULL API RESPONSE:');
            console.log('='.repeat(50));
            console.log(JSON.stringify(response, null, 2));
            return this;
        },
        status: function(code) { return this; }
    };

    await simpleMonthlyReportController.generateMonthlyReport(mockReq, mockRes);

    if (apiResponse?.success && apiResponse?.data) {
        console.log('\n🔍 CREDIT HEAD ANALYSIS:');
        console.log('='.repeat(50));

        const creditHeads = apiResponse.data.credit_heads;
        if (creditHeads && creditHeads.length > 0) {
            creditHeads.forEach((ch, index) => {
                console.log(`Credit Head ${index + 1}:`);
                console.log(`  Name: ${ch.ledger_head.name}`);
                console.log(`  Opening Balance: ₹${ch.opening_balance}`);
                console.log(`  Total Credits: ₹${ch.total_credits}`);
                console.log(`  Closing Balance: ₹${ch.closing_balance}`);
                console.log(`  Cash Amount: ₹${ch.cash_amount}`);
                console.log(`  Bank Amount: ₹${ch.bank_amount}`);
                console.log('');
            });
        }

        console.log('🔍 DEBIT HEAD ANALYSIS:');
        console.log('='.repeat(50));

        const debitHeads = apiResponse.data.debit_heads;
        if (debitHeads && debitHeads.length > 0) {
            debitHeads.forEach((dh, index) => {
                console.log(`Debit Head ${index + 1}:`);
                console.log(`  Name: ${dh.ledger_head.name}`);
                console.log(`  Closing Balance: ₹${dh.closing_balance}`);
                console.log(`  Cash Amount: ₹${dh.cash_amount}`);
                console.log(`  Bank Amount: ₹${dh.bank_amount}`);
                console.log('');
            });
        }

        console.log('🎯 EXPECTED vs ACTUAL:');
        console.log('='.repeat(50));
        const donationHead = creditHeads?.find(ch => ch.ledger_head.name === 'Donation');
        if (donationHead) {
            console.log(`Expected Donation Closing Balance: ₹310`);
            console.log(`Actual Donation Closing Balance: ₹${donationHead.closing_balance}`);

            if (parseFloat(donationHead.closing_balance) === 310) {
                console.log('✅ BACKEND IS SENDING CORRECT VALUE (₹310)');
                console.log('❌ FRONTEND DISPLAY ISSUE - Check browser cache or React state');
            } else {
                console.log('❌ BACKEND IS SENDING WRONG VALUE');
                console.log('🔧 Need to debug backend calculation further');
            }
        }
    }
}

debugApiResponse().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Debug error:', error);
    process.exit(1);
});