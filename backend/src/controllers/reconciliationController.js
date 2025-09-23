/**
 * Manually trigger the balance reconciliation job
 * @route POST /api/reconciliation/balances
 */
exports.triggerBalanceReconciliation = async (req, res) => {
    try {
        // Note: Balance reconciliation job has been removed as part of period management cleanup
        // This endpoint is maintained for backward compatibility but returns a notice

        return res.status(200).json({
            success: true,
            message: 'Balance reconciliation is no longer needed with the simplified transaction system',
            note: 'Period management and complex balance reconciliation have been removed for system simplicity'
        });
    } catch (error) {
        console.error('Error in reconciliation endpoint:', error);
        return res.status(500).json({
            success: false,
            message: 'Error in reconciliation endpoint',
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