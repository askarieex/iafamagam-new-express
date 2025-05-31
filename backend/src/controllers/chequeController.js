const chequeService = require('../services/chequeService');

class ChequeController {
    /**
     * Get all cheques with filtering
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getAllCheques(req, res) {
        try {
            // Extract filter parameters
            const filters = {
                status: req.query.status,
                account_id: req.query.account_id,
                ledger_head_id: req.query.ledger_head_id,
                from_date: req.query.from_date,
                to_date: req.query.to_date,
                tx_type: req.query.tx_type
            };

            const result = await chequeService.listCheques(filters);

            return res.status(200).json({
                success: true,
                data: result.cheques,
                totalPendingValue: result.totalPendingValue,
                totalCancelledValue: result.totalCancelledValue,
                totalClearedValue: result.totalClearedValue,
                totalDebitValue: result.totalDebitValue,
                totalCreditValue: result.totalCreditValue,
                counts: result.counts
            });
        } catch (error) {
            console.error('Error getting cheques:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error getting cheques'
            });
        }
    }

    /**
     * Get cheque by ID
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getChequeById(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'Cheque ID is required'
                });
            }

            const cheque = await chequeService.getChequeById(id);

            return res.status(200).json({
                success: true,
                data: cheque
            });
        } catch (error) {
            console.error('Error getting cheque:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error getting cheque'
            });
        }
    }

    /**
     * Get available bank balance for a ledger head
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getAvailableBankBalance(req, res) {
        try {
            const { ledger_head_id } = req.query;

            if (!ledger_head_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Ledger head ID is required'
                });
            }

            const balanceInfo = await chequeService.calculateAvailableBankBalance(ledger_head_id);

            return res.status(200).json({
                success: true,
                data: balanceInfo
            });
        } catch (error) {
            console.error('Error getting available bank balance:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error getting available bank balance'
            });
        }
    }

    /**
     * Clear a cheque
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async clearCheque(req, res) {
        try {
            const { id } = req.params;
            const { clearing_date } = req.body;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'Cheque ID is required'
                });
            }

            const result = await chequeService.clearCheque(id, clearing_date || new Date());

            return res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    cheque: result.cheque,
                    transaction: result.transaction
                }
            });
        } catch (error) {
            console.error('Error clearing cheque:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error clearing cheque'
            });
        }
    }

    /**
     * Cancel a cheque
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async cancelCheque(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'Cheque ID is required'
                });
            }

            const result = await chequeService.cancelCheque(id, reason);

            return res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    cheque: result.cheque,
                    transaction: result.transaction
                }
            });
        } catch (error) {
            console.error('Error cancelling cheque:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error cancelling cheque'
            });
        }
    }

    /**
     * Fix missing cheque records for transactions
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async fixMissingChequeRecords(req, res) {
        try {
            const result = await chequeService.fixMissingChequeRecords();

            return res.status(200).json({
                success: true,
                message: result.message,
                data: result.createdCheques
            });
        } catch (error) {
            console.error('Error fixing missing cheque records:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error fixing missing cheque records'
            });
        }
    }
}

module.exports = new ChequeController(); 