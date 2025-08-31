const periodService = require('./src/services/periodManagementService');
const db = require('./src/models');

async function testCurrentMonthAccess() {
    console.log('🧪 Testing Current Month Access Fix...');
    
    try {
        // Test with a sample account ID (using actual account ID 19 - General Account)
        const accountId = 19;
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // August = 8
        const currentYear = currentDate.getFullYear(); // 2025
        
        console.log(`📅 Testing for current month: ${currentMonth}/${currentYear}`);
        
        // Test 1: Validate current month opening
        console.log('\n1️⃣ Testing validateBackPeriodOpening for current month...');
        const validation = await periodService.validateBackPeriodOpening(accountId, currentMonth, currentYear);
        console.log('✅ Current month validation result:', validation);
        
        if (!validation.allowed) {
            console.error('❌ CRITICAL: Current month is not allowed to be opened!');
            return false;
        }
        
        // Test 2: Get valid period information
        console.log('\n2️⃣ Testing getValidPreviousMonth...');
        const validPeriod = await periodService.getValidPreviousMonth(accountId);
        console.log('✅ Valid period info:', validPeriod);
        
        // Test 3: Try to open current month period
        console.log('\n3️⃣ Testing openPeriod for current month...');
        const openResult = await periodService.openPeriod(accountId, currentMonth, currentYear, {
            userId: 1,
            notes: 'Test opening current month - should always work'
        });
        console.log('✅ Open current month result:', openResult);
        
        if (!openResult.success) {
            console.error('❌ CRITICAL: Failed to open current month!', openResult.message);
            return false;
        }
        
        // Test 4: Verify current month is now open
        console.log('\n4️⃣ Verifying current month is open...');
        const currentOpenPeriod = await periodService.getCurrentOpenPeriod(accountId);
        console.log('✅ Current open period:', currentOpenPeriod);
        
        if (!currentOpenPeriod || currentOpenPeriod.month !== currentMonth || currentOpenPeriod.year !== currentYear) {
            console.error('❌ CRITICAL: Current month is not properly opened!');
            return false;
        }
        
        console.log('\n🎉 SUCCESS: All tests passed! Current month access is working correctly.');
        return true;
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
        return false;
    }
}

// Run the test
testCurrentMonthAccess().then(success => {
    if (success) {
        console.log('\n✅ Current month access fix is working correctly!');
        console.log('📝 Key fixes implemented:');
        console.log('   - Current month is always allowed in validateBackPeriodOpening');
        console.log('   - openPeriod method bypasses validation for current month');
        console.log('   - Frontend validation prioritizes current month');
        console.log('   - UI buttons are enabled for current month');
    } else {
        console.log('\n❌ Current month access fix needs more work!');
    }
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
});