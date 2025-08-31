/**
 * Script to migrate existing period data from monthly_ledger_balances.is_open 
 * to the new accounting_periods table
 */

const periodService = require('./src/services/periodManagementService');

async function migratePeriodData() {
    try {
        console.log('🚀 Starting period data migration...');
        
        // Run the migration using the PeriodManagementService
        const result = await periodService.migrateExistingPeriodData();
        
        if (result.success) {
            console.log('✅ Migration completed successfully');
            console.log(`📊 Migration summary:`);
            console.log(`   - Periods found: ${result.totalFound}`);
            console.log(`   - Periods migrated: ${result.migratedCount}`);
            console.log(`   - Periods already existed: ${result.existingCount}`);
            
            // Now validate consistency
            console.log('\n🔍 Validating period consistency...');
            const validationResult = await periodService.validatePeriodConsistency();
            
            if (validationResult.success) {
                if (validationResult.isConsistent) {
                    console.log('✅ All periods are now consistent!');
                } else {
                    console.log(`⚠️  Found ${validationResult.inconsistencies.length} inconsistencies:`);
                    validationResult.inconsistencies.forEach(issue => {
                        console.log(`   - ${issue.type}: ${issue.description}`);
                    });
                }
            }
            
        } else {
            console.log('❌ Migration failed');
        }
        
        process.exit(result.success ? 0 : 1);

    } catch (error) {
        console.error('❌ Migration failed with error:', error);
        process.exit(1);
    }
}

// Run the migration
migratePeriodData();