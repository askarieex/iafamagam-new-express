const express = require('express');
const router = express.Router();
const { LedgerHead, LedgerHeadDependency } = require('../models');
const authMiddleware = require('../middleware/authMiddleware');

// Get all dependencies
router.get('/dependencies', authMiddleware, async (req, res) => {
    try {
        const dependencies = await LedgerHeadDependency.findAll({
            include: [
                { model: LedgerHead, as: 'creditHead', include: ['account'] },
                { model: LedgerHead, as: 'debitHead', include: ['account'] }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: dependencies,
            message: 'Dependencies fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching dependencies:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dependencies',
            error: error.message
        });
    }
});

// Get dependencies for a specific credit head
router.get('/credit/:creditHeadId/dependencies', authMiddleware, async (req, res) => {
    try {
        const { creditHeadId } = req.params;
        
        const debitHeads = await LedgerHeadDependency.getDebitHeadsForCredit(creditHeadId);
        
        res.json({
            success: true,
            data: debitHeads,
            message: 'Credit head dependencies fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching credit head dependencies:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch credit head dependencies',
            error: error.message
        });
    }
});

// Get funding sources for a specific debit head
router.get('/debit/:debitHeadId/funding-sources', authMiddleware, async (req, res) => {
    try {
        const { debitHeadId } = req.params;
        
        const creditHeads = await LedgerHeadDependency.getCreditHeadsForDebit(debitHeadId);
        
        res.json({
            success: true,
            data: creditHeads,
            message: 'Debit head funding sources fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching debit head funding sources:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch debit head funding sources',
            error: error.message
        });
    }
});

// Check if a credit head can fund a debit head
router.post('/check-funding', authMiddleware, async (req, res) => {
    try {
        const { creditHeadId, debitHeadId, amount } = req.body;

        if (!creditHeadId || !debitHeadId) {
            return res.status(400).json({
                success: false,
                message: 'Credit head ID and debit head ID are required'
            });
        }

        const result = await LedgerHeadDependency.canCreditFundDebit(
            creditHeadId, 
            debitHeadId, 
            amount || 0
        );

        res.json({
            success: true,
            data: result,
            message: 'Funding check completed'
        });
    } catch (error) {
        console.error('Error checking funding relationship:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check funding relationship',
            error: error.message
        });
    }
});

// Create a new dependency relationship
router.post('/dependencies', authMiddleware, async (req, res) => {
    try {
        const {
            credit_head_id,
            debit_head_id,
            restriction_type = 'allowed',
            conditions,
            max_percentage,
            notes,
            created_by
        } = req.body;

        if (!credit_head_id || !debit_head_id) {
            return res.status(400).json({
                success: false,
                message: 'Credit head ID and debit head ID are required'
            });
        }

        // Check if dependency already exists
        const existingDependency = await LedgerHeadDependency.findOne({
            where: {
                credit_head_id,
                debit_head_id
            }
        });

        if (existingDependency) {
            return res.status(409).json({
                success: false,
                message: 'Dependency relationship already exists between these heads'
            });
        }

        // Validate that credit and debit heads exist and have correct types
        const creditHead = await LedgerHead.findByPk(credit_head_id);
        const debitHead = await LedgerHead.findByPk(debit_head_id);

        if (!creditHead || !debitHead) {
            return res.status(404).json({
                success: false,
                message: 'Credit head or debit head not found'
            });
        }

        if (creditHead.head_type !== 'credit') {
            return res.status(400).json({
                success: false,
                message: 'Credit head must be of type "credit"'
            });
        }

        if (debitHead.head_type !== 'debit') {
            return res.status(400).json({
                success: false,
                message: 'Debit head must be of type "debit"'
            });
        }

        const dependency = await LedgerHeadDependency.create({
            credit_head_id,
            debit_head_id,
            restriction_type,
            conditions,
            max_percentage,
            notes,
            created_by: created_by || req.user?.id,
            is_active: true
        });

        const createdDependency = await LedgerHeadDependency.findByPk(dependency.id, {
            include: [
                { model: LedgerHead, as: 'creditHead', include: ['account'] },
                { model: LedgerHead, as: 'debitHead', include: ['account'] }
            ]
        });

        res.status(201).json({
            success: true,
            data: createdDependency,
            message: 'Dependency relationship created successfully'
        });
    } catch (error) {
        console.error('Error creating dependency:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create dependency relationship',
            error: error.message
        });
    }
});

// Update a dependency relationship
router.put('/dependencies/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            restriction_type,
            conditions,
            max_percentage,
            notes,
            is_active
        } = req.body;

        const dependency = await LedgerHeadDependency.findByPk(id);

        if (!dependency) {
            return res.status(404).json({
                success: false,
                message: 'Dependency relationship not found'
            });
        }

        await dependency.update({
            restriction_type: restriction_type !== undefined ? restriction_type : dependency.restriction_type,
            conditions: conditions !== undefined ? conditions : dependency.conditions,
            max_percentage: max_percentage !== undefined ? max_percentage : dependency.max_percentage,
            notes: notes !== undefined ? notes : dependency.notes,
            is_active: is_active !== undefined ? is_active : dependency.is_active
        });

        const updatedDependency = await LedgerHeadDependency.findByPk(id, {
            include: [
                { model: LedgerHead, as: 'creditHead', include: ['account'] },
                { model: LedgerHead, as: 'debitHead', include: ['account'] }
            ]
        });

        res.json({
            success: true,
            data: updatedDependency,
            message: 'Dependency relationship updated successfully'
        });
    } catch (error) {
        console.error('Error updating dependency:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update dependency relationship',
            error: error.message
        });
    }
});

// Delete a dependency relationship
router.delete('/dependencies/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const dependency = await LedgerHeadDependency.findByPk(id);

        if (!dependency) {
            return res.status(404).json({
                success: false,
                message: 'Dependency relationship not found'
            });
        }

        await dependency.destroy();

        res.json({
            success: true,
            message: 'Dependency relationship deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting dependency:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete dependency relationship',
            error: error.message
        });
    }
});

// Get dependency analytics/statistics
router.get('/analytics', authMiddleware, async (req, res) => {
    try {
        const [
            totalDependencies,
            independentCredits,
            restrictedCredits,
            totalExpenses
        ] = await Promise.all([
            LedgerHeadDependency.count({ where: { is_active: true } }),
            LedgerHead.count({ where: { dependency_type: 'independent', head_type: 'credit' } }),
            LedgerHead.count({ where: { dependency_type: 'dependent', head_type: 'credit' } }),
            LedgerHead.count({ where: { head_type: 'debit' } })
        ]);

        const categoryStats = await LedgerHead.findAll({
            attributes: [
                'islamic_category',
                'head_type',
                [LedgerHead.sequelize.fn('COUNT', LedgerHead.sequelize.col('id')), 'count'],
                [LedgerHead.sequelize.fn('SUM', LedgerHead.sequelize.col('current_balance')), 'total_balance']
            ],
            group: ['islamic_category', 'head_type'],
            raw: true
        });

        res.json({
            success: true,
            data: {
                summary: {
                    totalDependencies,
                    independentCredits,
                    restrictedCredits,
                    totalExpenses
                },
                categoryStats
            },
            message: 'Analytics data fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics data',
            error: error.message
        });
    }
});

module.exports = router;