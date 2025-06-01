const monthlyClosureService = require('../services/monthlyClosureService');

/**
 * This job is intended to be run on the last day of each month
 * It will automatically close the accounting period for all accounts
 * 
 * Can be executed manually or scheduled via node-cron
 */
async function runMonthEndClosure() {
    try {
        // Get current date
        const now = new Date();

        // Get the month that's ending (current month)
        const monthToClose = now.getMonth() + 1; // 1-12
        const yearToClose = now.getFullYear();

        console.log(`[MONTH-END-CLOSURE] Starting month-end closure for ${monthToClose}/${yearToClose}`);

        // Call the closeAccountingPeriod service (for all accounts)
        const result = await monthlyClosureService.closeAccountingPeriod(monthToClose, yearToClose);

        console.log(`[MONTH-END-CLOSURE] Month-end closure completed successfully`);
        console.log(`[MONTH-END-CLOSURE] Accounts processed: ${result.results.accountsProcessed}`);
        console.log(`[MONTH-END-CLOSURE] Ledger heads processed: ${result.results.ledgerHeadsProcessed}`);
        console.log(`[MONTH-END-CLOSURE] Snapshots created: ${result.results.snapshotsCreated}`);
        console.log(`[MONTH-END-CLOSURE] Snapshots updated: ${result.results.snapshotsUpdated}`);
        console.log(`[MONTH-END-CLOSURE] Next month prepared: ${result.results.nextMonthPrepared}`);

        return result;
    } catch (error) {
        console.error('[MONTH-END-CLOSURE] Error running month-end closure:', error);
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