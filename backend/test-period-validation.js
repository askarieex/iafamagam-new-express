const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://iafauser:iafapassword@localhost:5432/iafadb');

// Import the periodService directly
const periodService = require('./src/services/periodManagementService');

async function testNewPeriodRules() {
    console.log('🧪 Testing New Period Management Rules\n');

    try {
        const accountId = 17;

        // Test 1: Get valid previous month
        console.log('📅 Test 1: Get Valid Previous Month');
        const validPeriod = await periodService.getValidPreviousMonth(accountId);
        console.log('Valid Period Result:', JSON.stringify(validPeriod, null, 2));
        console.log('');

        // Test 2: Validate back period opening for July 2025 (should be valid as it's immediate previous)
        console.log('📅 Test 2: Validate Back Period Opening for July 2025');
        try {
            const backValidation = await periodService.validateBackPeriodOpening(accountId, 7, 2025);
            console.log('Back period validation for July 2025:', backValidation);
        } catch (error) {
            console.log('Back period validation error:', error.message);
        }
        console.log('');

        // Test 3: Validate back period opening for June 2025 (should be invalid - too far back)
        console.log('📅 Test 3: Validate Back Period Opening for June 2025 (Should Fail)');
        try {
            const backValidationJune = await periodService.validateBackPeriodOpening(accountId, 6, 2025);
            console.log('Back period validation for June 2025:', backValidationJune);
        } catch (error) {
            console.log('Back period validation error (expected):', error.message);
        }
        console.log('');

        // Test 4: Validate period closure for August 2025 (current month - should fail until month ends)
        console.log('📅 Test 4: Validate Period Closure for August 2025 (Current Month)');
        try {
            const closureValidation = await periodService.validatePeriodClosure(accountId, 8, 2025);
            console.log('Period closure validation for August 2025:', closureValidation);
        } catch (error) {
            console.log('Period closure validation error:', error.message);
        }
        console.log('');

        // Test 5: Test opening current period (August 2025) - should work
        console.log('📅 Test 5: Test Opening Current Period (August 2025)');
        try {
            // This should work since August is current month
            const openResult = await periodService.openPeriod(accountId, 8, 2025, {
                userId: 1,
                isAutoOpened: false
            });
            console.log('Open current period result:', JSON.stringify(openResult, null, 2));
        } catch (error) {
            console.log('Open current period error:', error.message);
        }
        console.log('');

        console.log('✅ Period Management Rule Tests Completed\n');

    } catch (error) {
        console.error('❌ Test Error:', error.message);
        console.error(error.stack);
    }
}

// Run the tests
if (require.main === module) {
    testNewPeriodRules().then(() => {
        console.log('Tests completed');
        process.exit(0);
    }).catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = testNewPeriodRules;