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
 * Create a new ledger head with enhanced dependency support
 * @route POST /api/ledger-heads
 */
exports.createLedgerHead = async (req, res) => {
    try {
        const { 
            account_id, 
            name, 
            head_type, 
            current_balance, 
            cash_balance, 
            bank_balance, 
            description,
            dependency_type,
            islamic_category,
            is_restricted,
            spending_rules,
            sort_order,
            linked_debit_head, // For creating paired credit-debit heads
            create_linked_head // Boolean to create a new linked debit head
        } = req.body;

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

        // Validate dependency_type
        const validDependencyTypes = head_type === 'credit' 
            ? ['independent', 'dependent'] 
            : ['expense'];
        
        const finalDependencyType = dependency_type || (head_type === 'credit' ? 'independent' : 'expense');
        
        if (!validDependencyTypes.includes(finalDependencyType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid dependency type for ${head_type} head`
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
        const initialCashBalance = cash_balance !== undefined ? cash_balance : initialCurrentBalance;
        const initialBankBalance = bank_balance || 0.00;

        // Determine if the head should be restricted based on Islamic category
        const restrictedCategories = ['Sahm-e-Imam', 'Sahm-e-Sadat', 'Zakat'];
        const shouldBeRestricted = is_restricted || restrictedCategories.includes(islamic_category);
        const finalIslamicCategory = islamic_category || (head_type === 'credit' ? 'General' : 'Expense');

        // Start transaction for creating linked heads
        const transaction = await db.sequelize.transaction();

        try {
            // Create the main ledger head
            const newLedgerHead = await db.LedgerHead.create({
                account_id,
                name,
                head_type,
                current_balance: initialCurrentBalance,
                cash_balance: initialCashBalance,
                bank_balance: initialBankBalance,
                description: description || null,
                dependency_type: shouldBeRestricted && head_type === 'credit' ? 'dependent' : finalDependencyType,
                islamic_category: finalIslamicCategory,
                is_restricted: shouldBeRestricted,
                spending_rules: shouldBeRestricted ? spending_rules : null,
                sort_order: sort_order || 0,
                is_active: true
            }, { transaction });

            let linkedHead = null;

            // Handle linked head creation for credit heads
            if (head_type === 'credit' && (create_linked_head || linked_debit_head)) {
                if (create_linked_head) {
                    // Create a new paired debit head
                    const linkedName = `${name} - Expenses`;
                    linkedHead = await db.LedgerHead.create({
                        account_id,
                        name: linkedName,
                        head_type: 'debit',
                        current_balance: 0.00,
                        cash_balance: 0.00,
                        bank_balance: 0.00,
                        description: `Expense head linked to ${name}`,
                        dependency_type: 'expense',
                        islamic_category: 'Expense',
                        is_restricted: false,
                        sort_order: (sort_order || 0) + 1,
                        is_active: true
                    }, { transaction });

                    // Create dependency relationship
                    await db.LedgerHeadDependency.create({
                        credit_head_id: newLedgerHead.id,
                        debit_head_id: linkedHead.id,
                        restriction_type: shouldBeRestricted ? 'conditional' : 'allowed',
                        notes: shouldBeRestricted 
                            ? `${finalIslamicCategory} funds with specific usage rules`
                            : 'General funding relationship',
                        is_active: true
                    }, { transaction });
                } else if (linked_debit_head) {
                    // Link to existing debit head
                    const existingDebitHead = await db.LedgerHead.findByPk(linked_debit_head, { transaction });
                    if (existingDebitHead && existingDebitHead.head_type === 'debit') {
                        await db.LedgerHeadDependency.create({
                            credit_head_id: newLedgerHead.id,
                            debit_head_id: linked_debit_head,
                            restriction_type: shouldBeRestricted ? 'conditional' : 'allowed',
                            notes: shouldBeRestricted 
                                ? `${finalIslamicCategory} funds with specific usage rules`
                                : 'General funding relationship',
                            is_active: true
                        }, { transaction });
                        linkedHead = existingDebitHead;
                    }
                }
            }

            await transaction.commit();

            // Get the created ledger head with all relationships
            const createdLedgerHead = await db.LedgerHead.findByPk(newLedgerHead.id, {
                include: [
                    {
                        model: db.Account,
                        as: 'account',
                        attributes: ['id', 'name']
                    }
                ]
            });

            const response = {
                success: true,
                message: 'Ledger head created successfully',
                data: createdLedgerHead
            };

            if (linkedHead) {
                response.linkedHead = linkedHead;
                response.message += ` with linked ${linkedHead.head_type} head`;
            }

            return res.status(201).json(response);

        } catch (transactionError) {
            await transaction.rollback();
            throw transactionError;
        }

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
 * Update a ledger head with enhanced dependency support
 * @route PUT /api/ledger-heads/:id
 */
exports.updateLedgerHead = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, 
            head_type, 
            current_balance, 
            cash_balance, 
            bank_balance, 
            description,
            dependency_type,
            islamic_category,
            is_restricted,
            spending_rules,
            sort_order,
            is_active
        } = req.body;

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

        // Validate dependency_type if provided
        if (dependency_type) {
            const currentHeadType = head_type || ledgerHead.head_type;
            const validDependencyTypes = currentHeadType === 'credit' 
                ? ['independent', 'dependent'] 
                : ['expense'];
            
            if (!validDependencyTypes.includes(dependency_type)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid dependency type for ${currentHeadType} head`
                });
            }
        }

        // Update ledger head fields
        const updatedData = {};
        if (name !== undefined) updatedData.name = name;
        if (head_type !== undefined) {
            updatedData.head_type = head_type;
            // Adjust dependency type if head type changes
            updatedData.dependency_type = head_type === 'credit' ? 'independent' : 'expense';
        }
        if (current_balance !== undefined) updatedData.current_balance = current_balance;
        if (cash_balance !== undefined) updatedData.cash_balance = cash_balance;
        if (bank_balance !== undefined) updatedData.bank_balance = bank_balance;
        if (description !== undefined) updatedData.description = description;
        if (dependency_type !== undefined) updatedData.dependency_type = dependency_type;
        if (islamic_category !== undefined) updatedData.islamic_category = islamic_category;
        if (is_restricted !== undefined) updatedData.is_restricted = is_restricted;
        if (spending_rules !== undefined) updatedData.spending_rules = spending_rules;
        if (sort_order !== undefined) updatedData.sort_order = sort_order;
        if (is_active !== undefined) updatedData.is_active = is_active;

        // Auto-set restriction based on Islamic category
        if (islamic_category !== undefined) {
            const restrictedCategories = ['Sahm-e-Imam', 'Sahm-e-Sadat', 'Zakat'];
            if (restrictedCategories.includes(islamic_category)) {
                updatedData.is_restricted = true;
                updatedData.dependency_type = 'dependent';
            }
        }

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

