'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            // First, drop the existing table if it exists
            await queryInterface.dropTable('cheques', { cascade: true });

            console.log('Dropped existing cheques table');

            // Make sure the ENUM type exists
            try {
                await queryInterface.sequelize.query(`
          CREATE TYPE enum_cheques_status AS ENUM ('pending', 'cleared', 'cancelled');
        `);
                console.log('Created enum_cheques_status type');
            } catch (error) {
                console.log('Status ENUM type may already exist:', error.message);
            }

            // Create the table with all required columns
            await queryInterface.createTable('cheques', {
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: Sequelize.INTEGER
                },
                tx_id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: {
                        model: 'transactions',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE'
                },
                account_id: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'accounts',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT'
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
                    allowNull: false,
                    type: Sequelize.DATE
                },
                updated_at: {
                    allowNull: false,
                    type: Sequelize.DATE
                }
            });

            console.log('Created new cheques table');

            // Add index on tx_id for faster lookups
            await queryInterface.addIndex('cheques', ['tx_id'], {
                name: 'idx_cheques_tx_id'
            });

            console.log('Added index on tx_id');

            console.log('Migration completed successfully');
        } catch (error) {
            console.error('Migration error:', error);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        try {
            await queryInterface.dropTable('cheques');
            console.log('Dropped cheques table');
        } catch (error) {
            console.error('Down migration error:', error);
            throw error;
        }
    }
}; 