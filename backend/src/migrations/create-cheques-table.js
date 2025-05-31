'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // First add status column to Transactions if it doesn't exist
        try {
            await queryInterface.describeTable('Transactions').then(tableDefinition => {
                if (!tableDefinition.status) {
                    return queryInterface.addColumn('Transactions', 'status', {
                        type: Sequelize.ENUM('pending', 'completed', 'cancelled'),
                        defaultValue: 'completed',
                        allowNull: false
                    });
                }
            });

            // Update all existing transactions to have 'completed' status
            await queryInterface.sequelize.query(
                `UPDATE "Transactions" SET status = 'completed' WHERE status IS NULL`
            );
        } catch (error) {
            console.error('Error adding status to Transactions:', error);
        }

        // Now create the Cheques table
        await queryInterface.createTable('Cheques', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            transaction_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                unique: true,
                references: {
                    model: 'Transactions',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            account_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'Accounts',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            },
            ledger_head_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'LedgerHeads',
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
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });

        // Add unique constraint for cheque_number within the same account
        await queryInterface.addIndex('Cheques', ['account_id', 'cheque_number'], {
            unique: true,
            name: 'cheques_account_number_unique'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('Cheques');

        // We don't remove the status column from Transactions in the down migration
        // as it's essential for the functioning of the system now
    }
}; 