/**
 * Get dependency validation and relationship analysis
 * @route GET /api/ledger-heads/validation/dependencies
 */
exports.validateDependencies = async (req, res) => {
    try {
        // Find orphaned heads - credit heads with no valid funding targets
        const orphanedCreditHeads = await db.LedgerHead.findAll({
            where: {
                head_type: 'credit',
                dependency_type: 'dependent',
                is_active: true
            },
            include: [
                {
                    model: db.LedgerHeadDependency,
                    as: 'creditDependencies',
                    required: false,
                    where: { is_active: true }
                }
            ]
        });

        const orphaned = orphanedCreditHeads.filter(head => 
            !head.creditDependencies || head.creditDependencies.length === 0
        );

        // Find potential circular dependencies (though unlikely in this model)
        const circularDependencies = [];
        
        // Get all dependencies
        const allDependencies = await db.LedgerHeadDependency.findAll({
            where: { is_active: true },
            include: [
                { model: db.LedgerHead, as: 'creditHead' },
                { model: db.LedgerHead, as: 'debitHead' }
            ]
        });

        // Check for any heads that are both credit and debit in different relationships
        const headRelationships = new Map();
        
        allDependencies.forEach(dep => {
            if (!headRelationships.has(dep.credit_head_id)) {
                headRelationships.set(dep.credit_head_id, { asCredit: [], asDebit: [] });
            }
            if (!headRelationships.has(dep.debit_head_id)) {
                headRelationships.set(dep.debit_head_id, { asCredit: [], asDebit: [] });
            }
            
            headRelationships.get(dep.credit_head_id).asCredit.push(dep.debit_head_id);
            headRelationships.get(dep.debit_head_id).asDebit.push(dep.credit_head_id);
        });

        // Find potentially problematic relationships
        const problematicRelationships = [];
        for (const [headId, relationships] of headRelationships) {
            if (relationships.asCredit.length > 0 && relationships.asDebit.length > 0) {
                const head = await db.LedgerHead.findByPk(headId);
                problematicRelationships.push({
                    head,
                    issue: 'Head appears in both credit and debit relationships',
                    fundingSources: relationships.asDebit.length,
                    fundingTargets: relationships.asCredit.length
                });
            }
        }

        // Get statistics
        const stats = {
            totalHeads: await db.LedgerHead.count({ where: { is_active: true } }),
            creditHeads: await db.LedgerHead.count({ where: { head_type: 'credit', is_active: true } }),
            debitHeads: await db.LedgerHead.count({ where: { head_type: 'debit', is_active: true } }),
            independentHeads: await db.LedgerHead.count({ 
                where: { dependency_type: 'independent', is_active: true } 
            }),
            restrictedHeads: await db.LedgerHead.count({ 
                where: { is_restricted: true, is_active: true } 
            }),
            totalDependencies: await db.LedgerHeadDependency.count({ where: { is_active: true } }),
            orphanedHeads: orphaned.length,
            problematicRelationships: problematicRelationships.length
        };

        return res.status(200).json({
            success: true,
            data: {
                stats,
                orphanedHeads: orphaned,
                circularDependencies,
                problematicRelationships,
                recommendations: generateRecommendations(stats, orphaned, problematicRelationships)
            },
            message: 'Dependency validation completed'
        });

    } catch (error) {
        console.error('Error validating dependencies:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to validate dependencies',
            error: error.message
        });
    }
};

