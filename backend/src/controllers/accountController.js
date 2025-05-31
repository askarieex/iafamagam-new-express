const db = require('../models');
const transactionService = require('../services/transactionService');

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

        // Parse and validate balance values
        const parsedOpeningBalance = parseFloat(opening_balance || 0);
        const parsedCashBalance = parseFloat(cash_balance || 0);
        const parsedBankBalance = parseFloat(bank_balance || 0);

        // Ensure closing balance is the sum of cash and bank balances
        const calculatedClosingBalance = parsedCashBalance + parsedBankBalance;

        // Create account with provided data
        const newAccount = await db.Account.create({
            name,
            opening_balance: parsedOpeningBalance,
            closing_balance: calculatedClosingBalance, // Derived from cash + bank
            cash_balance: parsedCashBalance,
            bank_balance: parsedBankBalance
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

        // Determine if cash_balance or bank_balance is being modified
        const isCashBalanceModified = cash_balance !== undefined;
        const isBankBalanceModified = bank_balance !== undefined;

        // Parse balance values
        const parsedCashBalance = isCashBalanceModified ? parseFloat(cash_balance) : parseFloat(account.cash_balance);
        const parsedBankBalance = isBankBalanceModified ? parseFloat(bank_balance) : parseFloat(account.bank_balance);

        // If either cash or bank balance is modified, recalculate the closing balance
        const shouldRecalculateClosing = isCashBalanceModified || isBankBalanceModified;
        const parsedClosingBalance = shouldRecalculateClosing
            ? parsedCashBalance + parsedBankBalance
            : (closing_balance !== undefined ? parseFloat(closing_balance) : parseFloat(account.closing_balance));

        // Update account fields
        const updatedAccount = await account.update({
            name: name || account.name,
            opening_balance: opening_balance !== undefined ? parseFloat(opening_balance) : account.opening_balance,
            closing_balance: parsedClosingBalance,
            cash_balance: parsedCashBalance,
            bank_balance: parsedBankBalance
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

// Synchronize account balances with ledger heads
exports.syncAccountBalances = async (req, res) => {
    try {
        const result = await transactionService.syncAccountBalances();

        return res.status(200).json({
            success: true,
            message: result.message,
            results: result.results
        });
    } catch (error) {
        console.error('Error synchronizing account balances:', error);
        return res.status(500).json({
            success: false,
            message: 'Error synchronizing account balances',
            error: error.message
        });
    }
};

// Get account balance summary with ledger details
exports.getAccountBalanceSummary = async (req, res) => {
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

        // Get all ledger heads for this account
        const ledgerHeads = await db.LedgerHead.findAll({
            where: { account_id: id },
            attributes: ['id', 'name', 'head_type', 'current_balance', 'cash_balance', 'bank_balance']
        });

        // Calculate totals from ledger heads
        const calculatedTotals = ledgerHeads.reduce(
            (totals, ledger) => {
                totals.totalBalance += parseFloat(ledger.current_balance);
                totals.totalCashBalance += parseFloat(ledger.cash_balance);
                totals.totalBankBalance += parseFloat(ledger.bank_balance);
                return totals;
            },
            { totalBalance: 0, totalCashBalance: 0, totalBankBalance: 0 }
        );

        // Check if account balance matches calculated balance
        const accountBalance = {
            closing_balance: parseFloat(account.closing_balance),
            cash_balance: parseFloat(account.cash_balance),
            bank_balance: parseFloat(account.bank_balance)
        };

        const isBalanced = {
            closing: Math.abs(accountBalance.closing_balance - calculatedTotals.totalBalance) < 0.01,
            cash: Math.abs(accountBalance.cash_balance - calculatedTotals.totalCashBalance) < 0.01,
            bank: Math.abs(accountBalance.bank_balance - calculatedTotals.totalBankBalance) < 0.01
        };

        return res.status(200).json({
            success: true,
            data: {
                account: {
                    id: account.id,
                    name: account.name,
                    closing_balance: accountBalance.closing_balance,
                    cash_balance: accountBalance.cash_balance,
                    bank_balance: accountBalance.bank_balance
                },
                ledgerHeads,
                calculatedTotals,
                isBalanced
            }
        });
    } catch (error) {
        console.error('Error getting account balance summary:', error);
        return res.status(500).json({
            success: false,
            message: 'Error getting account balance summary',
            error: error.message
        });
    }
}; 