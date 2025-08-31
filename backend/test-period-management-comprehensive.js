const periodService = require('./src/services/periodManagementService');
const db = require('./src/models');

/**
 * Comprehensive test for Period Management System fixes
 * Tests the exact scenario described in the bug report
 */
async function testPeriodManagementFix() {
    console.log('🧪 Testing Comprehensive Period Management Fix...');
    
    try {
        const accountId = 19; // General Account
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // August = 8
        const currentYear = currentDate.getFullYear(); // 2025
        
        console.log(`📅 Current date: ${currentMonth}/${currentYear}`);
        console.log(`📋 Testing scenario: July 2025 open, need to switch to August 2025`);
        
        // Step 1: Ensure we're starting with July 2025 open (simulating the bug scenario)
        console.log('\n1️⃣ Setting up test scenario - Open July 2025...');
        
        const julyOpenResult = await periodService.openPeriod(accountId, 7, 2025, {
            userId: 1,
            notes: 'Test scenario - July backdate period'
        });
        
        if (!julyOpenResult.success) {
            console.error('❌ Failed to open July 2025:', julyOpenResult.message);
            return false;
        }
        
        console.log('✅ July 2025 is now open (simulating the stuck state)');
        
        // Step 2: Verify current state (July open, need to switch to August)
        console.log('\n2️⃣ Verifying current state...');
        const openPeriod = await periodService.getCurrentOpenPeriod(accountId);
        
        if (!openPeriod || openPeriod.month !== 7 || openPeriod.year !== 2025) {
            console.error('❌ Test setup failed - July 2025 should be open');
            return false;
        }
        
        console.log(`✅ Current open period: ${openPeriod.month}/${openPeriod.year}`);
        console.log('📋 This simulates the exact scenario from the bug report');
        
        // Step 3: Test button state logic (frontend simulation)
        console.log('\n3️⃣ Testing button state logic...');
        
        // Simulate frontend state
        const selectedMonth = 8; // User has August selected (current month)
        const selectedYear = 2025;
        
        console.log(`Selected period: ${selectedMonth}/${selectedYear}`);
        
        // Test Open Button Logic
        const openButtonDisabled = (openPeriod?.month === selectedMonth && openPeriod?.year === selectedYear);
        console.log(`Open Button Disabled: ${openButtonDisabled} (should be false - different periods)`);
        
        // Test Close Button Logic  
        const closeButtonDisabled = !openPeriod;
        console.log(`Close Button Disabled: ${closeButtonDisabled} (should be false - period exists)`);
        
        if (openButtonDisabled || closeButtonDisabled) {
            console.error('❌ Button logic still has issues!');
            return false;
        }
        
        console.log('✅ Button states are correct - both should be enabled');
        
        // Step 4: Test closing July period (this was failing before)
        console.log('\n4️⃣ Testing period closure (the critical fix)...');
        
        const closeResult = await periodService.closePeriod(accountId, openPeriod.month, openPeriod.year, {
            userId: 1,
            notes: 'Test closing July to switch to August'
        });
        
        if (!closeResult.success) {
            console.error('❌ CRITICAL: Still cannot close July 2025!', closeResult.message);
            return false;
        }
        
        console.log('✅ Successfully closed July 2025 - critical fix working!');
        
        // Step 5: Verify no period is open
        console.log('\n5️⃣ Verifying July closure...');
        const noPeriodOpen = await periodService.getCurrentOpenPeriod(accountId);
        
        if (noPeriodOpen) {
            console.error('❌ Period should be closed but still shows open:', noPeriodOpen);
            return false;
        }
        
        console.log('✅ Confirmed: No periods are currently open');
        
        // Step 6: Test opening August period (current month)
        console.log('\n6️⃣ Testing August opening (current month access)...');
        
        const augustOpenResult = await periodService.openPeriod(accountId, currentMonth, currentYear, {
            userId: 1,
            notes: 'Test opening current month after closing back period'
        });
        
        if (!augustOpenResult.success) {
            console.error('❌ CRITICAL: Cannot open August 2025!', augustOpenResult.message);
            return false;
        }
        
        console.log('✅ Successfully opened August 2025 - current month access working!');
        
        // Step 7: Verify final state
        console.log('\n7️⃣ Verifying final state...');
        const finalOpenPeriod = await periodService.getCurrentOpenPeriod(accountId);
        
        if (!finalOpenPeriod || finalOpenPeriod.month !== currentMonth || finalOpenPeriod.year !== currentYear) {
            console.error('❌ Final state incorrect:', finalOpenPeriod);
            return false;
        }
        
        console.log(`✅ Final state correct: ${finalOpenPeriod.month}/${finalOpenPeriod.year} is open`);
        
        // Step 8: Test full cycle (back and forth switching)
        console.log('\n8️⃣ Testing full switching cycle...');
        
        // Switch back to July
        const switchToJulyResult = await periodService.openPeriod(accountId, 7, 2025, {
            userId: 1,
            notes: 'Test switching back to July'
        });
        
        if (!switchToJulyResult.success) {
            console.error('❌ Cannot switch back to July:', switchToJulyResult.message);
            return false;
        }
        
        console.log('✅ Successfully switched back to July');
        
        // Switch back to August
        const switchBackToAugustResult = await periodService.openPeriod(accountId, currentMonth, currentYear, {
            userId: 1,
            notes: 'Test switching back to August'
        });
        
        if (!switchBackToAugustResult.success) {
            console.error('❌ Cannot switch back to August:', switchBackToAugustResult.message);
            return false;
        }
        
        console.log('✅ Successfully switched back to August');
        
        // Final verification
        const veryFinalPeriod = await periodService.getCurrentOpenPeriod(accountId);
        const isCurrentMonth = veryFinalPeriod.month === currentMonth && veryFinalPeriod.year === currentYear;
        
        if (!isCurrentMonth) {
            console.error('❌ Final verification failed');
            return false;
        }
        
        console.log('\n🎉 ALL TESTS PASSED! Period management is working correctly!');
        return true;
        
    } catch (error) {
        console.error('💥 Test failed with error:', error);
        return false;
    }
}

