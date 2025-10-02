/**
 * Snapshot Backfill Script
 *
 * This script generates monthly balance snapshots for historical months
 * that don't have snapshots yet. It's designed to populate the database
 * with historical snapshot data.
 */

const { MonthlyBalanceSummary, Account } = require('../src/models');
const monthlySnapshotService = require('../src/services/monthlySnapshotService');

/**
 * Backfill snapshots for a specific account and date range
 */
async function backfillSnapshots(accountId, startYear, startMonth, endYear, endMonth) {
    try {
        console.log(`🔄 Starting snapshot backfill for account ${accountId}`);
        console.log(`📅 Date range: ${startYear}-${startMonth} to ${endYear}-${endMonth}`);

        let currentYear = startYear;
        let currentMonth = startMonth;
        let totalProcessed = 0;
        let totalGenerated = 0;
        let totalSkipped = 0;

        while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
            console.log(`\n📊 Processing ${currentYear}-${String(currentMonth).padStart(2, '0')}`);

            try {
                // Check if snapshots already exist for this month
                const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
                const existingSnapshots = await MonthlyBalanceSummary.findAll({
                    where: {
                        account_id: accountId,
                        month_year: monthKey
                    }
                });

                if (existingSnapshots.length > 0) {
                    console.log(`   ⚠️  Snapshots already exist (${existingSnapshots.length} records), skipping`);
                    totalSkipped++;
                } else {
                    // Generate snapshots for this month
                    console.log(`   🔄 Generating snapshots...`);
                    await monthlySnapshotService.generateMonthlySnapshots(accountId, currentYear, currentMonth);
                    console.log(`   ✅ Snapshots generated successfully`);
                    totalGenerated++;
                }

                totalProcessed++;

            } catch (error) {
                console.error(`   ❌ Error processing ${currentYear}-${currentMonth}:`, error.message);
            }

            // Move to next month
            currentMonth++;
            if (currentMonth > 12) {
                currentMonth = 1;
                currentYear++;
            }
        }

        console.log(`\n📊 Backfill Summary:`);
        console.log(`   Total months processed: ${totalProcessed}`);
        console.log(`   Snapshots generated: ${totalGenerated}`);
        console.log(`   Months skipped (already had snapshots): ${totalSkipped}`);
        console.log(`✅ Backfill completed for account ${accountId}`);

        return {
            totalProcessed,
            totalGenerated,
            totalSkipped
        };

    } catch (error) {
        console.error('❌ Fatal error during backfill:', error);
        throw error;
    }
}

/**
 * Backfill snapshots for all accounts
 */
async function backfillAllAccounts(startYear, startMonth, endYear, endMonth) {
    try {
        console.log(`🚀 Starting backfill for ALL ACCOUNTS`);

        // Get all accounts
        const accounts = await Account.findAll({
            attributes: ['id', 'name']
        });

        console.log(`📝 Found ${accounts.length} accounts to process`);

        let grandTotal = {
            totalProcessed: 0,
            totalGenerated: 0,
            totalSkipped: 0
        };

        for (const account of accounts) {
            console.log(`\n🏦 Processing account: ${account.name} (ID: ${account.id})`);

            try {
                const result = await backfillSnapshots(account.id, startYear, startMonth, endYear, endMonth);

                grandTotal.totalProcessed += result.totalProcessed;
                grandTotal.totalGenerated += result.totalGenerated;
                grandTotal.totalSkipped += result.totalSkipped;

            } catch (error) {
                console.error(`❌ Error processing account ${account.id}:`, error.message);
            }
        }

        console.log(`\n🎉 GRAND TOTAL SUMMARY:`);
        console.log(`   Accounts processed: ${accounts.length}`);
        console.log(`   Total months processed: ${grandTotal.totalProcessed}`);
        console.log(`   Total snapshots generated: ${grandTotal.totalGenerated}`);
        console.log(`   Total months skipped: ${grandTotal.totalSkipped}`);
        console.log(`✅ Backfill completed for all accounts`);

        return grandTotal;

    } catch (error) {
        console.error('❌ Fatal error during all-accounts backfill:', error);
        throw error;
    }
}

/**
 * Main execution function
 */
async function main() {
    try {
        console.log('🚀 Monthly Snapshot Backfill Script');
        console.log('=====================================\n');

        // Parse command line arguments
        const args = process.argv.slice(2);

        if (args.length === 0) {
            console.log('📋 Usage options:');
            console.log('  node backfillSnapshots.js all <startYear> <startMonth> <endYear> <endMonth>');
            console.log('  node backfillSnapshots.js <accountId> <startYear> <startMonth> <endYear> <endMonth>');
            console.log('\n📋 Examples:');
            console.log('  node backfillSnapshots.js all 2023 1 2024 12  # All accounts, 2023-2024');
            console.log('  node backfillSnapshots.js 25 2024 1 2024 8   # Account 25, Jan-Aug 2024');
            process.exit(1);
        }

        const [target, startYear, startMonth, endYear, endMonth] = args;

        // Validate arguments
        if (!startYear || !startMonth || !endYear || !endMonth) {
            console.error('❌ Missing required arguments');
            process.exit(1);
        }

        const startYearNum = parseInt(startYear);
        const startMonthNum = parseInt(startMonth);
        const endYearNum = parseInt(endYear);
        const endMonthNum = parseInt(endMonth);

        if (isNaN(startYearNum) || isNaN(startMonthNum) || isNaN(endYearNum) || isNaN(endMonthNum)) {
            console.error('❌ Invalid year or month values');
            process.exit(1);
        }

        if (startMonthNum < 1 || startMonthNum > 12 || endMonthNum < 1 || endMonthNum > 12) {
            console.error('❌ Month values must be between 1 and 12');
            process.exit(1);
        }

        // Execute backfill
        if (target === 'all') {
            await backfillAllAccounts(startYearNum, startMonthNum, endYearNum, endMonthNum);
        } else {
            const accountId = parseInt(target);
            if (isNaN(accountId)) {
                console.error('❌ Invalid account ID');
                process.exit(1);
            }
            await backfillSnapshots(accountId, startYearNum, startMonthNum, endYearNum, endMonthNum);
        }

        console.log('\n🎉 Script completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
    }
}

// Export functions for potential API use
module.exports = {
    backfillSnapshots,
    backfillAllAccounts
};

// Run main function if script is executed directly
if (require.main === module) {
    main();
}