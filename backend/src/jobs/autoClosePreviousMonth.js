const { Account } = require('../models');
const monthlyClosureService = require('../services/monthlyClosureService');

/**
 * Auto-close previous month when a new month starts
 */
async function autoClosePreviousMonth() {
    try {
        console.log('Running auto-close for previous month');

        // Get current date and previous month
        const now = new Date();
        const prevMonth = now.getMonth(); // 0-11 (current month - 1)
        const year = now.getFullYear();

        // Get all accounts
        const accounts = await Account.findAll();

        // For each account, close the previous month if it's not already closed
        for (const account of accounts) {
            const accountId = account.id;

            // Check last closed date
            const lastClosedDate = account.last_closed_date ? new Date(account.last_closed_date) : null;

            // If account has no last closed date or last closed date is before previous month's end
            if (!lastClosedDate ||
                lastClosedDate.getMonth() < prevMonth ||
                (lastClosedDate.getMonth() > prevMonth && lastClosedDate.getFullYear() < year)) {

                console.log(`Auto-closing month ${prevMonth + 1}/${year} for account ${accountId}`);

                try {
                    // Close previous month
                    await monthlyClosureService.closeAccountingPeriod(
                        prevMonth + 1, // Convert to 1-12 format
                        year,
                        accountId
                    );

                    console.log(`Successfully auto-closed month ${prevMonth + 1}/${year} for account ${accountId}`);
                } catch (closureError) {
                    console.error(`Error closing month ${prevMonth + 1}/${year} for account ${accountId}:`, closureError);
                }
            } else {
                console.log(`Month ${prevMonth + 1}/${year} already closed for account ${accountId}`);
            }
        }

        console.log('Auto-close process completed');
    } catch (error) {
        console.error('Error in autoClosePreviousMonth job:', error);
    }
}

module.exports = autoClosePreviousMonth; 