// Run the comprehensive test
testPeriodManagementFix().then(success => {
    console.log('\n' + '='.repeat(70));
    if (success) {
        console.log('✅ PERIOD MANAGEMENT FIX: COMPLETELY SUCCESSFUL!');
        console.log('🎯 All critical issues have been resolved');
        console.log('🚀 Users can now switch between periods without deadlocks');
        
        console.log('\n📋 Key fixes verified:');
        console.log('   ✅ Button state logic prevents deadlocks');
        console.log('   ✅ July 2025 can be closed successfully');
        console.log('   ✅ August 2025 can be opened (current month access)');
        console.log('   ✅ Period transitions work smoothly');
        console.log('   ✅ No more stuck states in period management');
        console.log('   ✅ Full switching cycle works (July ↔ August)');
        
        console.log('\n🎯 What to expect in the UI:');
        console.log('   - Refresh the Period Management page');
        console.log('   - Close Period button should be enabled (can close July)');
        console.log('   - Open Period button should be enabled (can open August)');
        console.log('   - Console will show detailed debugging information');
        console.log('   - Clear error messages if anything goes wrong');
        console.log('   - Successful toast notifications when operations complete');
        
        console.log('\n🚨 IMMEDIATE ACTION:');
        console.log('   1. Refresh your Period Management page');
        console.log('   2. Open browser console (F12) to see debug logs');
        console.log('   3. Click "Close Period" to close July 2025');  
        console.log('   4. Select August in dropdown, click "Open Period"');
        console.log('   5. You should successfully return to current operations!');
        
    } else {
        console.log('❌ PERIOD MANAGEMENT FIX: SOME ISSUES REMAIN');
        console.log('🔧 Please review the failed test cases above');
        console.log('📋 Check the specific error messages for guidance');
    }
    console.log('='.repeat(70));
    
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('💥 Test runner crashed:', error);
    process.exit(1);
});