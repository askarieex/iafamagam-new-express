const db = require('../models');
const { Op } = require('sequelize');

/**
 * Get all ledger heads
 * @route GET /api/ledger-heads
 */
exports.getAllLedgerHeads = async (req, res) => {
    try {
        const { account_id } = req.query;

        // Build query condition based on parameters
        const whereCondition = {};
        if (account_id) {
            whereCondition.account_id = account_id;
        }

        const ledgerHeads = await db.LedgerHead.findAll({
            where: whereCondition,
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                }
            ],
            order: [['name', 'ASC']]
        });

        return res.status(200).json({
            success: true,
            count: ledgerHeads.length,
            data: ledgerHeads
        });
    } catch (error) {
        console.error('Error fetching ledger heads:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve ledger heads',
            error: error.message
        });
    }
};

/**
 * Get ledger head by ID
 * @route GET /api/ledger-heads/:id
 */
exports.getLedgerHeadById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: 'Valid ledger head ID is required'
            });
        }

        const ledgerHead = await db.LedgerHead.findByPk(id, {
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                }
            ]
        });

        if (!ledgerHead) {
            return res.status(404).json({
                success: false,
                message: `Ledger head with ID ${id} not found`
            });
        }

        return res.status(200).json({
            success: true,
            data: ledgerHead
        });
    } catch (error) {
        console.error('Error fetching ledger head:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve ledger head',
            error: error.message
        });
    }
};

/**
 * Create a new ledger head
 * @route POST /api/ledger-heads
 */
exports.createLedgerHead = async (req, res) => {
    try {
        const { account_id, name, head_type, current_balance, cash_balance, bank_balance, description } = req.body;

        // Validate required fields
        if (!account_id || !name || !head_type) {
            return res.status(400).json({
                success: false,
                message: 'Account ID, name and head type are required'
            });
        }

        // Validate head_type
        if (!['debit', 'credit'].includes(head_type)) {
            return res.status(400).json({
                success: false,
                message: 'Head type must be either "debit" or "credit"'
            });
        }

        // Check if account exists
        const account = await db.Account.findByPk(account_id);
        if (!account) {
            return res.status(404).json({
                success: false,
                message: `Account with ID ${account_id} not found`
            });
        }

        // Set initial balance values
        const initialCurrentBalance = current_balance || 0.00;
        const initialCashBalance = cash_balance !== undefined ? cash_balance : initialCurrentBalance; // Default to current_balance if not specified
        const initialBankBalance = bank_balance || 0.00;

        // Create new ledger head
        const newLedgerHead = await db.LedgerHead.create({
            account_id,
            name,
            head_type,
            current_balance: initialCurrentBalance,
            cash_balance: initialCashBalance,
            bank_balance: initialBankBalance,
            description: description || null
        });

        // Get the created ledger head with account details
        const createdLedgerHead = await db.LedgerHead.findByPk(newLedgerHead.id, {
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                }
            ]
        });

        return res.status(201).json({
            success: true,
            message: 'Ledger head created successfully',
            data: createdLedgerHead
        });
    } catch (error) {
        console.error('Error creating ledger head:', error);

        // Check for validation errors
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors.map(e => e.message)
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to create ledger head',
            error: error.message
        });
    }
};

/**
 * Update a ledger head
 * @route PATCH /api/ledger-heads/:id
 */
exports.updateLedgerHead = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, head_type, current_balance, cash_balance, bank_balance, description } = req.body;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: 'Valid ledger head ID is required'
            });
        }

        // Find the ledger head
        const ledgerHead = await db.LedgerHead.findByPk(id);

        if (!ledgerHead) {
            return res.status(404).json({
                success: false,
                message: `Ledger head with ID ${id} not found`
            });
        }

        // Validate head_type if provided
        if (head_type && !['debit', 'credit'].includes(head_type)) {
            return res.status(400).json({
                success: false,
                message: 'Head type must be either "debit" or "credit"'
            });
        }

        // Update ledger head fields
        const updatedData = {};
        if (name !== undefined) updatedData.name = name;
        if (head_type !== undefined) updatedData.head_type = head_type;
        if (current_balance !== undefined) updatedData.current_balance = current_balance;
        if (cash_balance !== undefined) updatedData.cash_balance = cash_balance;
        if (bank_balance !== undefined) updatedData.bank_balance = bank_balance;
        if (description !== undefined) updatedData.description = description;

        // If only current_balance is updated but not cash/bank, put the difference in cash
        if (current_balance !== undefined && cash_balance === undefined && bank_balance === undefined) {
            const currentTotal = parseFloat(ledgerHead.cash_balance) + parseFloat(ledgerHead.bank_balance);
            const newTotal = parseFloat(current_balance);
            const difference = newTotal - currentTotal;

            if (difference !== 0) {
                updatedData.cash_balance = parseFloat(ledgerHead.cash_balance) + difference;
            }
        }

        // Perform update
        await ledgerHead.update(updatedData);

        // Get the updated ledger head with account details
        const updatedLedgerHead = await db.LedgerHead.findByPk(id, {
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                }
            ]
        });

        return res.status(200).json({
            success: true,
            message: 'Ledger head updated successfully',
            data: updatedLedgerHead
        });
    } catch (error) {
        console.error('Error updating ledger head:', error);

        // Check for validation errors
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors.map(e => e.message)
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to update ledger head',
            error: error.message
        });
    }
};

/**
 * Delete a ledger head
 * @route DELETE /api/ledger-heads/:id
 */
exports.deleteLedgerHead = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: 'Valid ledger head ID is required'
            });
        }

        // Find the ledger head
        const ledgerHead = await db.LedgerHead.findByPk(id);

        if (!ledgerHead) {
            return res.status(404).json({
                success: false,
                message: `Ledger head with ID ${id} not found`
            });
        }

        // Check if this ledger head is referenced in monthly_ledger_balances table
        const referencedInMonthlyBalance = await db.MonthlyLedgerBalance.findOne({
            where: { ledger_head_id: id }
        });

        if (referencedInMonthlyBalance) {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete ledger head as it is used in monthly ledger balances. You must delete those records first.'
            });
        }

        // Delete the ledger head
        await ledgerHead.destroy();

        return res.status(200).json({
            success: true,
            message: 'Ledger head deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting ledger head:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete ledger head',
            error: error.message
        });
    }
}; 