const db = require('../models');
const { Op } = require('sequelize');

/**
 * Get all monthly ledger balances with optional filtering
 * @route GET /api/monthly-ledger-balances
 */
exports.getAllMonthlyBalances = async (req, res) => {
    try {
        const { account_id, ledger_head_id, month, year } = req.query;

        // Build query condition based on parameters
        const whereCondition = {};
        if (account_id) {
            whereCondition.account_id = account_id;
        }
        if (ledger_head_id) {
            whereCondition.ledger_head_id = ledger_head_id;
        }
        if (month) {
            whereCondition.month = month;
        }
        if (year) {
            whereCondition.year = year;
        }

        const monthlyBalances = await db.MonthlyLedgerBalance.findAll({
            where: whereCondition,
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                },
                {
                    model: db.LedgerHead,
                    as: 'ledgerHead',
                    attributes: ['id', 'name', 'head_type']
                }
            ],
            order: [
                ['year', 'DESC'],
                ['month', 'DESC'],
                ['account_id', 'ASC'],
                ['ledger_head_id', 'ASC']
            ]
        });

        return res.status(200).json({
            success: true,
            count: monthlyBalances.length,
            data: monthlyBalances
        });
    } catch (error) {
        console.error('Error fetching monthly ledger balances:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve monthly ledger balances',
            error: error.message
        });
    }
};

/**
 * Get monthly balance by ID
 * @route GET /api/monthly-ledger-balances/:id
 */
exports.getMonthlyBalanceById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: 'Valid monthly balance ID is required'
            });
        }

        const monthlyBalance = await db.MonthlyLedgerBalance.findByPk(id, {
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                },
                {
                    model: db.LedgerHead,
                    as: 'ledgerHead',
                    attributes: ['id', 'name', 'head_type']
                }
            ]
        });

        if (!monthlyBalance) {
            return res.status(404).json({
                success: false,
                message: `Monthly balance with ID ${id} not found`
            });
        }

        return res.status(200).json({
            success: true,
            data: monthlyBalance
        });
    } catch (error) {
        console.error('Error fetching monthly balance:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve monthly balance',
            error: error.message
        });
    }
};

/**
 * Create a new monthly balance
 * @route POST /api/monthly-ledger-balances
 */
exports.createMonthlyBalance = async (req, res) => {
    try {
        const {
            account_id,
            ledger_head_id,
            month,
            year,
            opening_balance,
            receipts,
            payments,
            cash_in_hand,
            cash_in_bank
        } = req.body;

        // Validate required fields
        if (!account_id || !ledger_head_id || !month || !year) {
            return res.status(400).json({
                success: false,
                message: 'account_id, ledger_head_id, month, and year are all required'
            });
        }

        // Validate month range
        if (month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                message: 'Month must be between 1 and 12'
            });
        }

        // Check if the account exists
        const account = await db.Account.findByPk(account_id);
        if (!account) {
            return res.status(404).json({
                success: false,
                message: `Account with ID ${account_id} not found`
            });
        }

        // Check if the ledger head exists
        const ledgerHead = await db.LedgerHead.findByPk(ledger_head_id);
        if (!ledgerHead) {
            return res.status(404).json({
                success: false,
                message: `Ledger head with ID ${ledger_head_id} not found`
            });
        }

        // Check if a record already exists for this combination
        const existingRecord = await db.MonthlyLedgerBalance.findOne({
            where: {
                account_id,
                ledger_head_id,
                month,
                year
            }
        });

        if (existingRecord) {
            return res.status(409).json({
                success: false,
                message: 'A monthly balance record already exists for this account, ledger head, month, and year'
            });
        }

        // Calculate closing balance
        const calculatedOpeningBalance = opening_balance || 0;
        const calculatedReceipts = receipts || 0;
        const calculatedPayments = payments || 0;
        const closingBalance = calculatedOpeningBalance + calculatedReceipts - calculatedPayments;

        // Create the monthly balance record
        const newMonthlyBalance = await db.MonthlyLedgerBalance.create({
            account_id,
            ledger_head_id,
            month,
            year,
            opening_balance: calculatedOpeningBalance,
            receipts: calculatedReceipts,
            payments: calculatedPayments,
            closing_balance: closingBalance,
            cash_in_hand: cash_in_hand || 0,
            cash_in_bank: cash_in_bank || 0
        });

        return res.status(201).json({
            success: true,
            message: 'Monthly balance record created successfully',
            data: newMonthlyBalance
        });
    } catch (error) {
        console.error('Error creating monthly balance:', error);

        // Check for unique constraint violation
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                success: false,
                message: 'A monthly balance record already exists for this account, ledger head, month, and year'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to create monthly balance record',
            error: error.message
        });
    }
};

