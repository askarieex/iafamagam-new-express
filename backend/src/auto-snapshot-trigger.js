/**
 * Auto-trigger for snapshot updates when backdated transactions are created
 * This should be integrated into the immutableTransactionService
 */

const db = require('./models');
const monthlySnapshotService = require('./services/monthlySnapshotService');

class AutoSnapshotTrigger {

    /**
     * Trigger snapshot updates for affected months when a backdated transaction is created
     */
    async triggerSnapshotUpdatesForBackdatedTransaction(accountId, transactionDate, affectedLedgerIds) {
        try {
            console.log(`🔄 Auto-triggering snapshot updates for backdated transaction on ${transactionDate}`);

            const transactionMonth = new Date(transactionDate);
            const currentDate = new Date();

            // Get all months from transaction month to current month
            const monthsToUpdate = [];
            let monthIterator = new Date(transactionMonth.getFullYear(), transactionMonth.getMonth(), 1);

            while (monthIterator <= currentDate) {
                monthsToUpdate.push({
                    year: monthIterator.getFullYear(),
                    month: monthIterator.getMonth() + 1
                });
                monthIterator.setMonth(monthIterator.getMonth() + 1);
            }

            console.log(`📅 Updating snapshots for months: ${monthsToUpdate.map(m => `${m.year}-${m.month}`).join(', ')}`);

            // Update snapshots for each affected ledger and month
            for (const ledgerHeadId of affectedLedgerIds) {
                for (const { year, month } of monthsToUpdate) {
                    console.log(`📸 Updating snapshot for ledger ${ledgerHeadId}, ${year}-${month}`);

                    // Delete existing snapshot
                    await db.MonthlyBalanceSummary.destroy({
                        where: {
                            account_id: accountId,
                            ledger_head_id: ledgerHeadId,
                            month_year: `${year}-${month.toString().padStart(2, '0')}-01`
                        }
                    });

                    // Recreate snapshot with updated data
                    await monthlySnapshotService.createMonthlySnapshot(accountId, ledgerHeadId, year, month);
                }
            }

            console.log('✅ Auto snapshot updates completed');

        } catch (error) {
            console.error('❌ Auto snapshot update failed:', error);
            throw error;
        }
    }
}

module.exports = new AutoSnapshotTrigger();