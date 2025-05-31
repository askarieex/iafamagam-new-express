'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // First, create the ENUM type for cheque status if it doesn't exist
      try {
        await queryInterface.sequelize.query(`
          CREATE TYPE enum_cheques_status AS ENUM ('pending', 'cleared', 'cancelled');
        `);
      } catch (error) {
        // If the type already exists, this will error, which is fine
        console.log('Cheque status ENUM type may already exist, proceeding...');
      }

      // Create the cheques table
      await queryInterface.createTable('cheques', {
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

      console.log('Successfully created cheques table');
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.dropTable('cheques');
      console.log('Successfully dropped cheques table');

      // Try to drop the ENUM type
      try {
        await queryInterface.sequelize.query(`DROP TYPE IF EXISTS enum_cheques_status;`);
      } catch (error) {
        console.log('Could not drop ENUM type:', error.message);
      }
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  }
};
