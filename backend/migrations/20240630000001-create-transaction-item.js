'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('transaction_items', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            transaction_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'transactions',
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
                onDelete: 'RESTRICT'
            },
            amount: {
                type: Sequelize.DECIMAL(14, 2),
                allowNull: false
            },
            side: {
                type: Sequelize.CHAR(1),
                allowNull: false,
                validate: {
                    isIn: [['+', '-']]
                },
                comment: '+ adds money to a head, - removes it'
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });

        // Add index on transaction_id for faster lookups
        await queryInterface.addIndex('transaction_items', ['transaction_id']);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('transaction_items');
    }
}; 