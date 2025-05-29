'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('monthly_ledger_balances', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            account_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'accounts',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            ledger_head_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'ledger_heads',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            month: {
                type: Sequelize.INTEGER,
                allowNull: false,
                validate: {
                    min: 1,
                    max: 12
                }
            },
            year: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            opening_balance: {
                type: Sequelize.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0.00
            },
            receipts: {
                type: Sequelize.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Credits for the month'
            },
            payments: {
                type: Sequelize.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Debits for the month'
            },
            closing_balance: {
                type: Sequelize.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0.00,
                comment: 'Calculated as opening_balance + receipts - payments'
            },
            cash_in_hand: {
                type: Sequelize.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0.00
            },
            cash_in_bank: {
                type: Sequelize.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0.00
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        // Add unique constraint
        await queryInterface.addIndex('monthly_ledger_balances',
            ['account_id', 'ledger_head_id', 'month', 'year'],
            {
                name: 'monthly_ledger_balances_unique_constraint',
                unique: true
            }
        );
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('monthly_ledger_balances');
    }
}; 