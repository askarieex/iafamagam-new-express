'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        try {
            // Check if is_open column exists before adding
            const tableDesc = await queryInterface.describeTable('monthly_ledger_balances');

            if (!tableDesc.is_open) {
                await queryInterface.addColumn('monthly_ledger_balances', 'is_open', {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                    comment: 'Whether this period is currently open for transactions'
                });
            }

            // Wait a moment to ensure the column is added before creating the index
            await queryInterface.sequelize.query('SELECT 1');

            // Check if index exists before adding
            try {
                await queryInterface.addIndex('monthly_ledger_balances', ['account_id', 'is_open'], {
                    unique: true,
                    name: 'one_open_period_per_account',
                    where: {
                        is_open: true
                    }
                });
            } catch (indexError) {
                if (indexError.message && indexError.message.includes('already exists')) {
                    console.log('Index one_open_period_per_account already exists, skipping...');
                } else {
                    throw indexError;
                }
            }

            // Set current month for each account as open
            const [accounts] = await queryInterface.sequelize.query(`SELECT DISTINCT account_id FROM monthly_ledger_balances;`);

            // For each account, find the latest month and mark it as open
            for (const account of accounts) {
                const accountId = account.account_id;

                // Find the latest month/year for this account
                const [latestPeriod] = await queryInterface.sequelize.query(`
          SELECT month, year FROM monthly_ledger_balances 
          WHERE account_id = ${accountId}
          ORDER BY year DESC, month DESC
          LIMIT 1;
        `);

                if (latestPeriod.length > 0) {
                    // Update the latest period to be open
                    await queryInterface.sequelize.query(`
            UPDATE monthly_ledger_balances 
            SET is_open = true
            WHERE account_id = ${accountId} 
            AND month = ${latestPeriod[0].month} 
            AND year = ${latestPeriod[0].year};
          `);
                }
            }

            console.log('Migration: Added is_open column and index to monthly_ledger_balances');
        } catch (error) {
            console.error('Migration error:', error);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        try {
            // Remove index first
            await queryInterface.removeIndex('monthly_ledger_balances', 'one_open_period_per_account');

            // Then remove the column
            await queryInterface.removeColumn('monthly_ledger_balances', 'is_open');

            console.log('Migration: Removed is_open column and index from monthly_ledger_balances');
        } catch (error) {
            console.error('Migration error:', error);
            throw error;
        }
    }
}; 