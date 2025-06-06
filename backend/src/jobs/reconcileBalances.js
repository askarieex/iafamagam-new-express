const db = require('../models');
const { sequelize } = db;
const { logAction } = require('../utils/auditLogger');

/**
 * Nightly job that reconciles ledger balances with monthly snapshots
 * This job ensures data consistency by comparing ledgerHead.current_balance 
 * with the most recent MonthlyLedgerBalance.closing_balance
 */
async function reconcileBalances() {
    console.log('[RECONCILE] Starting balance reconciliation job');

    const transaction = await sequelize.transaction();

    try {
        // Get all ledger heads with their accounts
        const ledgerHeads = await db.LedgerHead.findAll({
            include: [{
                model: db.Account,
                as: 'account'
            }],
            transaction
        });

        let fixCount = 0;
        let errorCount = 0;
        const discrepancies = [];

        // Process each ledger head
        for (const ledgerHead of ledgerHeads) {
            try {
                // Find the most recent monthly snapshot for this ledger head
                const lastSnapshot = await db.MonthlyLedgerBalance.findOne({
                    where: {
                        account_id: ledgerHead.account_id,
                        ledger_head_id: ledgerHead.id
                    },
                    order: [
                        ['year', 'DESC'],
                        ['month', 'DESC']
                    ],
                    transaction
                });

                if (!lastSnapshot) {
                    console.log(`[RECONCILE] No snapshots found for ledger head ${ledgerHead.id} (${ledgerHead.name})`);
                    continue;
                }

                const currentBalance = parseFloat(ledgerHead.current_balance || 0);
                const snapshotBalance = parseFloat(lastSnapshot.closing_balance || 0);

                // Check if there's a meaningful discrepancy (avoid floating point issues)
                if (Math.abs(currentBalance - snapshotBalance) > 0.01) {
                    console.log(`[RECONCILE] Discrepancy found: ledgerHead ${ledgerHead.id} (${ledgerHead.name}) ` +
                        `current_balance ${currentBalance} != last snapshot ${snapshotBalance}`);

                    // Auto-correct the ledger head balance
                    await ledgerHead.update({
                        current_balance: snapshotBalance
                    }, { transaction });

                    // Log the correction
                    await logAction(
                        null, // System action
                        'RECONCILE_BALANCE',
                        'LedgerHead',
                        ledgerHead.id,
                        `Auto-corrected balance from ${currentBalance} to ${snapshotBalance}`,
                        transaction
                    );

                    discrepancies.push({
                        ledgerHeadId: ledgerHead.id,
                        ledgerHeadName: ledgerHead.name,
                        accountId: ledgerHead.account_id,
                        accountName: ledgerHead.account?.name || 'Unknown',
                        oldBalance: currentBalance,
                        newBalance: snapshotBalance,
                        snapshotMonth: lastSnapshot.month,
                        snapshotYear: lastSnapshot.year
                    });

                    fixCount++;
                }
            } catch (error) {
                console.error(`[RECONCILE] Error processing ledger head ${ledgerHead.id}:`, error);
                errorCount++;
            }
        }

        await transaction.commit();

        console.log(`[RECONCILE] Reconciliation complete: ${fixCount} balances corrected, ${errorCount} errors`);
        return {
            success: true,
            fixCount,
            errorCount,
            discrepancies
        };
    } catch (error) {
        await transaction.rollback();
        console.error('[RECONCILE] Failed to complete reconciliation job:', error);

        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = reconcileBalances;