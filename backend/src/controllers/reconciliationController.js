const reconcileBalances = require('../jobs/reconcileBalances');
const { logAction } = require('../utils/auditLogger');

/**
 * Manually trigger the balance reconciliation job
 * @route POST /api/reconciliation/balances
 */
exports.triggerBalanceReconciliation = async (req, res) => {
    try {
        const results = await reconcileBalances();
        
        // Log this manual action
        await logAction(
            req.user?.id,
            'MANUAL_RECONCILIATION',
            'System',
            null,
            `Manual balance reconciliation triggered by user`
        );

        return res.status(200).json({
            success: true,
            message: 'Balance reconciliation completed',
            data: results
        });
    } catch (error) {
        console.error('Error triggering balance reconciliation:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to trigger balance reconciliation',
            error: error.message
        });
    }
};

/**
 * Get reconciliation history (from audit logs)
 * @route GET /api/reconciliation/history
 */
exports.getReconciliationHistory = async (req, res) => {
    try {
        const { db } = require('../models');
        
        // Get audit logs for reconciliation actions
        const auditLogs = await db.AuditLog.findAll({
            where: {
                action: 'RECONCILE_BALANCE'
            },
            order: [['created_at', 'DESC']],
            limit: 100,
            include: [
                {
                    model: db.User,
                    as: 'user',
                    attributes: ['id', 'name', 'email']
                }
            ]
        });
        
        return res.status(200).json({
            success: true,
            data: auditLogs
        });
    } catch (error) {
        console.error('Error fetching reconciliation history:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch reconciliation history',
            error: error.message
        });
    }
}; 