const monthlyClosureController = require('./controllers/monthlyClosureController');
const db = require('./models');

async function testEnsureCurrentPeriodOpen() {
    try {
        console.log('Testing ensureCurrentPeriodOpen with account ID 1...');

        const result = await monthlyClosureController.ensureCurrentPeriodOpen(1);

        console.log('Result:', result);

        if (result.success) {
            if (result.autoOpened) {
                console.log('✅ Period was auto-opened successfully!');
            } else {
                console.log('✅ Period was already open');
            }
        } else {
            console.log('❌ Failed to ensure period is open:', result.message);
        }

        // Now verify in the database if the period is actually open
        console.log('\nVerifying database state...');
        const openPeriods = await db.MonthlyLedgerBalance.findAll({
            where: { account_id: 1, is_open: true },
            raw: true
        });

        console.log(`Found ${openPeriods.length} open periods in database for account 1`);
        openPeriods.forEach(period => {
            console.log(`- Month ${period.month}/${period.year} (Ledger Head: ${period.ledger_head_id})`);
        });

        // Check the expected month
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        const expectedPeriod = openPeriods.find(p => p.month === currentMonth && p.year === currentYear);
        if (expectedPeriod) {
            console.log(`✅ Confirmed: Period ${currentMonth}/${currentYear} is open in the database`);
        } else {
            console.log(`❌ Error: Period ${currentMonth}/${currentYear} is NOT open in the database despite successful API response`);
        }

    } catch (error) {
        console.error('Error testing period open:', error);
    }
}

// Execute test
testEnsureCurrentPeriodOpen(); 