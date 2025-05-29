const db = require('../models');

// Create a new account
exports.createAccount = async (req, res) => {
    try {
        const { name, opening_balance, cash_balance, bank_balance } = req.body;

        // Basic validation
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Account name is required'
            });
        }

        // Create account with provided data
        const newAccount = await db.Account.create({
            name,
            opening_balance: opening_balance || 0.00,
            closing_balance: opening_balance || 0.00, // Initially same as opening balance
            cash_balance: cash_balance || 0.00,
            bank_balance: bank_balance || 0.00
        });

        return res.status(201).json({
            success: true,
            data: newAccount
        });
    } catch (error) {
        console.error('Error creating account:', error);

        // Check for unique constraint violation
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                message: 'An account with this name already exists'
            });
        }

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
            message: 'Error creating account',
            error: error.message
        });
    }
};

// Get all accounts
exports.getAllAccounts = async (req, res) => {
    try {
        const accounts = await db.Account.findAll();

        return res.status(200).json({
            success: true,
            count: accounts.length,
            data: accounts
        });
    } catch (error) {
        console.error('Error retrieving accounts:', error);
        return res.status(500).json({
            success: false,
            message: 'Error retrieving accounts',
            error: error.message
        });
    }
};

// Get single account by ID
exports.getAccountById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: 'Valid account ID is required'
            });
        }

        const account = await db.Account.findByPk(id);

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: account
        });
    } catch (error) {
        console.error('Error retrieving account:', error);
        return res.status(500).json({
            success: false,
            message: 'Error retrieving account',
            error: error.message
        });
    }
};

// Update account
exports.updateAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, opening_balance, closing_balance, cash_balance, bank_balance } = req.body;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: 'Valid account ID is required'
            });
        }

        // Find account by ID
        const account = await db.Account.findByPk(id);

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }

        // Update account fields
        const updatedAccount = await account.update({
            name: name || account.name,
            opening_balance: opening_balance !== undefined ? opening_balance : account.opening_balance,
            closing_balance: closing_balance !== undefined ? closing_balance : account.closing_balance,
            cash_balance: cash_balance !== undefined ? cash_balance : account.cash_balance,
            bank_balance: bank_balance !== undefined ? bank_balance : account.bank_balance
        });

        return res.status(200).json({
            success: true,
            data: updatedAccount
        });
    } catch (error) {
        console.error('Error updating account:', error);

        // Check for unique constraint violation
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                message: 'An account with this name already exists'
            });
        }

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
            message: 'Error updating account',
            error: error.message
        });
    }
};

// Delete account
exports.deleteAccount = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: 'Valid account ID is required'
            });
        }

        // Find account by ID
        const account = await db.Account.findByPk(id);

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }

        // Delete the account
        await account.destroy();

        return res.status(200).json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting account:', error);
        return res.status(500).json({
            success: false,
            message: 'Error deleting account',
            error: error.message
        });
    }
}; 