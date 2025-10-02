/**
 * DEBUG FRONTEND API CALL
 * Test the exact same API call that the frontend makes to see what data it receives
 */

const simpleMonthlyReportController = require('./controllers/simpleMonthlyReportController');

async function debugFrontendApiCall() {
    console.log('🔍 DEBUG FRONTEND API CALL - OCTOBER REPORT');
    console.log('=' .repeat(80));
    console.log('Testing exact same API call that frontend makes...');
    console.log('Frontend uses: account ID 1 with all_accounts=true');

    // Frontend uses account ID 1 with all_accounts parameter
    const mockReq = {
        params: { year: '2025', month: '10', accountId: '1' },
        query: {
            regenerate: 'false',
            include_transactions: 'false',
            save_results: 'true',
            all_accounts: 'true'
        }
    };

    let apiResponse = null;

    const mockRes = {
        json: function(response) {
            apiResponse = response;
            console.log('📡 FRONTEND API RESPONSE:');
            console.log('='.repeat(50));
            console.log(JSON.stringify(response, null, 2));
            return this;
        },
        status: function(code) { return this; }
    };

    await simpleMonthlyReportController.generateMonthlyReport(mockReq, mockRes);

    if (apiResponse?.success && apiResponse?.data) {
        console.log('\n🔍 ANALYZING FRONTEND RESPONSE:');
        console.log('='.repeat(50));

        const creditHeads = apiResponse.data.credit_heads;
        const donationHead = creditHeads?.find(ch => ch.ledger_head.name === 'Donation');

        if (donationHead) {
            console.log(`📈 DONATION HEAD IN FRONTEND RESPONSE:`);
            console.log(`  Opening Balance: ₹${donationHead.opening_balance}`);
            console.log(`  Total Credits: ₹${donationHead.total_credits}`);
            console.log(`  Closing Balance: ₹${donationHead.closing_balance}`);
            console.log(`  Cash Amount: ₹${donationHead.cash_amount}`);
            console.log(`  Bank Amount: ₹${donationHead.bank_amount}`);

            console.log('\n🎯 COMPARISON:');
            console.log('='.repeat(50));
            console.log(`Frontend shows in Balance column: ₹${donationHead.closing_balance}`);
            console.log(`Expected value: ₹310`);
            console.log(`User reported seeing: ₹235`);

            if (parseFloat(donationHead.closing_balance) === 235) {
                console.log('✅ FOUND THE ISSUE! Frontend API is returning ₹235');
                console.log('❌ This explains why Balance column shows ₹235');
                console.log('🔧 The issue is in backend logic for account ID 1 vs account ID 25');
            } else if (parseFloat(donationHead.closing_balance) === 310) {
                console.log('❌ MYSTERY: Frontend API returns ₹310 but user sees ₹235');
                console.log('🔧 This suggests browser caching or state management issue');
            } else {
                console.log(`❓ DIFFERENT VALUE: Frontend API returns ₹${donationHead.closing_balance}`);
                console.log('🔧 Need to investigate further');
            }
        }

        console.log(`\n🎯 TOTALS CHECK:`)
        console.log(`  Total Credits: ₹${apiResponse.data.totals.total_credits}`);
        console.log(`  Total Debits: ₹${apiResponse.data.totals.total_debits}`);
        console.log(`  Closing Balance: ₹${apiResponse.data.totals.closing_balance}`);
    }
}

debugFrontendApiCall().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Debug error:', error);
    process.exit(1);
});