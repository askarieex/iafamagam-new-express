'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            // Check if the table exists
            const tables = await queryInterface.showAllTables();

            if (!tables.includes('cheques')) {
                // Create the cheques table with the correct schema
                await queryInterface.createTable('cheques', {
                    id: {
                        type: Sequelize.INTEGER,
                        primaryKey: true,
                        autoIncrement: true
                    },
                    tx_id: {  // Using tx_id instead of transaction_id
                        type: Sequelize.UUID,
                        allowNull: false
                    },
                    account_id: {
                        type: Sequelize.INTEGER,
                        allowNull: false
                    },
                    ledger_head_id: {
                        type: Sequelize.INTEGER,
                        allowNull: false
                    },
                    cheque_number: {
                        type: Sequelize.STRING,
                        allowNull: false
                    },
                    bank_name: {
                        type: Sequelize.STRING,
                        allowNull: false
                    },
                    issue_date: {
                        type: Sequelize.DATEONLY,
                        allowNull: false
                    },
                    due_date: {
                        type: Sequelize.DATEONLY,
                        allowNull: false
                    },
                    status: {
                        type: Sequelize.ENUM('pending', 'cleared', 'cancelled'),
                        defaultValue: 'pending',
                        allowNull: false
                    },
                    clearing_date: {
                        type: Sequelize.DATEONLY,
                        allowNull: true
                    },
                    description: {
                        type: Sequelize.TEXT,
                        allowNull: true
                    },
                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
                    },
                    updated_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
                    }
                });

                // Add foreign key constraints separately
                await queryInterface.addConstraint('cheques', {
                    fields: ['tx_id'],
                    type: 'foreign key',
                    name: 'cheques_tx_id_fkey',
                    references: {
                        table: 'transactions',
                        field: 'id'
                    },
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE'
                });

                await queryInterface.addConstraint('cheques', {
                    fields: ['account_id'],
                    type: 'foreign key',
                    name: 'cheques_account_id_fkey',
                    references: {
                        table: 'accounts',
                        field: 'id'
                    }
                });

                await queryInterface.addConstraint('cheques', {
                    fields: ['ledger_head_id'],
                    type: 'foreign key',
                    name: 'cheques_ledger_head_id_fkey',
                    references: {
                        table: 'ledger_heads',
                        field: 'id'
                    }
                });

                console.log('Created cheques table with tx_id field');
            }
        } catch (error) {
            console.error('Migration error:', error);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        try {
            // Check if the table exists
            const tables = await queryInterface.showAllTables();
            if (tables.includes('cheques')) {
                // Drop the table
                await queryInterface.dropTable('cheques');
                console.log('Dropped cheques table');
            }
        } catch (error) {
            console.error('Rollback error:', error);
            throw error;
        }
    }
}; 