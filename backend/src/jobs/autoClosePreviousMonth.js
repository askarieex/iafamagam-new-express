const periodService = require('../services/periodManagementService');
const db = require('../models');

/**
 * DISABLED: Auto-close functionality removed to respect manual period management
 * This job now only ensures current periods are available without closing any periods
 */
async function autoClosePreviousMonth() {
    try {
        console.log('[AUTO-CLOSE] Starting period maintenance job');
        console.log('[AUTO-CLOSE] NOTE: Auto-closing is DISABLED to respect manual period management');
        console.log('[AUTO-CLOSE] This job will only ensure current periods are available');

        // Get current date
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();

        // Get all active accounts
        const accounts = await db.Account.findAll({
            where: { is_active: true }
        });

        let processedAccounts = 0;
        let autoOpenedCount = 0;
        let alreadyOpenCount = 0;

        // For each account, ensure current period is available (but don't close anything)
        for (const account of accounts) {
            try {
                // Check if any period is open for this account
                const openPeriod = await periodService.getCurrentOpenPeriod(account.id);
                
                if (openPeriod) {
                    console.log(`[AUTO-CLOSE] Account ${account.id} (${account.name}) has open period: ${openPeriod.month}/${openPeriod.year}`);
                    alreadyOpenCount++;
                } else {
                    // No period is open - auto-open current period only if it's the current month
                    console.log(`[AUTO-CLOSE] Account ${account.id} (${account.name}) has no open period - auto-opening current month`);
                    
                    const result = await periodService.autoEnsureCurrentPeriodOpen(account.id);
                    
                    if (result.success && result.autoOpened) {
                        console.log(`[AUTO-CLOSE] Auto-opened current period for account ${account.id}`);
                        autoOpenedCount++;
                    } else {
                        console.log(`[AUTO-CLOSE] Current period already available for account ${account.id}`);
                        alreadyOpenCount++;
                    }
                }

                processedAccounts++;
            } catch (error) {
                console.error(`[AUTO-CLOSE] Error processing account ${account.id}:`, error);
            }
        }

        console.log('[AUTO-CLOSE] Period maintenance completed');
        console.log(`[AUTO-CLOSE] Accounts processed: ${processedAccounts}`);
        console.log(`[AUTO-CLOSE] Periods auto-opened: ${autoOpenedCount}`);
        console.log(`[AUTO-CLOSE] Periods already available: ${alreadyOpenCount}`);
        console.log('[AUTO-CLOSE] Remember: Manual period closing is required for proper accounting control');

        return {
            success: true,
            results: {
                accountsProcessed: processedAccounts,
                autoOpenedCount,
                alreadyOpenCount
            }
        };
    } catch (error) {
        console.error('[AUTO-CLOSE] Error in period maintenance job:', error);
        throw error;
    }
}

module.exports = autoClosePreviousMonth; 