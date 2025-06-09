// Direct SQL solution to open a period without using Sequelize ORM
const db = require('../models');

/**
 * Open an accounting period using direct SQL
 * @param {number} accountId - Account ID
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Promise<Object>} Result of opening the period
 */
const openPeriodDirectSQL = async (accountId, month, year) => {
    try {
        console.log(`Using direct SQL to open period ${month}/${year} for account ${accountId}`);

        const transaction = await db.sequelize.transaction();

        try {
            // Close any currently open periods
            await db.sequelize.query(
                "UPDATE monthly_ledger_balances SET is_open = false WHERE account_id = ? AND is_open = true",
                { 
                    replacements: [accountId],
                    transaction
                }
            );
            
            // Get all ledger heads for this account
            const ledgerHeads = await db.sequelize.query(
                "SELECT id, current_balance, name FROM ledger_heads WHERE account_id = ?",
                {
                    replacements: [accountId],
                    type: db.sequelize.QueryTypes.SELECT,
                    transaction
                }
            );
            
            console.log(`Found ${ledgerHeads.length} ledger heads for account ${accountId}`);
            
            if (!ledgerHeads.length) {
                throw new Error('No ledger heads found for this account');
            }
            
            // Process each ledger head
            for (const ledger of ledgerHeads) {
                console.log(`Processing ledger head ${ledger.id} (${ledger.name})`);
                
                // Check if this period already exists for this ledger
                const existingPeriod = await db.sequelize.query(
                    "SELECT id FROM monthly_ledger_balances WHERE account_id = ? AND ledger_head_id = ? AND month = ? AND year = ?",
                    {
                        replacements: [accountId, ledger.id, month, year],
                        type: db.sequelize.QueryTypes.SELECT,
                        transaction
                    }
                );
                
                const openingBalance = ledger.current_balance || 0;
                
                if (existingPeriod.length > 0) {
                    // Update existing period
                    await db.sequelize.query(
                        "UPDATE monthly_ledger_balances SET is_open = true, updated_at = NOW() WHERE id = ?",
                        {
                            replacements: [existingPeriod[0].id],
                            transaction
                        }
                    );
                    console.log(`Updated existing period for ledger ${ledger.id}`);
                } else {
                    // Create new period
                    await db.sequelize.query(
                        `INSERT INTO monthly_ledger_balances (
                            account_id, ledger_head_id, month, year, 
                            opening_balance, receipts, payments, closing_balance,
                            cash_in_hand, cash_in_bank, is_open, created_at, updated_at
                        ) 
                        VALUES (?, ?, ?, ?, ?, 0, 0, ?, 0, 0, true, NOW(), NOW())`,
                        {
                            replacements: [
                                accountId, ledger.id, month, year,
                                openingBalance, openingBalance
                            ],
                            transaction
                        }
                    );
                    console.log(`Created new period for ledger ${ledger.id}`);
                }
            }
            
            // Add audit log
            await db.sequelize.query(
                `INSERT INTO audit_logs (entity_type, entity_id, action, details, created_at, updated_at)
                 VALUES ('Account', ?, 'periodOpened', ?, NOW(), NOW())`,
                {
                    replacements: [accountId, `Opened period ${month}/${year} using direct SQL`],
                    transaction
                }
            );
            
            // Commit transaction
            await transaction.commit();
            console.log(`Successfully opened period ${month}/${year} for account ${accountId}`);
            
            return {
                success: true,
                message: `Period ${month}/${year} opened successfully`,
                data: {
                    account_id: accountId,
                    month,
                    year
                }
            };
            
        } catch (error) {
            // Rollback transaction on error
            if (transaction && !transaction.finished) {
                await transaction.rollback();
                console.log('Transaction rolled back due to error');
            }
            
            throw error;
        }
        
    } catch (error) {
        console.error(`Error opening period using direct SQL: ${error.message}`);
        return {
            success: false,
            message: `Failed to open period: ${error.message}`,
            error
        };
    }
};

module.exports = openPeriodDirectSQL; 