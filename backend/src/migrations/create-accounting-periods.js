/**
 * Migration: Create accounting_periods table for centralized period management
 * 
 * This migration creates the new accounting_periods table that will serve as the
 * single source of truth for period status across the application.
 */

const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('accounting_periods', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            account_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'accounts',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            month: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: {
                    min: 1,
                    max: 12
                },
                comment: 'Month (1-12)'
            },
            year: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: {
                    min: 2000,
                    max: 2100
                },
                comment: 'Year (e.g., 2025)'
            },
            status: {
                type: DataTypes.ENUM('open', 'closed'),
                allowNull: false,
                defaultValue: 'closed',
                comment: 'Period status - only one period can be open per account at a time'
            },
            opened_at: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: 'Timestamp when period was opened'
            },
            closed_at: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: 'Timestamp when period was closed'
            },
            opened_by: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'Users',
                    key: 'id'
                },
                comment: 'User who opened this period'
            },
            closed_by: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'Users',
                    key: 'id'
                },
                comment: 'User who closed this period'
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: 'Optional notes about period opening/closing'
            },
            is_auto_opened: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                comment: 'True if period was auto-opened by system, false if manually opened'
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        // Add indexes for performance
        await queryInterface.addIndex('accounting_periods', {
            fields: ['account_id', 'month', 'year'],
            unique: true,
            name: 'unique_account_period'
        });

        await queryInterface.addIndex('accounting_periods', {
            fields: ['account_id', 'status'],
            name: 'idx_account_status'
        });

        await queryInterface.addIndex('accounting_periods', {
            fields: ['status', 'month', 'year'],
            name: 'idx_status_period'
        });

        console.log('✅ accounting_periods table created successfully');
    },

    down: async (queryInterface, Sequelize) => {
        // Drop indexes first
        try {
            await queryInterface.removeIndex('accounting_periods', 'idx_status_period');
            await queryInterface.removeIndex('accounting_periods', 'idx_account_status');
            await queryInterface.removeIndex('accounting_periods', 'unique_account_period');
        } catch (error) {
            console.log('Some indexes may not exist, continuing with table drop...');
        }

        // Drop the table
        await queryInterface.dropTable('accounting_periods');
        console.log('✅ accounting_periods table dropped successfully');
    }
};