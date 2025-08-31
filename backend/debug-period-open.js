const db = require('./src/models');
const periodService = require('./src/services/periodManagementService');

/**
 * Debug script to test period opening functionality
 * Specifically for testing the July 2025 force open issue
 */
async function debugPeriodOpen() {
    console.log('🔍 Debugging Period Opening System');
    console.log('================================');
    
    try {
        // Find the General account (ID 17 from the images)
        const account = await db.Account.findByPk(17);
        if (!account) {
            console.error('❌ Account ID 17 not found');
            return;
        }
        
        console.log(`📊 Testing with Account: ${account.name} (ID: ${account.id})`);
        
        // Check current open periods
        console.log('\n📅 Current Open Periods:');
        const openPeriods = await periodService.getAllOpenPeriods();
        const accountOpenPeriods = openPeriods.filter(p => p.account_id === account.id);
        
        if (accountOpenPeriods.length === 0) {
            console.log('   No open periods found');
        } else {
            accountOpenPeriods.forEach(period => {
                console.log(`   ${period.month}/${period.year} - Status: ${period.status}`);
            });
        }
        
        // Check if July 2025 period exists
        console.log('\n📅 Checking July 2025 Period:');
        const julyPeriod = await periodService.getPeriod(account.id, 7, 2025);
        if (julyPeriod) {
            console.log(`   July 2025 exists - Status: ${julyPeriod.status}`);
            console.log(`   Created: ${julyPeriod.createdAt}`);
            console.log(`   Last Updated: ${julyPeriod.updatedAt}`);
        } else {
            console.log('   July 2025 period does not exist yet');
        }
        
        // Try to force open July 2025
        console.log('\n🔄 Attempting to Force Open July 2025...');
        
        try {
            const result = await periodService.openPeriod(
                account.id,
                7, // July
                2025,
                {
                    userId: 1, // Mock user ID
                    notes: 'Debug test - force opening July 2025',
                    isAutoOpened: false,
                    forceOpen: true
                }
            );
            
            console.log('✅ Force open result:', {
                success: result.success,
                message: result.message,
                wasAlreadyOpen: result.wasAlreadyOpen,
                warning: result.warning,
                periodStatus: result.period?.status
            });
            
            // Verify the period is actually open
            console.log('\n🔍 Verifying July 2025 Status After Force Open:');
            const verifyPeriod = await periodService.getPeriod(account.id, 7, 2025);
            if (verifyPeriod) {
                console.log(`   Status: ${verifyPeriod.status}`);
                console.log(`   Opened At: ${verifyPeriod.opened_at}`);
                console.log(`   Opened By: ${verifyPeriod.opened_by}`);
                console.log(`   Notes: ${verifyPeriod.notes}`);
                
                if (verifyPeriod.status === 'open') {
                    console.log('🎉 SUCCESS: July 2025 is now properly opened!');
                } else {
                    console.log('❌ FAILED: July 2025 is still not open despite success message');
                }
            } else {
                console.log('❌ FAILED: July 2025 period not found after opening attempt');
            }
            
        } catch (forceOpenError) {
            console.error('❌ Force open failed:', forceOpenError.message);
            console.error('Stack trace:', forceOpenError.stack);
        }
        
        // Check current open periods again
        console.log('\n📅 Open Periods After Test:');
        const finalOpenPeriods = await periodService.getAllOpenPeriods();
        const finalAccountPeriods = finalOpenPeriods.filter(p => p.account_id === account.id);
        
        if (finalAccountPeriods.length === 0) {
            console.log('   No open periods found');
        } else {
            finalAccountPeriods.forEach(period => {
                console.log(`   ${period.month}/${period.year} - Status: ${period.status}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Debug test failed:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        await db.sequelize.close();
    }
}

// Run the debug test
if (require.main === module) {
    debugPeriodOpen();
}

module.exports = { debugPeriodOpen };