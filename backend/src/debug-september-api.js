/**
 * DEBUG SEPTEMBER API RESPONSE
 * Check what the API is returning for September report
 */

const simpleMonthlyReportController = require('./controllers/simpleMonthlyReportController');

async function debugSeptemberApi() {
    console.log('🔍 DEBUG SEPTEMBER API RESPONSE');
    console.log('=' .repeat(80));

    const mockReq = {
        params: { year: '2025', month: '9', accountId: '25' },
        query: { all_accounts: 'false' }
    };

    let apiResponse = null;

    const mockRes = {
        json: function(response) {
            apiResponse = response;
            console.log('📡 SEPTEMBER API RESPONSE:');
            console.log('='.repeat(50));
            console.log(JSON.stringify(response, null, 2));
            return this;
        },
        status: function(code) { return this; }
    };

    await simpleMonthlyReportController.generateMonthlyReport(mockReq, mockRes);

    if (apiResponse?.success && apiResponse?.data) {
        console.log('\n🔍 SEPTEMBER ANALYSIS:');
        console.log('='.repeat(50));

        const creditHeads = apiResponse.data.credit_heads;
        const donationHead = creditHeads?.find(ch => ch.ledger_head.name === 'Donation');

        if (donationHead) {
            console.log(`📈 DONATION:`)
            console.log(`  Opening Balance: ₹${donationHead.opening_balance}`);
            console.log(`  Total Credits: ₹${donationHead.total_credits}`);
            console.log(`  Closing Balance: ₹${donationHead.closing_balance}`);
            console.log(`  Expected: ₹${donationHead.total_credits} - ₹75 = ₹${donationHead.total_credits - 75}`);

            if (parseFloat(donationHead.closing_balance) === (donationHead.total_credits - 75)) {
                console.log('✅ SEPTEMBER CALCULATION IS CORRECT');
            } else {
                console.log('❌ SEPTEMBER CALCULATION IS WRONG');
                console.log(`   Expected: ₹${donationHead.total_credits - 75}`);
                console.log(`   Actual: ₹${donationHead.closing_balance}`);
            }
        }

        console.log(`\n🎯 TOTALS CHECK:`);
        console.log(`  Total Credits: ₹${apiResponse.data.totals.total_credits}`);
        console.log(`  Total Debits: ₹${apiResponse.data.totals.total_debits}`);
        console.log(`  Closing Balance: ₹${apiResponse.data.totals.closing_balance}`);
        console.log(`  Expected Net: ₹${apiResponse.data.totals.total_credits - apiResponse.data.totals.total_debits}`);
    }
}

debugSeptemberApi().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Debug error:', error);
    process.exit(1);
});