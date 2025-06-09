'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        try {
            // Check if audit_logs table exists
            const tableExists = await queryInterface.sequelize.query(
                `SELECT to_regclass('public.audit_logs') as exists`,
                { type: queryInterface.sequelize.QueryTypes.SELECT }
            ).then(result => !!result[0].exists);

            if (!tableExists) {
                await queryInterface.createTable('audit_logs', {
                    id: {
                        type: Sequelize.INTEGER,
                        allowNull: false,
                        primaryKey: true,
                        autoIncrement: true
                    },
                    entity_type: {
                        type: Sequelize.STRING,
                        allowNull: false
                    },
                    entity_id: {
                        type: Sequelize.INTEGER,
                        allowNull: false
                    },
                    action: {
                        type: Sequelize.STRING,
                        allowNull: false
                    },
                    details: {
                        type: Sequelize.TEXT,
                        allowNull: true
                    },
                    user_id: {
                        type: Sequelize.INTEGER,
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

                // Add indexes for performance
                await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id']);
                await queryInterface.addIndex('audit_logs', ['action']);
                await queryInterface.addIndex('audit_logs', ['created_at']);

                console.log('Migration: Created audit_logs table');
            } else {
                console.log('Migration: audit_logs table already exists, skipping creation');
            }
        } catch (error) {
            console.error('Migration error:', error);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        try {
            await queryInterface.dropTable('audit_logs');
            console.log('Migration: Dropped audit_logs table');
        } catch (error) {
            console.error('Migration error:', error);
            throw error;
        }
    }
}; 