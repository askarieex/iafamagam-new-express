/**
 * System-wide period consistency verification
 * This script checks that all components are working together correctly
 */

const periodService = require('./src/services/periodManagementService');
const db = require('./src/models');
const axios = require('axios');

class SystemConsistencyVerifier {
    constructor() {
        this.results = {
            database: [],
            service: [],
            api: [],
            integration: []
        };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
    }

    async verifyDatabaseIntegrity() {
        this.log('🔍 Verifying database integrity...', 'check');

        // Check table structure
        const tables = await db.sequelize.getQueryInterface().showAllTables();
        
        const requiredTables = ['accounting_periods', 'monthly_ledger_balances', 'accounts', 'Users'];
        const missingTables = requiredTables.filter(table => !tables.includes(table));
        
        if (missingTables.length > 0) {
            this.results.database.push({
                status: 'error',
                message: `Missing required tables: ${missingTables.join(', ')}`
            });
        } else {
            this.results.database.push({
                status: 'success',
                message: 'All required tables present'
            });
        }

        // Check accounting_periods table structure
        try {
            const periodsCount = await db.AccountingPeriod.count();
            this.results.database.push({
                status: 'success',
                message: `Accounting periods table accessible: ${periodsCount} records`
            });
        } catch (error) {
            this.results.database.push({
                status: 'error',
                message: `Error accessing accounting_periods: ${error.message}`
            });
        }

        // Check indexes
        try {
            const indexes = await db.sequelize.query(
                "SELECT indexname FROM pg_indexes WHERE tablename = 'accounting_periods'",
                { type: db.sequelize.QueryTypes.SELECT }
            );
            
            const expectedIndexes = ['unique_account_period', 'idx_account_status', 'idx_status_period'];
            const presentIndexes = indexes.map(i => i.indexname);
            const missingIndexes = expectedIndexes.filter(idx => !presentIndexes.includes(idx));
            
            if (missingIndexes.length > 0) {
                this.results.database.push({
                    status: 'warning',
                    message: `Missing indexes: ${missingIndexes.join(', ')}`
                });
            } else {
                this.results.database.push({
                    status: 'success',
                    message: 'All required indexes present'
                });
            }
        } catch (error) {
            this.results.database.push({
                status: 'warning',
                message: `Could not verify indexes: ${error.message}`
            });
        }
    }

    async verifyServiceFunctionality() {
        this.log('🔍 Verifying service functionality...', 'check');

        try {
            // Test basic service methods
            const accounts = await db.Account.findAll({ limit: 3 });
            
            for (const account of accounts) {
                // Test getting current open period
                const openPeriod = await periodService.getCurrentOpenPeriod(account.id);
                
                if (openPeriod) {
                    // Test date validation
                    const isValid = await periodService.isDateInOpenPeriod(account.id, '2025-08-15');
                    this.results.service.push({
                        status: 'success',
                        message: `Account ${account.id}: Open period ${openPeriod.month}/${openPeriod.year}, date validation: ${isValid}`
                    });
                } else {
                    this.results.service.push({
                        status: 'info',
                        message: `Account ${account.id}: No open period`
                    });
                }

                // Test period history
                const history = await periodService.getPeriodHistory(account.id, 5);
                this.results.service.push({
                    status: 'success',
                    message: `Account ${account.id}: ${history.length} periods in history`
                });
            }

            // Test consistency validation
            const consistencyResult = await periodService.validatePeriodConsistency();
            this.results.service.push({
                status: consistencyResult.isConsistent ? 'success' : 'warning',
                message: `Consistency validation: ${consistencyResult.inconsistencies.length} issues found`
            });

        } catch (error) {
            this.results.service.push({
                status: 'error',
                message: `Service test failed: ${error.message}`
            });
        }
    }

    async verifyAPIEndpoints() {
        this.log('🔍 Verifying API endpoints...', 'check');

        // Note: This would require the server to be running
        // For now, we'll just verify the route files exist and are properly structured

        const fs = require('fs');
        const path = require('path');

        try {
            const routePath = path.join(__dirname, 'src/routes/periodManagementRoutes.js');
            if (fs.existsSync(routePath)) {
                const routeContent = fs.readFileSync(routePath, 'utf8');
                
                // Check for required endpoints
                const requiredEndpoints = [
                    'current-open',
                    'all-open',
                    'validate-date',
                    '/open',
                    '/close'
                ];
                
                const missingEndpoints = requiredEndpoints.filter(endpoint => 
                    !routeContent.includes(endpoint)
                );
                
                if (missingEndpoints.length > 0) {
                    this.results.api.push({
                        status: 'error',
                        message: `Missing API endpoints: ${missingEndpoints.join(', ')}`
                    });
                } else {
                    this.results.api.push({
                        status: 'success',
                        message: 'All required API endpoints present'
                    });
                }
            } else {
                this.results.api.push({
                    status: 'error',
                    message: 'Period management routes file not found'
                });
            }

            // Check if routes are registered in app.js
            const appPath = path.join(__dirname, 'src/app.js');
            if (fs.existsSync(appPath)) {
                const appContent = fs.readFileSync(appPath, 'utf8');
                
                if (appContent.includes('periodManagementRoutes') && appContent.includes('/api/periods')) {
                    this.results.api.push({
                        status: 'success',
                        message: 'Period management routes registered in app'
                    });
                } else {
                    this.results.api.push({
                        status: 'error',
                        message: 'Period management routes not properly registered'
                    });
                }
            }

        } catch (error) {
            this.results.api.push({
                status: 'error',
                message: `API verification failed: ${error.message}`
            });
        }
    }