/**
 * Generate recommendations based on validation results
 */
function generateRecommendations(stats, orphaned, problematic) {
    const recommendations = [];

    if (orphaned.length > 0) {
        recommendations.push({
            type: 'warning',
            title: 'Orphaned Restricted Funds',
            description: `${orphaned.length} restricted credit heads have no valid expense targets.`,
            action: 'Create dependency relationships for these heads to enable proper fund allocation.'
        });
    }

    if (problematic.length > 0) {
        recommendations.push({
            type: 'warning',
            title: 'Complex Relationships',
            description: `${problematic.length} heads have complex relationship patterns.`,
            action: 'Review these relationships to ensure they align with Islamic accounting principles.'
        });
    }

    if (stats.restrictedHeads === 0) {
        recommendations.push({
            type: 'info',
            title: 'No Restricted Funds',
            description: 'Consider marking Islamic funds (Zakat, Sahm-e-Imam, etc.) as restricted.',
            action: 'Review your Islamic categories and apply appropriate restrictions.'
        });
    }

    if (stats.totalDependencies === 0 && stats.restrictedHeads > 0) {
        recommendations.push({
            type: 'error',
            title: 'Missing Dependencies',
            description: 'You have restricted funds but no dependency rules.',
            action: 'Create dependency relationships to properly manage restricted fund usage.'
        });
    }

    if (recommendations.length === 0) {
        recommendations.push({
            type: 'success',
            title: 'System Health Good',
            description: 'Your ledger head relationships appear to be properly configured.',
            action: 'Continue monitoring as you add new heads and relationships.'
        });
    }

    return recommendations;
} 