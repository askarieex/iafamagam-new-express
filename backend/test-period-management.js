/**
 * Comprehensive test suite for the new Period Management System
 * Tests all major operations and edge cases
 */

const periodService = require('./src/services/periodManagementService');
const db = require('./src/models');

class PeriodManagementTester {
    constructor() {
        this.testResults = [];
        this.testAccount = null;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
        console.log(logMessage);
        
        this.testResults.push({
            timestamp,
            type,
            message
        });
    }

    async runTest(testName, testFunction) {
        try {
            this.log(`Starting test: ${testName}`, 'test');
            await testFunction();
            this.log(`✅ Test passed: ${testName}`, 'pass');
            return true;
        } catch (error) {
            this.log(`❌ Test failed: ${testName} - ${error.message}`, 'fail');
            console.error(error);
            return false;
        }
    }

    async setupTestData() {
        this.log('Setting up test data...', 'setup');
        
        // Find or create a test account
        this.testAccount = await db.Account.findOne({
            where: { name: 'Test Account - Period Management' }
        });

        if (!this.testAccount) {
            this.testAccount = await db.Account.create({
                name: 'Test Account - Period Management',
                cash_balance: 0,
                bank_balance: 0,
                closing_balance: 0,
                is_active: true
            });
        }

        this.log(`Using test account: ${this.testAccount.id} - ${this.testAccount.name}`, 'setup');
    }

    async cleanupTestData() {
        this.log('Cleaning up test data...', 'cleanup');
        
        if (this.testAccount) {
            // Close all periods for test account
            await db.AccountingPeriod.destroy({
                where: { account_id: this.testAccount.id }
            });
            
            // Optionally remove test account
            // await this.testAccount.destroy();
        }
    }

    async testPeriodCreation() {
        const accountId = this.testAccount.id;
        const month = 8;
        const year = 2025;

        // Test opening a new period
        const result = await periodService.openPeriod(accountId, month, year, {
            userId: 1,
            notes: 'Test period creation',
            isAutoOpened: false
        });

        if (!result.success) {
            throw new Error(`Failed to open period: ${result.message}`);
        }

        // Verify period was created
        const period = await periodService.getPeriod(accountId, month, year);
        if (!period || period.status !== 'open') {
            throw new Error('Period was not created correctly');
        }

        this.log(`Period created successfully: ${month}/${year} for account ${accountId}`);
    }

    async testPeriodStatusQueries() {
        const accountId = this.testAccount.id;

        // Test getting current open period
        const openPeriod = await periodService.getCurrentOpenPeriod(accountId);
        if (!openPeriod) {
            throw new Error('No open period found');
        }

        // Test date validation
        const isValidDate = await periodService.isDateInOpenPeriod(accountId, '2025-08-15');
        if (!isValidDate) {
            throw new Error('Date validation failed for open period');
        }

        const isInvalidDate = await periodService.isDateInOpenPeriod(accountId, '2025-07-15');
        if (isInvalidDate) {
            throw new Error('Date validation incorrectly passed for closed period');
        }

        this.log('Period status queries working correctly');
    }

    async testPeriodConstraints() {
        const accountId = this.testAccount.id;

        // Try to open another period (should fail - only one period can be open)
        try {
            await periodService.openPeriod(accountId, 9, 2025);
            throw new Error('Should not allow opening multiple periods');
        } catch (error) {
            if (!error.message.includes('already open')) {
                throw new Error(`Unexpected error: ${error.message}`);
            }
        }

        this.log('Period constraints working correctly (only one open period allowed)');
    }

    async testPeriodClosing() {
        const accountId = this.testAccount.id;
        const month = 8;
        const year = 2025;

        // Close the open period
        const result = await periodService.closePeriod(accountId, month, year, {
            userId: 1,
            notes: 'Test period closing'
        });

        if (!result.success) {
            throw new Error(`Failed to close period: ${result.message}`);
        }

        // Verify period was closed
        const period = await periodService.getPeriod(accountId, month, year);
        if (!period || period.status !== 'closed') {
            throw new Error('Period was not closed correctly');
        }

        // Verify no open period exists
        const openPeriod = await periodService.getCurrentOpenPeriod(accountId);
        if (openPeriod) {
            throw new Error('Open period still exists after closing');
        }

        this.log(`Period closed successfully: ${month}/${year} for account ${accountId}`);
    }

