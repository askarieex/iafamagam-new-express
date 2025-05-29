const db = require('../models');

/**
 * Get all bank accounts
 * @route GET /api/bank-accounts
 */
exports.getAllBankAccounts = async (req, res) => {
    try {
        const bankAccounts = await db.BankAccount.findAll();

        return res.status(200).json({
            success: true,
            data: bankAccounts
        });
    } catch (error) {
        console.error('Error fetching bank accounts:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve bank accounts',
            error: error.message
        });
    }
};

/**
 * Get bank account by ID
 * @route GET /api/bank-accounts/:id
 */
exports.getBankAccountById = async (req, res) => {
    try {
        const { id } = req.params;

        const bankAccount = await db.BankAccount.findByPk(id);

        if (!bankAccount) {
            return res.status(404).json({
                success: false,
                message: `Bank account with ID ${id} not found`
            });
        }

        return res.status(200).json({
            success: true,
            data: bankAccount
        });
    } catch (error) {
        console.error('Error fetching bank account:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve bank account',
            error: error.message
        });
    }
};

/**
 * Create a new bank account
 * @route POST /api/bank-accounts
 */
exports.createBankAccount = async (req, res) => {
    try {
        const { bank_name, acc_number, ifsc, bank_balance } = req.body;

        // Validate required fields
        if (!bank_name || !acc_number) {
            return res.status(400).json({
                success: false,
                message: 'Bank name and account number are required'
            });
        }

        // Create new bank account
        const newBankAccount = await db.BankAccount.create({
            bank_name,
            acc_number,
            ifsc: ifsc || null,
            bank_balance: bank_balance || 0.00
        });

        return res.status(201).json({
            success: true,
            message: 'Bank account created successfully',
            data: newBankAccount
        });
    } catch (error) {
        console.error('Error creating bank account:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create bank account',
            error: error.message
        });
    }
};

/**
 * Update a bank account
 * @route PATCH /api/bank-accounts/:id
 */
exports.updateBankAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { bank_name, acc_number, ifsc, bank_balance } = req.body;

        // Find the bank account
        const bankAccount = await db.BankAccount.findByPk(id);

        if (!bankAccount) {
            return res.status(404).json({
                success: false,
                message: `Bank account with ID ${id} not found`
            });
        }

        // Update bank account fields
        const updatedData = {};
        if (bank_name !== undefined) updatedData.bank_name = bank_name;
        if (acc_number !== undefined) updatedData.acc_number = acc_number;
        if (ifsc !== undefined) updatedData.ifsc = ifsc;
        if (bank_balance !== undefined) updatedData.bank_balance = bank_balance;

        // Perform update
        await bankAccount.update(updatedData);

        return res.status(200).json({
            success: true,
            message: 'Bank account updated successfully',
            data: await db.BankAccount.findByPk(id)
        });
    } catch (error) {
        console.error('Error updating bank account:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update bank account',
            error: error.message
        });
    }
};

/**
 * Delete a bank account
 * @route DELETE /api/bank-accounts/:id
 */
exports.deleteBankAccount = async (req, res) => {
    try {
        const { id } = req.params;

        // Find the bank account
        const bankAccount = await db.BankAccount.findByPk(id);

        if (!bankAccount) {
            return res.status(404).json({
                success: false,
                message: `Bank account with ID ${id} not found`
            });
        }

        // Delete the bank account
        await bankAccount.destroy();

        return res.status(200).json({
            success: true,
            message: 'Bank account deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting bank account:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete bank account',
            error: error.message
        });
    }
}; 