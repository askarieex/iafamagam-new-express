/**
 * Debug script to investigate the period consistency issue
 */

const periodService = require('./src/services/periodManagementService');
const db = require('./src/models');

async function debugPeriodIssue() {
    try {
        console.log('🔍 DEBUGGING PERIOD CONSISTENCY ISSUE');
        console.log('=====================================');

        // Get all accounts
        const accounts = await db.Account.findAll({
            attributes: ['id', 'name']
        });

        console.log(`\n📋 Found ${accounts.length} active accounts:`);
        
        for (const account of accounts) {
            console.log(`\n🏢 Account ${account.id}: ${account.name}`);
            console.log('-------------------------------------------');

            // Check what the centralized service says
            const openPeriod = await periodService.getCurrentOpenPeriod(account.id);
            if (openPeriod) {
                console.log(`✅ CENTRALIZED SERVICE: Open period ${openPeriod.month}/${openPeriod.year}`);
                
                // Test date validation for August 2025
                const isAugustValid = await periodService.isDateInOpenPeriod(account.id, '2025-08-15');
                console.log(`📅 Date validation for 2025-08-15: ${isAugustValid}`);
                
                // Test current date
                const today = new Date().toISOString().split('T')[0];
                const isTodayValid = await periodService.isDateInOpenPeriod(account.id, today);
                console.log(`📅 Date validation for ${today}: ${isTodayValid}`);
                
            } else {
                console.log(`❌ CENTRALIZED SERVICE: No open period found`);
            }

            // Check what's in accounting_periods table
            const allPeriods = await db.AccountingPeriod.findAll({
                where: { account_id: account.id },
                order: [['year', 'DESC'], ['month', 'DESC']]
            });

            console.log(`\n📊 ACCOUNTING_PERIODS TABLE:`);
            if (allPeriods.length === 0) {
                console.log(`   No periods found in accounting_periods table`);
            } else {
                for (const period of allPeriods) {
                    const status = period.status === 'open' ? '🟢 OPEN' : '🔴 CLOSED';
                    console.log(`   ${status} ${period.month}/${period.year} (${period.is_auto_opened ? 'auto' : 'manual'})`);
                }
            }

            // Check what's in monthly_ledger_balances (old system)
            const openBalances = await db.MonthlyLedgerBalance.findAll({
                where: { 
                    account_id: account.id,
                    is_open: true 
                },
                attributes: ['month', 'year', 'ledger_head_id'],
                include: [{
                    model: db.LedgerHead,
                    as: 'ledgerHead',
                    attributes: ['name']
                }]
            });

            console.log(`\n📊 MONTHLY_LEDGER_BALANCES (is_open=true):`);
            if (openBalances.length === 0) {
                console.log(`   No open balances found in monthly_ledger_balances`);
            } else {
                const groupedBalances = {};
                for (const balance of openBalances) {
                    const key = `${balance.month}/${balance.year}`;
                    if (!groupedBalances[key]) {
                        groupedBalances[key] = [];
                    }
                    groupedBalances[key].push(balance.ledgerHead?.name || 'Unknown');
                }
                
                for (const [period, ledgerHeads] of Object.entries(groupedBalances)) {
                    console.log(`   🟢 OPEN ${period} (${ledgerHeads.length} ledger heads: ${ledgerHeads.join(', ')})`);
                }
            }
        }

        console.log('\n🧪 TESTING CURRENT DATE BEHAVIOR:');
        console.log('==================================');
        
        const testDate = '2025-08-30'; // Today's date
        console.log(`Testing date: ${testDate}`);
        
        for (const account of accounts.slice(0, 2)) { // Test first 2 accounts only
            console.log(`\nAccount ${account.id}:`);
            
            try {
                const isValid = await periodService.isDateInOpenPeriod(account.id, testDate);
                console.log(`  isDateInOpenPeriod(${testDate}): ${isValid}`);
                
                const openPeriod = await periodService.getCurrentOpenPeriod(account.id);
                if (openPeriod) {
                    console.log(`  Current open period: ${openPeriod.month}/${openPeriod.year}`);
                    console.log(`  Period date range: ${openPeriod.getDateRange().startString} to ${openPeriod.getDateRange().endString}`);
                } else {
                    console.log(`  No open period found`);
                }
            } catch (error) {
                console.log(`  ❌ Error: ${error.message}`);
            }
        }

    } catch (error) {
        console.error('❌ Debug failed:', error);
    } finally {
        process.exit(0);
    }
}

debugPeriodIssue();