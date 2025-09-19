const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class LedgerHeadDependency extends Model {
        static associate(models) {
            // Credit head relationship
            LedgerHeadDependency.belongsTo(models.LedgerHead, {
                foreignKey: 'credit_head_id',
                as: 'creditHead'
            });

            // Debit head relationship  
            LedgerHeadDependency.belongsTo(models.LedgerHead, {
                foreignKey: 'debit_head_id',
                as: 'debitHead'
            });

            // Created by user
            LedgerHeadDependency.belongsTo(models.User, {
                foreignKey: 'created_by',
                as: 'creator'
            });
        }

        /**
         * Check if a credit head can fund a debit head
         * @param {number} creditHeadId - ID of the credit head
         * @param {number} debitHeadId - ID of the debit head  
         * @param {number} amount - Amount to check
         * @returns {Promise<{allowed: boolean, reason?: string, maxAmount?: number}>}
         */
        static async canCreditFundDebit(creditHeadId, debitHeadId, amount = 0) {
            try {
                const dependency = await this.findOne({
                    where: {
                        credit_head_id: creditHeadId,
                        debit_head_id: debitHeadId,
                        is_active: true
                    },
                    include: [
                        { model: sequelize.models.LedgerHead, as: 'creditHead' },
                        { model: sequelize.models.LedgerHead, as: 'debitHead' }
                    ]
                });

                if (!dependency) {
                    // Check if credit head is independent (can fund any debit head)
                    const creditHead = await sequelize.models.LedgerHead.findByPk(creditHeadId);
                    if (creditHead && creditHead.dependency_type === 'independent') {
                        return { allowed: true, reason: 'Independent credit head can fund any expense' };
                    }
                    return { allowed: false, reason: 'No funding relationship exists between these heads' };
                }

                // Check restriction type
                if (dependency.restriction_type === 'prohibited') {
                    return { allowed: false, reason: 'This credit head is prohibited from funding this expense' };
                }

                if (dependency.restriction_type === 'conditional') {
                    // Additional logic for conditional relationships can be added here
                    if (dependency.conditions) {
                        // Parse and evaluate conditions
                        try {
                            const conditions = JSON.parse(dependency.conditions);
                            // Implement condition checking logic based on your needs
                        } catch (e) {
                            console.warn('Invalid conditions JSON:', dependency.conditions);
                        }
                    }
                }

                // Check percentage limits
                if (dependency.max_percentage && amount > 0) {
                    const creditBalance = parseFloat(dependency.creditHead.current_balance);
                    const maxAllowedAmount = creditBalance * (dependency.max_percentage / 100);
                    
                    if (amount > maxAllowedAmount) {
                        return { 
                            allowed: false, 
                            reason: `Amount exceeds maximum allowed (${dependency.max_percentage}% of ${dependency.creditHead.name})`,
                            maxAmount: maxAllowedAmount
                        };
                    }
                }

                return { allowed: true, reason: 'Funding relationship exists and conditions are met' };

            } catch (error) {
                console.error('Error checking credit-debit funding relationship:', error);
                return { allowed: false, reason: 'Error checking funding relationship' };
            }
        }

        /**
         * Get all debit heads that a credit head can fund
         * @param {number} creditHeadId - ID of the credit head
         * @returns {Promise<Array>}
         */
        static async getDebitHeadsForCredit(creditHeadId) {
            try {
                const creditHead = await sequelize.models.LedgerHead.findByPk(creditHeadId);
                
                if (!creditHead) {
                    return [];
                }

                // If independent, can fund all debit heads
                if (creditHead.dependency_type === 'independent') {
                    return await sequelize.models.LedgerHead.findAll({
                        where: { 
                            dependency_type: 'expense',
                            is_active: true 
                        },
                        include: [{ model: sequelize.models.Account, as: 'account' }],
                        order: [['name', 'ASC']]
                    });
                }

                // If dependent, only specific debit heads
                const dependencies = await this.findAll({
                    where: {
                        credit_head_id: creditHeadId,
                        restriction_type: ['allowed', 'conditional'],
                        is_active: true
                    },
                    include: [{
                        model: sequelize.models.LedgerHead,
                        as: 'debitHead',
                        include: [{ model: sequelize.models.Account, as: 'account' }]
                    }],
                    order: [[{ model: sequelize.models.LedgerHead, as: 'debitHead' }, 'name', 'ASC']]
                });

                return dependencies.map(dep => dep.debitHead);

            } catch (error) {
                console.error('Error getting debit heads for credit:', error);
                return [];
            }
        }

        /**
         * Get all credit heads that can fund a debit head
         * @param {number} debitHeadId - ID of the debit head
         * @returns {Promise<Array>}
         */
        static async getCreditHeadsForDebit(debitHeadId) {
            try {
                // Get all independent credit heads (can fund any debit)
                const independentCredits = await sequelize.models.LedgerHead.findAll({
                    where: { 
                        dependency_type: 'independent',
                        head_type: 'credit',
                        is_active: true 
                    },
                    include: [{ model: sequelize.models.Account, as: 'account' }]
                });

                // Get specific dependencies for this debit head
                const dependencies = await this.findAll({
                    where: {
                        debit_head_id: debitHeadId,
                        restriction_type: ['allowed', 'conditional'],
                        is_active: true
                    },
                    include: [{
                        model: sequelize.models.LedgerHead,
                        as: 'creditHead',
                        include: [{ model: sequelize.models.Account, as: 'account' }]
                    }]
                });

                const dependentCredits = dependencies.map(dep => dep.creditHead);

                // Combine and remove duplicates
                const allCredits = [...independentCredits, ...dependentCredits];
                const uniqueCredits = allCredits.filter((credit, index, self) => 
                    index === self.findIndex(c => c.id === credit.id)
                );

                return uniqueCredits.sort((a, b) => a.name.localeCompare(b.name));

            } catch (error) {
                console.error('Error getting credit heads for debit:', error);
                return [];
            }
        }
    }

    LedgerHeadDependency.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        credit_head_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'ledger_heads',
                key: 'id'
            }
        },
        debit_head_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'ledger_heads',
                key: 'id'
            }
        },
        restriction_type: {
            type: DataTypes.ENUM('allowed', 'prohibited', 'conditional'),
            allowNull: false,
            defaultValue: 'allowed'
        },
        conditions: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        max_percentage: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true,
            validate: {
                min: 0,
                max: 100
            }
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        sequelize,
        modelName: 'LedgerHeadDependency',
        tableName: 'ledger_head_dependencies',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        indexes: [
            {
                unique: true,
                fields: ['credit_head_id', 'debit_head_id'],
                name: 'unique_credit_debit_dependency'
            },
            {
                fields: ['credit_head_id'],
                name: 'idx_credit_head_dependencies'
            },
            {
                fields: ['debit_head_id'],
                name: 'idx_debit_head_dependencies'
            }
        ]
    });

    return LedgerHeadDependency;
};