const db = require('./models');

async function openPeriodManually() {
    try {
        // Settings
        const accountId = 1; // Replace with your account ID
        const month = 6;    // June
        const year = 2025;  // 2025

        console.log(`Manually opening period ${month}/${year} for account ${accountId}`);

        // Start a transaction
        const transaction = await db.sequelize.transaction();

        try {
            // Step 1: Close any open periods
            await db.sequelize.query(
                "UPDATE monthly_ledger_balances SET is_open = false WHERE account_id = ? AND is_open = true",
                {
                    replacements: [accountId],
                    transaction
                }
            );

            console.log('Closed any existing open periods');

            // Step 2: Get ledger heads for this account
            const ledgerHeads = await db.sequelize.query(
                "SELECT id, name, current_balance FROM ledger_heads WHERE account_id = ?",
                {
                    replacements: [accountId],
                    type: db.sequelize.QueryTypes.SELECT,
                    transaction
                }
            );

            console.log(`Found ${ledgerHeads.length} ledger heads`);

            // Step 3: Process each ledger head
            for (const ledger of ledgerHeads) {
                // Check if period already exists
                const existingPeriod = await db.sequelize.query(
                    "SELECT id FROM monthly_ledger_balances WHERE account_id = ? AND ledger_head_id = ? AND month = ? AND year = ?",
                    {
                        replacements: [accountId, ledger.id, month, year],
                        type: db.sequelize.QueryTypes.SELECT,
                        transaction
                    }
                );

                if (existingPeriod.length > 0) {
                    // Update existing period
                    console.log(`Updating existing period for ledger ${ledger.id} (${ledger.name})`);

                    await db.sequelize.query(
                        "UPDATE monthly_ledger_balances SET is_open = true, updated_at = NOW() WHERE id = ?",
                        {
                            replacements: [existingPeriod[0].id],
                            transaction
                        }
                    );
                } else {
                    // Create new period
                    console.log(`Creating new period for ledger ${ledger.id} (${ledger.name})`);

                    const balance = parseFloat(ledger.current_balance || 0);

                    await db.sequelize.query(
                        `INSERT INTO monthly_ledger_balances 
                         (account_id, ledger_head_id, month, year, opening_balance, receipts, payments, closing_balance, cash_in_hand, cash_in_bank, is_open, created_at, updated_at) 
                         VALUES (?, ?, ?, ?, ?, 0, 0, ?, 0, 0, true, NOW(), NOW())`,
                        {
                            replacements: [accountId, ledger.id, month, year, balance, balance],
                            transaction
                        }
                    );
                }
            }

            // Step 4: Add an audit log entry
            await db.sequelize.query(
                `INSERT INTO audit_logs 
                 (entity_type, entity_id, action, details, created_at, updated_at) 
                 VALUES ('Account', ?, 'periodOpened', ?, NOW(), NOW())`,
                {
                    replacements: [accountId, `Manually opened period ${month}/${year}`],
                    transaction
                }
            );

            // Commit transaction
            await transaction.commit();
            console.log('Success! Period has been opened.');

        } catch (error) {
            // Rollback on error
            await transaction.rollback();
            console.error('Error in transaction:', error);
        }

    } catch (error) {
        console.error('Error opening period:', error);
    } finally {
        process.exit();
    }
}

// Run the function
openPeriodManually(); 