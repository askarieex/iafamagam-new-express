'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('transactions', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
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
            donor_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'donors',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            },
            booklet_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'booklets',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            },
            receipt_no: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            amount: {
                type: Sequelize.DECIMAL(14, 2),
                allowNull: false
            },
            tx_type: {
                type: Sequelize.ENUM('credit', 'debit'),
                allowNull: false
            },
            cash_type: {
                type: Sequelize.ENUM('cash', 'bank', 'upi', 'card', 'netbank', 'cheque'),
                allowNull: false
            },
            tx_date: {
                type: Sequelize.DATEONLY,
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
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

        // Add unique constraint on booklet_id and receipt_no
        await queryInterface.addConstraint('transactions', {
            fields: ['booklet_id', 'receipt_no'],
            type: 'unique',
            name: 'unique_booklet_receipt'
        });

        // Add CHECK constraint that booklet_id and receipt_no only appear on credits
        await queryInterface.sequelize.query(`
      ALTER TABLE transactions 
      ADD CONSTRAINT check_booklet_receipt_credit 
      CHECK ((tx_type = 'debit' AND (booklet_id IS NULL AND receipt_no IS NULL)) OR tx_type = 'credit')
    `);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('transactions');
    }
}; 