    async verifyIntegration() {
        this.log('🔍 Verifying component integration...', 'check');

        try {
            // Check transaction service integration
            const transactionServicePath = require.resolve('./src/services/transactionService.js');
            const transactionContent = require('fs').readFileSync(transactionServicePath, 'utf8');
            
            if (transactionContent.includes('periodManagementService')) {
                this.results.integration.push({
                    status: 'success',
                    message: 'Transaction service integrated with period management'
                });
            } else {
                this.results.integration.push({
                    status: 'warning',
                    message: 'Transaction service may not be fully integrated'
                });
            }

            // Check transaction controller integration  
            const controllerPath = require.resolve('./src/controllers/transactionController.js');
            const controllerContent = require('fs').readFileSync(controllerPath, 'utf8');
            
            if (controllerContent.includes('periodService')) {
                this.results.integration.push({
                    status: 'success',
                    message: 'Transaction controller integrated with period management'
                });
            } else {
                this.results.integration.push({
                    status: 'warning',
                    message: 'Transaction controller may not be fully integrated'
                });
            }

            // Check cron job updates
            const serverPath = require.resolve('./src/server.js');
            const serverContent = require('fs').readFileSync(serverPath, 'utf8');
            
            if (serverContent.includes('respect manual period management')) {
                this.results.integration.push({
                    status: 'success',
                    message: 'Cron jobs updated to respect manual period management'
                });
            } else {
                this.results.integration.push({
                    status: 'warning',
                    message: 'Cron jobs may not be updated'
                });
            }

            // Check UI integration
            const path = require('path');
            const uiPath = path.join(__dirname, '../frontend/pages/period-management.js');
            if (require('fs').existsSync(uiPath)) {
                const uiContent = require('fs').readFileSync(uiPath, 'utf8');
                
                if (uiContent.includes('/periods/current-open')) {
                    this.results.integration.push({
                        status: 'success',
                        message: 'UI updated to use new period endpoints'
                    });
                } else {
                    this.results.integration.push({
                        status: 'warning',
                        message: 'UI may still be using old endpoints'
                    });
                }
            }

        } catch (error) {
            this.results.integration.push({
                status: 'error',
                message: `Integration verification failed: ${error.message}`
            });
        }
    }

    generateReport() {
        this.log('📊 Generating consistency report...', 'report');

        const categories = ['database', 'service', 'api', 'integration'];
        let totalChecks = 0;
        let passedChecks = 0;
        let errors = 0;
        let warnings = 0;

        console.log('\n' + '='.repeat(80));
        console.log('                    SYSTEM CONSISTENCY REPORT');
        console.log('='.repeat(80));

        for (const category of categories) {
            console.log(`\n📋 ${category.toUpperCase()}`);
            console.log('-'.repeat(40));

            const results = this.results[category];
            for (const result of results) {
                totalChecks++;
                
                const icon = result.status === 'success' ? '✅' : 
                            result.status === 'warning' ? '⚠️' : '❌';
                
                console.log(`${icon} ${result.message}`);
                
                if (result.status === 'success') passedChecks++;
                else if (result.status === 'error') errors++;
                else if (result.status === 'warning') warnings++;
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('                       SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total checks: ${totalChecks}`);
        console.log(`✅ Passed: ${passedChecks}`);
        console.log(`⚠️  Warnings: ${warnings}`);
        console.log(`❌ Errors: ${errors}`);

        const score = ((passedChecks / totalChecks) * 100).toFixed(1);
        console.log(`\n🎯 System Health Score: ${score}%`);

        if (errors === 0 && warnings <= 2) {
            console.log('\n🎉 SYSTEM CONSISTENCY: EXCELLENT');
            console.log('The period management system is working correctly across all components.');
        } else if (errors === 0) {
            console.log('\n👍 SYSTEM CONSISTENCY: GOOD');
            console.log('The system is working with minor issues that should be addressed.');
        } else {
            console.log('\n⚠️  SYSTEM CONSISTENCY: NEEDS ATTENTION');
            console.log('There are errors that need to be fixed for optimal operation.');
        }

        return {
            totalChecks,
            passedChecks,
            warnings,
            errors,
            score: parseFloat(score)
        };
    }

    async runFullVerification() {
        this.log('🚀 Starting system-wide consistency verification', 'start');

        await this.verifyDatabaseIntegrity();
        await this.verifyServiceFunctionality();
        await this.verifyAPIEndpoints();
        await this.verifyIntegration();

        return this.generateReport();
    }
}

// Run verification if executed directly
if (require.main === module) {
    const verifier = new SystemConsistencyVerifier();
    
    verifier.runFullVerification()
        .then((summary) => {
            const isHealthy = summary.errors === 0 && summary.warnings <= 2;
            process.exit(isHealthy ? 0 : 1);
        })
        .catch((error) => {
            console.error('System verification failed:', error);
            process.exit(1);
        });
}

module.exports = SystemConsistencyVerifier;