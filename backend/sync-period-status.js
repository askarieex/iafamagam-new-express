const db = require('./src/models');
const periodService = require('./src/services/periodManagementService');

/**
 * Sync script to ensure consistency between accounting_periods and monthly_ledger_balances
 * This addresses potential inconsistencies that cause periods to appear closed when they're actually open
 */
async function syncPeriodStatus() {
    console.log('🔄 Syncing Period Status Between Tables');
    console.log('====================================');
    
    try {
        const accountId = 17;
        
        // Get all open periods from accounting_periods table
        console.log('📅 Open Periods from accounting_periods table:');
        const openPeriods = await db.AccountingPeriod.findAll({
            where: {
                account_id: accountId,
                status: 'open'
            },
            order: [['year', 'ASC'], ['month', 'ASC']]
        });
        
        openPeriods.forEach(period => {
            console.log(`   ${period.month}/${period.year}: Status=${period.status}`);
        });
        
        // Get all open periods from monthly_ledger_balances table
        console.log('\n📊 Open Periods from monthly_ledger_balances table:');
        const openBalances = await db.MonthlyLedgerBalance.findAll({
            where: {
                account_id: accountId,
                is_open: true
            },
            attributes: ['month', 'year'],
            group: ['month', 'year'],
            order: [['year', 'ASC'], ['month', 'ASC']]
        });
        
        openBalances.forEach(balance => {
            console.log(`   ${balance.month}/${balance.year}: is_open=true`);
        });
        
        // Find inconsistencies
        console.log('\n🔍 Checking for Inconsistencies:');
        let inconsistencies = 0;
        
        for (const period of openPeriods) {
            // Check if this period has corresponding open monthly balances
            const monthlyBalanceCount = await db.MonthlyLedgerBalance.count({
                where: {
                    account_id: accountId,
                    month: period.month,
                    year: period.year,
                    is_open: true
                }
            });
            
            if (monthlyBalanceCount === 0) {
                console.log(`   ⚠️  Period ${period.month}/${period.year} is open in accounting_periods but has no open monthly balances`);
                inconsistencies++;
                
                // Fix: Update monthly balances to be open
                const updateResult = await db.MonthlyLedgerBalance.update(
                    { is_open: true },
                    {
                        where: {
                            account_id: accountId,
                            month: period.month,
                            year: period.year
                        }
                    }
                );
                
                console.log(`   🔧 Fixed: Updated ${updateResult[0]} monthly balance records to is_open=true`);
            } else {
                console.log(`   ✅ Period ${period.month}/${period.year} is consistent (${monthlyBalanceCount} open monthly balances)`);
            }
        }
        
        // Check reverse inconsistency (monthly balances open but period closed)
        for (const balance of openBalances) {
            const accountingPeriod = await db.AccountingPeriod.findOne({
                where: {
                    account_id: accountId,
                    month: balance.month,
                    year: balance.year
                }
            });
            
            if (!accountingPeriod || accountingPeriod.status !== 'open') {
                console.log(`   ⚠️  Month ${balance.month}/${balance.year} has open monthly balances but period is not open in accounting_periods`);
                inconsistencies++;
                
                if (!accountingPeriod) {
                    // Create the missing period
                    await db.AccountingPeriod.create({
                        account_id: accountId,
                        month: balance.month,
                        year: balance.year,
                        status: 'open',
                        opened_at: new Date(),
                        opened_by: 1, // System
                        notes: 'Auto-created to sync with monthly balances',
                        is_auto_opened: true
                    });
                    console.log(`   🔧 Fixed: Created missing accounting period for ${balance.month}/${balance.year}`);
                } else {
                    // Update existing period to be open
                    await accountingPeriod.update({
                        status: 'open',
                        opened_at: new Date(),
                        opened_by: 1
                    });
                    console.log(`   🔧 Fixed: Updated accounting period ${balance.month}/${balance.year} to open status`);
                }
            }
        }
        
        if (inconsistencies === 0) {
            console.log('\n🎉 All periods are consistent!');
        } else {
            console.log(`\n✅ Fixed ${inconsistencies} inconsistencies`);
        }
        
        // Final verification
        console.log('\n📊 Final Status After Sync:');
        const finalPeriods = await periodService.getAllOpenPeriods();
        const accountPeriods = finalPeriods.filter(p => p.account_id === accountId);
        
        if (accountPeriods.length === 0) {
            console.log('   No open periods found');
        } else {
            accountPeriods.forEach(period => {
                console.log(`   ${period.month}/${period.year}: Status=${period.status}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error syncing period status:', error);
    } finally {
        await db.sequelize.close();
    }
}

// Run the sync
if (require.main === module) {
    syncPeriodStatus();
}

module.exports = { syncPeriodStatus };