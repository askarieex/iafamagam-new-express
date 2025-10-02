/**
 * DEBUG DATA STRUCTURES
 * Compare account_groups vs credit_heads arrays to find the ₹235 source
 */

const simpleMonthlyReportController = require('./controllers/simpleMonthlyReportController');

async function debugDataStructures() {
    console.log('🔍 DEBUG DATA STRUCTURES - ACCOUNT_GROUPS vs CREDIT_HEADS');
    console.log('=' .repeat(80));

    const mockReq = {
        params: { year: '2025', month: '10', accountId: '1' },
        query: { all_accounts: 'true' }
    };

    let apiResponse = null;

    const mockRes = {
        json: function(response) {
            apiResponse = response;
            return this;
        },
        status: function(code) { return this; }
    };

    await simpleMonthlyReportController.generateMonthlyReport(mockReq, mockRes);

    if (apiResponse?.success && apiResponse?.data) {
        const data = apiResponse.data;

        console.log('🔍 COMPARING DATA STRUCTURES:');
        console.log('='.repeat(50));

        // Check main credit_heads array
        const mainCreditHeads = data.credit_heads;
        const mainDonation = mainCreditHeads?.find(ch => ch.ledger_head.name === 'Donation');

        console.log('📊 MAIN CREDIT_HEADS ARRAY:');
        if (mainDonation) {
            console.log(`  Donation closing_balance: ${mainDonation.closing_balance}`);
            console.log(`  Full object:`, JSON.stringify(mainDonation, null, 2));
        }

        // Check account_groups array
        const accountGroups = data.account_groups;
        if (accountGroups && accountGroups.length > 0) {
            console.log('\n📊 ACCOUNT_GROUPS ARRAY:');
            accountGroups.forEach((group, index) => {
                console.log(`Account Group ${index + 1}: ${group.account.name}`);

                const groupCreditHeads = group.credit_heads || [];
                const groupDonation = groupCreditHeads.find(ch => ch.ledger_head.name === 'Donation');

                if (groupDonation) {
                    console.log(`  Group Donation closing_balance: ${groupDonation.closing_balance}`);
                    console.log(`  Group Full object:`, JSON.stringify(groupDonation, null, 2));
                }
            });
        }

        console.log('\n🎯 COMPARISON RESULT:');
        console.log('='.repeat(50));

        if (mainDonation && accountGroups?.[0]?.credit_heads) {
            const groupDonation = accountGroups[0].credit_heads.find(ch => ch.ledger_head.name === 'Donation');

            console.log(`Main credit_heads: ${mainDonation.closing_balance}`);
            console.log(`Account_groups: ${groupDonation?.closing_balance}`);

            if (mainDonation.closing_balance !== groupDonation?.closing_balance) {
                console.log('❌ FOUND THE BUG! Different values in data structures');
                console.log('🔧 Frontend table uses account_groups (wrong), header uses totals (correct)');

                if (groupDonation?.closing_balance == 235) {
                    console.log('✅ CONFIRMED: account_groups contains the ₹235 value');
                }
            } else {
                console.log('✅ Both structures have same value - bug is elsewhere');
            }
        }

        console.log('\n🔍 TOTALS STRUCTURE:');
        console.log('='.repeat(50));
        console.log(`Totals closing_balance: ${data.totals.closing_balance}`);
        console.log('This is what the header correctly shows');
    }
}

debugDataStructures().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Debug error:', error);
    process.exit(1);
});