/**
 * Update a monthly balance
 * @route PATCH /api/monthly-ledger-balances/:id
 */
exports.updateMonthlyBalance = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            opening_balance,
            receipts,
            payments,
            cash_in_hand,
            cash_in_bank,
            // Note: We don't allow updating account_id, ledger_head_id, month, or year
            // as they form the unique constraint
        } = req.body;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: 'Valid monthly balance ID is required'
            });
        }

        // Find the monthly balance record
        const monthlyBalance = await db.MonthlyLedgerBalance.findByPk(id);

        if (!monthlyBalance) {
            return res.status(404).json({
                success: false,
                message: `Monthly balance with ID ${id} not found`
            });
        }

        // Calculate new closing balance if needed
        let updateData = {};

        if (opening_balance !== undefined || receipts !== undefined || payments !== undefined) {
            const newOpeningBalance = opening_balance !== undefined ? opening_balance : monthlyBalance.opening_balance;
            const newReceipts = receipts !== undefined ? receipts : monthlyBalance.receipts;
            const newPayments = payments !== undefined ? payments : monthlyBalance.payments;

            updateData = {
                opening_balance: newOpeningBalance,
                receipts: newReceipts,
                payments: newPayments,
                closing_balance: newOpeningBalance + newReceipts - newPayments
            };
        }

        if (cash_in_hand !== undefined) {
            updateData.cash_in_hand = cash_in_hand;
        }

        if (cash_in_bank !== undefined) {
            updateData.cash_in_bank = cash_in_bank;
        }

        // Update the monthly balance record
        await monthlyBalance.update(updateData);

        // Fetch the updated record with associations
        const updatedMonthlyBalance = await db.MonthlyLedgerBalance.findByPk(id, {
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                },
                {
                    model: db.LedgerHead,
                    as: 'ledgerHead',
                    attributes: ['id', 'name', 'head_type']
                }
            ]
        });

        return res.status(200).json({
            success: true,
            message: 'Monthly balance record updated successfully',
            data: updatedMonthlyBalance
        });
    } catch (error) {
        console.error('Error updating monthly balance:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update monthly balance record',
            error: error.message
        });
    }
};

/**
 * Delete a monthly balance
 * @route DELETE /api/monthly-ledger-balances/:id
 */
exports.deleteMonthlyBalance = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: 'Valid monthly balance ID is required'
            });
        }

        // Find the monthly balance record
        const monthlyBalance = await db.MonthlyLedgerBalance.findByPk(id);

        if (!monthlyBalance) {
            return res.status(404).json({
                success: false,
                message: `Monthly balance with ID ${id} not found`
            });
        }

        // Delete the monthly balance record
        await monthlyBalance.destroy();

        return res.status(200).json({
            success: true,
            message: 'Monthly balance record deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting monthly balance:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete monthly balance record',
            error: error.message
        });
    }
};

/**
 * Generate monthly balance records for a specific month and year
 * @route POST /api/monthly-ledger-balances/generate
 */
exports.generateMonthlyBalances = async (req, res) => {
    try {
        const { month, year } = req.body;

        if (!month || !year) {
            return res.status(400).json({
                success: false,
                message: 'Month and year are required'
            });
        }

        // Validate month range
        if (month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                message: 'Month must be between 1 and 12'
            });
        }

        // Use the monthEndProcedure utility to generate balances
        const monthEndProcedure = require('../utils/monthEndProcedure');
        const results = await monthEndProcedure.runMonthEndProcedure(month, year);

        return res.status(200).json({
            success: results.success,
            message: `Monthly balance generation completed`,
            data: results
        });
    } catch (error) {
        console.error('Error generating monthly balances:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate monthly balance records',
            error: error.message
        });
    }
}; 