    async testAutoEnsureCurrentPeriod() {
        const accountId = this.testAccount.id;

        // Test auto-opening current period when none is open
        const result = await periodService.autoEnsureCurrentPeriodOpen(accountId);
        
        if (!result.success) {
            throw new Error(`Auto-ensure failed: ${result.message}`);
        }

        // Verify a period is now open
        const openPeriod = await periodService.getCurrentOpenPeriod(accountId);
        if (!openPeriod) {
            throw new Error('Auto-ensure did not open a period');
        }

        // Test that calling it again doesn't create another period
        const result2 = await periodService.autoEnsureCurrentPeriodOpen(accountId);
        if (result2.autoOpened) {
            throw new Error('Auto-ensure incorrectly opened another period');
        }

        this.log('Auto-ensure current period working correctly');
    }

    async testPeriodHistory() {
        const accountId = this.testAccount.id;

        // Get period history
        const history = await periodService.getPeriodHistory(accountId, 10);
        
        if (!Array.isArray(history)) {
            throw new Error('Period history should return an array');
        }

        if (history.length === 0) {
            throw new Error('Period history should contain periods');
        }

        this.log(`Period history retrieved: ${history.length} periods found`);
    }

    async testConsistencyValidation() {
        // Test the consistency validation
        const result = await periodService.validatePeriodConsistency();
        
        if (!result.success) {
            throw new Error('Consistency validation failed');
        }

        this.log(`Consistency validation completed: ${result.inconsistencies.length} issues found`);
        
        if (result.inconsistencies.length > 0) {
            this.log('Inconsistencies found:', 'warn');
            result.inconsistencies.forEach(issue => {
                this.log(`  - ${issue.type}: ${issue.description}`, 'warn');
            });
        }
    }

    async testErrorHandling() {
        const accountId = this.testAccount.id;

        // Test invalid month
        try {
            await periodService.openPeriod(accountId, 13, 2025);
            throw new Error('Should reject invalid month');
        } catch (error) {
            if (!error.message.includes('Invalid month')) {
                throw new Error(`Unexpected error: ${error.message}`);
            }
        }

        // Test invalid year
        try {
            await periodService.openPeriod(accountId, 1, 1999);
            throw new Error('Should reject invalid year');
        } catch (error) {
            if (!error.message.includes('Invalid year')) {
                throw new Error(`Unexpected error: ${error.message}`);
            }
        }

        // Test non-existent account
        try {
            await periodService.openPeriod(99999, 1, 2025);
            throw new Error('Should reject non-existent account');
        } catch (error) {
            if (!error.message.includes('not found')) {
                throw new Error(`Unexpected error: ${error.message}`);
            }
        }

        this.log('Error handling working correctly');
    }

    async runAllTests() {
        const startTime = Date.now();
        let passedTests = 0;
        let totalTests = 0;

        this.log('🚀 Starting comprehensive period management tests', 'start');

        try {
            await this.setupTestData();

            const tests = [
                ['Period Creation', () => this.testPeriodCreation()],
                ['Period Status Queries', () => this.testPeriodStatusQueries()],
                ['Period Constraints', () => this.testPeriodConstraints()],
                ['Period Closing', () => this.testPeriodClosing()],
                ['Auto-Ensure Current Period', () => this.testAutoEnsureCurrentPeriod()],
                ['Period History', () => this.testPeriodHistory()],
                ['Consistency Validation', () => this.testConsistencyValidation()],
                ['Error Handling', () => this.testErrorHandling()]
            ];

            for (const [testName, testFunction] of tests) {
                totalTests++;
                const passed = await this.runTest(testName, testFunction);
                if (passed) passedTests++;
            }

            await this.cleanupTestData();

        } catch (error) {
            this.log(`Test suite failed: ${error.message}`, 'fail');
            console.error(error);
        }

        const duration = Date.now() - startTime;
        
        this.log('📊 Test Summary', 'summary');
        this.log(`Total tests: ${totalTests}`, 'summary');
        this.log(`Passed: ${passedTests}`, 'summary');
        this.log(`Failed: ${totalTests - passedTests}`, 'summary');
        this.log(`Duration: ${duration}ms`, 'summary');
        
        if (passedTests === totalTests) {
            this.log('🎉 All tests passed!', 'success');
            return true;
        } else {
            this.log('❌ Some tests failed', 'fail');
            return false;
        }
    }
}

// Run the tests if executed directly
if (require.main === module) {
    const tester = new PeriodManagementTester();
    
    tester.runAllTests()
        .then((allPassed) => {
            process.exit(allPassed ? 0 : 1);
        })
        .catch((error) => {
            console.error('Test runner failed:', error);
            process.exit(1);
        });
}

module.exports = PeriodManagementTester;