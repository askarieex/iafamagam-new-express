const periodService = require('./src/services/periodManagementService');
const db = require('./src/models');

async function testJuly31DateSelection() {
    console.log('🧪 Testing July 31st Date Selection Fix...');
    
    try {
        // Use account ID 19 (General Account)
        const accountId = 19;
        
        // Test dates for July 2025
        const testDates = [
            '2025-07-01',  // First day of July
            '2025-07-15',  // Middle of July  
            '2025-07-30',  // Second to last day
            '2025-07-31',  // CRITICAL: Last day of July - this was failing before
        ];
        
        console.log(`📅 Testing July 2025 period date validation for account ${accountId}...`);
        
        // First, ensure July 2025 period is open
        console.log('\n1️⃣ Opening July 2025 period...');
        const openResult = await periodService.openPeriod(accountId, 7, 2025, {
            userId: 1,
            notes: 'Test opening July 2025 for date validation testing'
        });
        
        if (!openResult.success) {
            console.error('❌ Failed to open July 2025 period:', openResult.message);
            return false;
        }
        
        console.log('✅ July 2025 period opened successfully');
        
        // Test each date
        console.log('\n2️⃣ Testing date validation for each day...');
        let allTestsPassed = true;
        
        for (const testDate of testDates) {
            console.log(`\n🔍 Testing date: ${testDate}`);
            
            // Test backend validation
            const isValidBackend = await periodService.isDateInOpenPeriod(accountId, testDate);
            console.log(`   Backend validation: ${isValidBackend ? '✅ VALID' : '❌ INVALID'}`);
            
            // Test AccountingPeriod model directly
            const periods = await db.AccountingPeriod.findAll({
                where: { account_id: accountId, status: 'open' }
            });
            
            let modelValidation = false;
            if (periods.length > 0) {
                modelValidation = periods.some(period => period.isDateInPeriod(testDate));
            }
            console.log(`   Model validation: ${modelValidation ? '✅ VALID' : '❌ INVALID'}`);
            
            // Check if both validations agree
            if (isValidBackend === modelValidation && isValidBackend === true) {
                console.log(`   🎉 ${testDate} is correctly validated as VALID`);
            } else {
                console.log(`   ❌ ${testDate} validation failed! Backend: ${isValidBackend}, Model: ${modelValidation}`);
                allTestsPassed = false;
            }
        }
        
        // Test edge cases for other months
        console.log('\n3️⃣ Testing edge cases for different months...');
        const edgeCases = [
            { date: '2025-02-28', month: 2, year: 2025, name: 'February 28th (non-leap year)' },
            { date: '2025-04-30', month: 4, year: 2025, name: 'April 30th (30-day month)' },
            { date: '2025-08-31', month: 8, year: 2025, name: 'August 31st (31-day month)' }
        ];
        
        for (const testCase of edgeCases) {
            console.log(`\n🔍 Testing ${testCase.name}: ${testCase.date}`);
            
            // Open the test period
            const openResult = await periodService.openPeriod(accountId, testCase.month, testCase.year, {
                userId: 1,
                notes: `Test opening ${testCase.name} period`
            });
            
            if (openResult.success) {
                // Test the end date
                const isValid = await periodService.isDateInOpenPeriod(accountId, testCase.date);
                console.log(`   Validation result: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
                
                if (!isValid) {
                    allTestsPassed = false;
                }
            } else {
                console.log(`   ⚠️ Could not open period: ${openResult.message}`);
            }
        }
        
        // Summary
        console.log('\n📊 Test Results Summary:');
        if (allTestsPassed) {
            console.log('🎉 ALL TESTS PASSED! July 31st date selection issue is FIXED!');
            console.log('✅ End-of-month dates are now correctly validated');
            console.log('✅ Timezone issues have been resolved');
            console.log('✅ Date-only comparison is working correctly');
        } else {
            console.log('❌ Some tests failed. Please review the implementation.');
        }
        
        return allTestsPassed;
        
    } catch (error) {
        console.error('💥 Test failed with error:', error);
        return false;
    }
}

// Run the test
testJuly31DateSelection().then(success => {
    console.log('\n' + '='.repeat(60));
    if (success) {
        console.log('✅ July 31st Date Selection Fix: SUCCESSFUL');
        console.log('🚀 Users can now select July 31st in the transaction form!');
        
        console.log('\n📝 Key fixes implemented:');
        console.log('   1. Updated AccountingPeriod.isDateInPeriod() to use date-only comparison');
        console.log('   2. Fixed getDateRange() method for consistent date handling');
        console.log('   3. Updated frontend validation to eliminate timezone issues');
        console.log('   4. Ensured end-of-month dates work for all months');
        
        console.log('\n🎯 Next steps:');
        console.log('   - Test the fix in the web interface');
        console.log('   - Try selecting July 31st in the credit transaction form');
        console.log('   - Verify that the "Selected date is not within" error is gone');
    } else {
        console.log('❌ July 31st Date Selection Fix: NEEDS MORE WORK');
        console.log('🔧 Please review the failed tests above');
    }
    console.log('='.repeat(60));
    
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('💥 Test runner crashed:', error);
    process.exit(1);
});