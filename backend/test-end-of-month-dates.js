const db = require('./src/models');

/**
 * Comprehensive test for end-of-month date validation
 * Tests all months including edge cases (leap years, 30-day months, 31-day months)
 */
async function testEndOfMonthDates() {
    console.log('🧪 Testing End-of-Month Date Validation...');
    
    try {
        // Test cases for different month types
        const testCases = [
            // Regular 31-day months
            { month: 1, year: 2025, lastDay: 31, name: 'January' },
            { month: 3, year: 2025, lastDay: 31, name: 'March' },
            { month: 5, year: 2025, lastDay: 31, name: 'May' },
            { month: 7, year: 2025, lastDay: 31, name: 'July' }, // The original problem month
            { month: 8, year: 2025, lastDay: 31, name: 'August' },
            { month: 10, year: 2025, lastDay: 31, name: 'October' },
            { month: 12, year: 2025, lastDay: 31, name: 'December' },
            
            // 30-day months
            { month: 4, year: 2025, lastDay: 30, name: 'April' },
            { month: 6, year: 2025, lastDay: 30, name: 'June' },
            { month: 9, year: 2025, lastDay: 30, name: 'September' },
            { month: 11, year: 2025, lastDay: 30, name: 'November' },
            
            // February - non-leap year
            { month: 2, year: 2025, lastDay: 28, name: 'February (non-leap)' },
            
            // February - leap year
            { month: 2, year: 2024, lastDay: 29, name: 'February (leap year)' }
        ];
        
        console.log(`📅 Testing ${testCases.length} different month types...`);
        
        let allTestsPassed = true;
        let totalTests = 0;
        let passedTests = 0;
        
        for (const testCase of testCases) {
            console.log(`\n🔍 Testing ${testCase.name} ${testCase.year}:`);
            
            // Test dates: first day, middle day, last day, and invalid day
            const datesToTest = [
                { day: 1, shouldPass: true, description: 'first day' },
                { day: 15, shouldPass: true, description: 'middle day' },
                { day: testCase.lastDay, shouldPass: true, description: 'last day' },
                { day: testCase.lastDay + 1, shouldPass: false, description: 'invalid day (beyond month end)' }
            ];
            
            // Create a real AccountingPeriod instance for testing
            const AccountingPeriod = db.AccountingPeriod;
            const mockPeriod = new AccountingPeriod({
                month: testCase.month,
                year: testCase.year
            });
            
            for (const dateTest of datesToTest) {
                totalTests++;
                
                // Format date string
                const dateString = `${testCase.year}-${String(testCase.month).padStart(2, '0')}-${String(dateTest.day).padStart(2, '0')}`;
                
                try {
                    const isValid = mockPeriod.isDateInPeriod(dateString);
                    const testPassed = isValid === dateTest.shouldPass;
                    
                    if (testPassed) {
                        console.log(`   ✅ ${dateString} (${dateTest.description}): ${isValid ? 'VALID' : 'INVALID'} - as expected`);
                        passedTests++;
                    } else {
                        console.log(`   ❌ ${dateString} (${dateTest.description}): ${isValid ? 'VALID' : 'INVALID'} - expected ${dateTest.shouldPass ? 'VALID' : 'INVALID'}`);
                        allTestsPassed = false;
                    }
                } catch (error) {
                    console.log(`   💥 ${dateString} (${dateTest.description}): ERROR - ${error.message}`);
                    allTestsPassed = false;
                }
            }
        }
        
        // Test some edge cases with actual Date constructor issues
        console.log('\n🔍 Testing edge cases that commonly cause timezone issues:');
        
        const edgeCases = [
            '2025-07-31T00:00:00.000Z', // UTC midnight
            '2025-07-31T23:59:59.999Z', // End of day UTC
            '2025-07-31', // ISO date string
            new Date(2025, 6, 31), // Date object (month is 0-indexed)
            new Date('2025-07-31'), // Date from string
        ];
        
        const AccountingPeriod = db.AccountingPeriod;
        const julyPeriod = new AccountingPeriod({
            month: 7,
            year: 2025
        });
        
        for (const edgeCase of edgeCases) {
            totalTests++;
            try {
                const isValid = julyPeriod.isDateInPeriod(edgeCase);
                if (isValid) {
                    console.log(`   ✅ ${edgeCase.toString()}: VALID`);
                    passedTests++;
                } else {
                    console.log(`   ❌ ${edgeCase.toString()}: INVALID (should be valid for July 31st)`);
                    allTestsPassed = false;
                }
            } catch (error) {
                console.log(`   💥 ${edgeCase.toString()}: ERROR - ${error.message}`);
                allTestsPassed = false;
            }
        }
        
        // Summary
        console.log(`\n📊 Test Results:`);
        console.log(`   Total tests: ${totalTests}`);
        console.log(`   Passed: ${passedTests}`);
        console.log(`   Failed: ${totalTests - passedTests}`);
        console.log(`   Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
        
        if (allTestsPassed) {
            console.log('\n🎉 ALL END-OF-MONTH DATE TESTS PASSED!');
            console.log('✅ All month types work correctly (28, 29, 30, 31 day months)');
            console.log('✅ Leap year handling is correct');
            console.log('✅ Invalid dates are properly rejected');
            console.log('✅ Timezone edge cases are handled correctly');
        } else {
            console.log('\n❌ Some end-of-month date tests failed');
        }
        
        return allTestsPassed;
        
    } catch (error) {
        console.error('💥 End-of-month date test failed:', error);
        return false;
    }
}

// Run the test
testEndOfMonthDates().then(success => {
    console.log('\n' + '='.repeat(60));
    if (success) {
        console.log('✅ End-of-Month Date Validation: ALL TESTS PASSED!');
        console.log('🎯 The July 31st issue has been completely resolved');
        console.log('🚀 All end-of-month dates now work correctly');
        
        console.log('\n📋 Summary of fixes:');
        console.log('   ✅ July 31st can now be selected');
        console.log('   ✅ All 31-day months work (Jan, Mar, May, Jul, Aug, Oct, Dec)');
        console.log('   ✅ All 30-day months work (Apr, Jun, Sep, Nov)');
        console.log('   ✅ February works for both leap and non-leap years');
        console.log('   ✅ Invalid dates (like Feb 30) are properly rejected');
        console.log('   ✅ Timezone issues eliminated with date-only comparison');
        
        console.log('\n🎯 Ready for production!');
        console.log('   Users can now reliably select end-of-month dates');
        console.log('   The "Selected date is not within" error is fixed');
    } else {
        console.log('❌ End-of-Month Date Validation: SOME TESTS FAILED');
        console.log('🔧 Please review the failed test cases above');
    }
    console.log('='.repeat(60));
    
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('💥 End-of-month test runner crashed:', error);
    process.exit(1);
});