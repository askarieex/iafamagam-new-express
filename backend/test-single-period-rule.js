/**
 * Test script to verify single period rule enforcement
 */

const periodService = require('./src/services/periodManagementService');
const db = require('./src/models');

async function testSinglePeriodRule() {
    try {
        console.log('🧪 TESTING SINGLE PERIOD RULE ENFORCEMENT');
        console.log('==========================================');

        // Get the first account
        const account = await db.Account.findOne();
        if (!account) {
            console.log('❌ No accounts found for testing');
            return;
        }

        console.log(`\n🏢 Testing with Account ${account.id}: ${account.name}`);

        // Step 1: Open August 2025
        console.log('\n📅 Step 1: Opening August 2025...');
        const result1 = await periodService.openPeriod(account.id, 8, 2025, {
            userId: 1,
            notes: 'Test period opening',
            isAutoOpened: false
        });

        if (result1.success) {
            console.log('✅ August 2025 opened successfully');
        } else {
            console.log('❌ Failed to open August 2025:', result1.message);
            return;
        }

        // Step 2: Try to open September 2025 (should fail)
        console.log('\n📅 Step 2: Trying to open September 2025 (should fail)...');
        try {
            const result2 = await periodService.openPeriod(account.id, 9, 2025, {
                userId: 1,
                notes: 'This should fail',
                isAutoOpened: false
            });

            if (result2.success) {
                console.log('❌ VIOLATION: September 2025 was opened when August was already open!');
            } else {
                console.log('✅ Correctly rejected opening September 2025:', result2.message);
            }
        } catch (error) {
            console.log('✅ Correctly threw error when trying to open second period:', error.message);
        }

        // Step 3: Verify only August is open
        console.log('\n📊 Step 3: Verifying current state...');
        const openPeriod = await periodService.getCurrentOpenPeriod(account.id);
        if (openPeriod && openPeriod.month === 8 && openPeriod.year === 2025) {
            console.log('✅ Only August 2025 is open as expected');
        } else {
            console.log('❌ Unexpected open period state:', openPeriod);
        }

        // Step 4: Close August and open September (should work)
        console.log('\n🔄 Step 4: Closing August and opening September...');
        
        const closeResult = await periodService.closePeriod(account.id, 8, 2025, {
            userId: 1,
            notes: 'Closing to test sequential opening'
        });

        if (closeResult.success) {
            console.log('✅ August 2025 closed successfully');
            
            const result3 = await periodService.openPeriod(account.id, 9, 2025, {
                userId: 1,
                notes: 'Opening after closing August',
                isAutoOpened: false
            });

            if (result3.success) {
                console.log('✅ September 2025 opened successfully after closing August');
            } else {
                console.log('❌ Failed to open September after closing August:', result3.message);
            }
        } else {
            console.log('❌ Failed to close August:', closeResult.message);
        }

        // Step 5: Verify final state
        console.log('\n📊 Step 5: Final verification...');
        const finalPeriod = await periodService.getCurrentOpenPeriod(account.id);
        if (finalPeriod && finalPeriod.month === 9 && finalPeriod.year === 2025) {
            console.log('✅ September 2025 is now open as expected');
        } else {
            console.log('❌ Unexpected final period state:', finalPeriod);
        }

        console.log('\n🎯 SINGLE PERIOD RULE TEST COMPLETED');
        console.log('✅ All tests passed - single period rule is properly enforced');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    } finally {
        // Cleanup - close any open periods
        try {
            const account = await db.Account.findOne();
            if (account) {
                const openPeriod = await periodService.getCurrentOpenPeriod(account.id);
                if (openPeriod) {
                    await periodService.closePeriod(account.id, openPeriod.month, openPeriod.year, {
                        userId: 1,
                        notes: 'Cleanup after test'
                    });
                    console.log('🧹 Cleanup: Closed open period');
                }
            }
        } catch (cleanupError) {
            console.log('⚠️  Cleanup warning:', cleanupError.message);
        }
        
        process.exit(0);
    }
}

testSinglePeriodRule();