/**
 * Balance Recalculation Controller
 *
 * API endpoints to recalculate and validate balances
 */

const balanceRecalculationService = require('../services/balanceRecalculationService');

class BalanceRecalculationController {

    /**
     * Recalculate all balances
     * @route POST /api/admin/recalculate-balances
     */
    async recalculateAllBalances(req, res) {
        try {
            console.log('🔄 Admin request: Recalculate all balances');

            const result = await balanceRecalculationService.recalculateAllBalances();

            return res.json({
                success: true,
                data: result,
                message: 'All balances recalculated successfully'
            });

        } catch (error) {
            console.error('❌ Error recalculating all balances:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to recalculate balances',
                error: error.message
            });
        }
    }

    /**
     * Recalculate balances for specific account
     * @route POST /api/admin/recalculate-balances/:accountId
     */
    async recalculateAccountBalances(req, res) {
        try {
            const { accountId } = req.params;
            console.log(`🔄 Admin request: Recalculate balances for account ${accountId}`);

            const result = await balanceRecalculationService.recalculateAccountBalances(accountId);

            return res.json({
                success: true,
                data: result,
                message: `Balances recalculated successfully for account ${accountId}`
            });

        } catch (error) {
            console.error(`❌ Error recalculating account ${req.params.accountId} balances:`, error);
            return res.status(500).json({
                success: false,
                message: 'Failed to recalculate account balances',
                error: error.message
            });
        }
    }

    /**
     * Validate balances against transaction log
     * @route GET /api/admin/validate-balances
     */
    async validateBalances(req, res) {
        try {
            console.log('🔄 Admin request: Validate all balances');

            const result = await balanceRecalculationService.validateBalances();

            return res.json({
                success: true,
                data: result,
                message: 'Balance validation completed'
            });

        } catch (error) {
            console.error('❌ Error validating balances:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to validate balances',
                error: error.message
            });
        }
    }

    /**
     * Recalculate specific ledger head balance
     * @route POST /api/admin/recalculate-balance/:ledgerHeadId
     */
    async recalculateLedgerHeadBalance(req, res) {
        try {
            const { ledgerHeadId } = req.params;
            console.log(`🔄 Admin request: Recalculate balance for ledger head ${ledgerHeadId}`);

            const result = await balanceRecalculationService.recalculateLedgerHeadBalance(ledgerHeadId);

            return res.json({
                success: true,
                data: result,
                message: `Balance recalculated successfully for ledger head ${ledgerHeadId}`
            });

        } catch (error) {
            console.error(`❌ Error recalculating ledger head ${req.params.ledgerHeadId} balance:`, error);
            return res.status(500).json({
                success: false,
                message: 'Failed to recalculate ledger head balance',
                error: error.message
            });
        }
    }
}

module.exports = new BalanceRecalculationController();