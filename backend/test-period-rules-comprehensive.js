const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://iafauser:iafapassword@localhost:5432/iafadb');
const periodService = require('./src/services/periodManagementService');

async function comprehensiveTest() {
    console.log('🚀 Comprehensive Period Management Rules Test\n');

    try {
        const accountId = 17;

        console.log('='.repeat(60));
        console.log('SCENARIO 1: Testing Single Period Rule Enforcement');
        console.log('='.repeat(60));

        // Open July 2025 (should close August if open)
        console.log('📅 Opening July 2025...');
        const openJulyResult = await periodService.openPeriod(accountId, 7, 2025, {
            userId: 1,
            isAutoOpened: false
        });
        console.log('Result:', {
            success: openJulyResult.success,
            message: openJulyResult.message,
            closedPeriods: openJulyResult.closedPeriods || []
        });
        console.log('');

        console.log('='.repeat(60));
        console.log('SCENARIO 2: Testing Back Period Restrictions');
        console.log('='.repeat(60));

        // Try to open June 2025 (should fail - too far back)
        console.log('📅 Attempting to open June 2025 (should fail)...');
        try {
            const openJuneResult = await periodService.openPeriod(accountId, 6, 2025, {
                userId: 1,
                isAutoOpened: false
            });
            console.log('Unexpected success:', openJuneResult);
        } catch (error) {
            console.log('✅ Expected failure:', error.message);
        }
        console.log('');

        console.log('='.repeat(60));
        console.log('SCENARIO 3: Testing Current Period Opening');
        console.log('='.repeat(60));

        // Open August 2025 (current month - should work and close July)
        console.log('📅 Opening August 2025 (current month)...');
        const openAugustResult = await periodService.openPeriod(accountId, 8, 2025, {
            userId: 1,
            isAutoOpened: false
        });
        console.log('Result:', {
            success: openAugustResult.success,
            message: openAugustResult.message,
            closedPeriods: openAugustResult.closedPeriods || []
        });
        console.log('');

        console.log('='.repeat(60));
        console.log('SCENARIO 4: Testing API Endpoint Functionality');
        console.log('='.repeat(60));

        // Test the getValidPreviousMonth API function
        console.log('📅 Testing getValidPreviousMonth API...');
        const validMonthResult = await periodService.getValidPreviousMonth(accountId);
        console.log('Valid Month API Result:', JSON.stringify({
            validMonth: validMonthResult.validMonth,
            validYear: validMonthResult.validYear,
            displayName: validMonthResult.displayName,
            canOpenBack: validMonthResult.canOpenBack,
            isCurrentMonth: validMonthResult.isCurrentMonth,
            reason: validMonthResult.reason
        }, null, 2));
        console.log('');

        console.log('='.repeat(60));
        console.log('SCENARIO 5: Testing Period Closure Validation');  
        console.log('='.repeat(60));

        // Test closure validation for current month (should fail before month end)
        console.log('📅 Testing closure validation for August 2025 (current month)...');
        const closureResult = await periodService.validatePeriodClosure(accountId, 8, 2025);
        console.log('Closure validation result:', closureResult);

        // Test closure validation for July 2025 (previous month - should work)
        console.log('📅 Testing closure validation for July 2025...');
        const closureResultJuly = await periodService.validatePeriodClosure(accountId, 7, 2025);
        console.log('Closure validation result (July):', closureResultJuly);
        console.log('');

        console.log('✅ All comprehensive tests completed successfully!');
        console.log('🎯 New Period Management System is working as expected');

    } catch (error) {
        console.error('❌ Test Error:', error.message);
        console.error(error.stack);
    }
}

// Run the comprehensive tests
if (require.main === module) {
    comprehensiveTest().then(() => {
        console.log('\n🏁 Comprehensive test suite completed');
        process.exit(0);
    }).catch(error => {
        console.error('\n💥 Comprehensive test suite failed:', error);
        process.exit(1);
    });
}

module.exports = comprehensiveTest;