const db = require('./src/models');

async function checkDatabaseStatus() {
    console.log('🔍 Checking Database Status for Account 17');
    console.log('=========================================');
    
    try {
        // Get all periods for account 17
        const periods = await db.AccountingPeriod.findAll({
            where: { account_id: 17 },
            order: [['year', 'ASC'], ['month', 'ASC']]
        });
        
        console.log('📅 All Periods for Account 17:');
        periods.forEach(period => {
            console.log(`   ${period.month}/${period.year}: Status=${period.status}, ID=${period.id}, Updated=${period.updatedAt}`);
        });
        
        // Also check monthly balances to see if they're properly synced
        console.log('\n📊 Monthly Balance Records:');
        const monthlyBalances = await db.MonthlyLedgerBalance.findAll({
            where: { account_id: 17 },
            order: [['year', 'ASC'], ['month', 'ASC']],
            limit: 10
        });
        
        monthlyBalances.forEach(balance => {
            console.log(`   ${balance.month}/${balance.year}: is_open=${balance.is_open}, closing_balance=${balance.closing_balance}`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await db.sequelize.close();
    }
}

checkDatabaseStatus();