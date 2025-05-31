'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            // Check if table exists
            const tables = await queryInterface.showAllTables();

            if (tables.includes('cheques')) {
                // Check if column transaction_id exists
                const tableInfo = await queryInterface.describeTable('cheques');

                if (tableInfo.transaction_id && !tableInfo.tx_id) {
                    console.log('Renaming column transaction_id to tx_id in cheques table');

                    // First drop foreign key constraint if it exists
                    try {
                        await queryInterface.removeConstraint('cheques', 'cheques_transaction_id_fkey');
                    } catch (error) {
                        console.log('No constraint to remove or error removing constraint:', error.message);
                    }

                    // Then rename the column
                    await queryInterface.renameColumn('cheques', 'transaction_id', 'tx_id');

                    // Update the column type to UUID if not already
                    await queryInterface.changeColumn('cheques', 'tx_id', {
                        type: Sequelize.UUID,
                        allowNull: false
                    });

                    // Add constraint back with new name
                    try {
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
                    } catch (error) {
                        console.log('Error adding constraint back:', error.message);
                    }
                } else if (!tableInfo.transaction_id && !tableInfo.tx_id) {
                    console.log('Adding tx_id column to cheques table');

                    await queryInterface.addColumn('cheques', 'tx_id', {
                        type: Sequelize.UUID,
                        allowNull: false
                    });

                    // Add constraint
                    try {
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
                    } catch (error) {
                        console.log('Error adding constraint:', error.message);
                    }
                } else {
                    console.log('tx_id column already exists in cheques table');
                }
            } else {
                console.log('Creating cheques table with tx_id column');

                // Try to create the ENUM type for status
                try {
                    await queryInterface.sequelize.query(`
            CREATE TYPE enum_cheques_status AS ENUM ('pending', 'cleared', 'cancelled');
          `);
                } catch (error) {
                    console.log('Status ENUM type may already exist:', error.message);
                }

                // Create the table with tx_id
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
                        unique: true,
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
            }

            console.log('Migration completed successfully');
            return Promise.resolve();
        } catch (error) {
            console.error('Migration error:', error);
            return Promise.reject(error);
        }
    },

    down: async (queryInterface, Sequelize) => {
        try {
            const tables = await queryInterface.showAllTables();

            if (tables.includes('cheques')) {
                const tableInfo = await queryInterface.describeTable('cheques');

                if (tableInfo.tx_id && !tableInfo.transaction_id) {
                    console.log('Reverting: renaming column tx_id back to transaction_id');

                    // Drop constraint
                    try {
                        await queryInterface.removeConstraint('cheques', 'cheques_tx_id_fkey');
                    } catch (error) {
                        console.log('No constraint to remove or error removing constraint:', error.message);
                    }

                    // Rename column
                    await queryInterface.renameColumn('cheques', 'tx_id', 'transaction_id');

                    // Add constraint back
                    try {
                        await queryInterface.addConstraint('cheques', {
                            fields: ['transaction_id'],
                            type: 'foreign key',
                            name: 'cheques_transaction_id_fkey',
                            references: {
                                table: 'transactions',
                                field: 'id'
                            },
                            onDelete: 'CASCADE',
                            onUpdate: 'CASCADE'
                        });
                    } catch (error) {
                        console.log('Error adding constraint back:', error.message);
                    }
                }
            }

            console.log('Down migration completed');
            return Promise.resolve();
        } catch (error) {
            console.error('Down migration error:', error);
            return Promise.reject(error);
        }
    }
}; 