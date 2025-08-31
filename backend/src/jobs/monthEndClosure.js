const periodService = require('../services/periodManagementService');
const db = require('../models');

/**
 * This job respects manual period management and only auto-opens periods
 * It will NOT automatically close periods as this interferes with manual management
 * 
 * Can be executed manually or scheduled via node-cron
 */
async function runMonthEndClosure() {
    try {
        // Get current date
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();

        console.log(`[MONTH-END-CLOSURE] Starting period maintenance for ${currentMonth}/${currentYear}`);
        console.log(`[MONTH-END-CLOSURE] Note: This job respects manual period management and will NOT auto-close periods`);

        // Get all active accounts
        const accounts = await db.Account.findAll({
            where: { is_active: true }
        });

        let processedAccounts = 0;
        let autoOpenedCount = 0;
        let alreadyOpenCount = 0;

        // For each account, ensure current period is available (but don't force close anything)
        for (const account of accounts) {
            try {
                // Check if any period is open for this account
                const openPeriod = await periodService.getCurrentOpenPeriod(account.id);
                
                if (openPeriod) {
                    console.log(`[MONTH-END-CLOSURE] Account ${account.id} (${account.name}) has open period: ${openPeriod.month}/${openPeriod.year}`);
                    alreadyOpenCount++;
                } else {
                    // No period is open - auto-open current period
                    console.log(`[MONTH-END-CLOSURE] Account ${account.id} (${account.name}) has no open period - auto-opening current month`);
                    
                    const result = await periodService.autoEnsureCurrentPeriodOpen(account.id);
                    
                    if (result.success && result.autoOpened) {
                        console.log(`[MONTH-END-CLOSURE] Auto-opened period for account ${account.id}`);
                        autoOpenedCount++;
                    } else {
                        console.log(`[MONTH-END-CLOSURE] Period already available for account ${account.id}`);
                        alreadyOpenCount++;
                    }
                }

                processedAccounts++;
            } catch (error) {
                console.error(`[MONTH-END-CLOSURE] Error processing account ${account.id}:`, error);
            }
        }

        console.log(`[MONTH-END-CLOSURE] Period maintenance completed successfully`);
        console.log(`[MONTH-END-CLOSURE] Accounts processed: ${processedAccounts}`);
        console.log(`[MONTH-END-CLOSURE] Periods auto-opened: ${autoOpenedCount}`);
        console.log(`[MONTH-END-CLOSURE] Periods already open: ${alreadyOpenCount}`);

        return {
            success: true,
            results: {
                accountsProcessed: processedAccounts,
                autoOpenedCount,
                alreadyOpenCount
            }
        };
    } catch (error) {
        console.error('[MONTH-END-CLOSURE] Error running period maintenance:', error);
        throw error;
    }
}

// If executed directly (node monthEndClosure.js), run the job
if (require.main === module) {
    // Set up the database connection
    const db = require('../models');

    db.sequelize.authenticate()
        .then(() => {
            console.log('[MONTH-END-CLOSURE] Database connected successfully');
            return runMonthEndClosure();
        })
        .then(result => {
            console.log('[MONTH-END-CLOSURE] Job completed successfully');
            process.exit(0);
        })
        .catch(err => {
            console.error('[MONTH-END-CLOSURE] Job failed:', err);
            process.exit(1);
        });
}

module.exports = runMonthEndClosure; 