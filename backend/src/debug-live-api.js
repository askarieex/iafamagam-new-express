/**
 * DEBUG LIVE API RESPONSE
 * Check what the live frontend is actually receiving via network calls
 */

const axios = require('axios');

async function debugLiveApi() {
    console.log('🔍 DEBUG LIVE API RESPONSE - TESTING REAL FRONTEND CALL');
    console.log('=' .repeat(80));

    try {
        // Make the exact same call the frontend makes
        const response = await axios.get(
            'http://localhost:5000/api/reports/monthly/2025/10/1',
            {
                params: {
                    regenerate: false,
                    include_transactions: false,
                    save_results: true,
                    all_accounts: true,
                    _t: Date.now()
                }
            }
        );

        if (response.data.success && response.data.data) {
            const data = response.data.data;

            console.log('📡 LIVE API RESPONSE RECEIVED:');
            console.log('='.repeat(50));

            // Check the credit_heads array specifically
            const creditHeads = data.credit_heads;
            const donationHead = creditHeads?.find(ch => ch.ledger_head.name === 'Donation');

            if (donationHead) {
                console.log(`🎯 DONATION HEAD IN LIVE RESPONSE:`);
                console.log(`  closing_balance: ${donationHead.closing_balance}`);
                console.log(`  Type: ${typeof donationHead.closing_balance}`);
                console.log(`  JSON: ${JSON.stringify(donationHead, null, 2)}`);

                console.log('\n🔍 FRONTEND TABLE LOGIC SIMULATION:');
                console.log('='.repeat(50));
                console.log('Frontend code uses: creditHead.closing_balance');
                console.log(`Would display: ₹${donationHead.closing_balance}`);

                if (donationHead.closing_balance == 235) {
                    console.log('❌ FOUND THE BUG! API is sending 235, not 310');
                    console.log('🔧 Need to debug why live API differs from test scripts');
                } else if (donationHead.closing_balance == 310) {
                    console.log('✅ API sends 310 correctly');
                    console.log('❌ Frontend must be doing some calculation or transformation');
                } else {
                    console.log(`❓ API sends ${donationHead.closing_balance} - unexpected value`);
                }
            }

            // Check account_groups data structure
            console.log('\n🔍 ACCOUNT GROUPS STRUCTURE:');
            console.log('='.repeat(50));
            if (data.account_groups && data.account_groups.length > 0) {
                const firstGroup = data.account_groups[0];
                const groupDonationHead = firstGroup.credit_heads?.find(ch => ch.ledger_head.name === 'Donation');

                if (groupDonationHead) {
                    console.log(`Account Groups Donation closing_balance: ${groupDonationHead.closing_balance}`);
                    console.log('Frontend table uses account_groups data, not credit_heads!');

                    if (groupDonationHead.closing_balance == 235) {
                        console.log('❌ FOUND IT! account_groups has 235');
                    }
                }
            }

        } else {
            console.log('❌ API call failed or returned error');
            console.log('Response:', response.data);
        }

    } catch (error) {
        console.error('❌ ERROR making API call:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        }
    }
}

debugLiveApi().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Debug error:', error);
    process.exit(1);
});