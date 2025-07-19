/**
 * One-time script to rebuild historical monthly snapshots
 * This ensures all periods have correct baselines before deploying the new period-based system
 * Run this BEFORE deploying the new frontend
 */

const db = require('../src/models');
const { Op } = require('sequelize');

async function rebuildHistoricalSnapshots() {
    try {
        console.log('🚀 Starting historical snapshot rebuild...');
        
        // 1. Get all accounts
        const accounts = await db.Account.findAll({
            attributes: ['id', 'name']
        });
        
        console.log(`📊 Found ${accounts.length} accounts to process`);

        // 2. Find the earliest transaction date in the system
        const earliestTransaction = await db.Transaction.findOne({
            attributes: ['tx_date'],
            order: [['tx_date', 'ASC']],
            where: {
                status: 'completed'
            }
        });

        if (!earliestTransaction) {
            console.log('❌ No transactions found in the system');
            return;
        }

        const startDate = new Date(earliestTransaction.tx_date);
        const currentDate = new Date();
        
        console.log(`📅 Processing from ${startDate.toISOString().split('T')[0]} to ${currentDate.toISOString().split('T')[0]}`);

        // 3. For each account, rebuild snapshots month by month
        for (const account of accounts) {
            console.log(`\n🏦 Processing account: ${account.name} (ID: ${account.id})`);
            
            // Get all ledger heads for this account
            const ledgerHeads = await db.LedgerHead.findAll({
                where: { account_id: account.id },
                attributes: ['id', 'name', 'head_type']
            });

            console.log(`  📋 Found ${ledgerHeads.length} ledger heads`);

            // Process each month from start to current
            let processDate = new Date(startDate);
            processDate.setDate(1); // Start from first day of month

            while (processDate <= currentDate) {
                const month = processDate.getMonth() + 1;
                const year = processDate.getFullYear();
                
                console.log(`    📆 Processing ${month}/${year}...`);

                // Process each ledger head for this month
                for (const ledgerHead of ledgerHeads) {
                    await rebuildMonthlySnapshot(account.id, ledgerHead.id, month, year, ledgerHead.head_type);
                }

                // Move to next month
                processDate.setMonth(processDate.getMonth() + 1);
            }
        }

        console.log('\n✅ Historical snapshot rebuild completed successfully!');
        console.log('🚢 You can now deploy the new frontend with confidence.');
        
    } catch (error) {
        console.error('❌ Error rebuilding historical snapshots:', error);
        throw error;
    }
}

async function rebuildMonthlySnapshot(accountId, ledgerHeadId, month, year, headType) {
    const transaction = await db.sequelize.transaction();
    
    try {
        // Calculate date range for this month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // 1. Calculate opening balance from previous month
        let openingBalance = 0;
        if (month > 1) {
            const prevMonth = month - 1;
            const prevYear = year;
            
            const prevMonthSnapshot = await db.MonthlyLedgerBalance.findOne({
                where: {
                    account_id: accountId,
                    ledger_head_id: ledgerHeadId,
                    month: prevMonth,
                    year: prevYear
                },
                transaction
            });
            
            if (prevMonthSnapshot) {
                openingBalance = parseFloat(prevMonthSnapshot.closing_balance);
            }
        } else if (year > startDate.getFullYear()) {
            // Check December of previous year
            const prevMonthSnapshot = await db.MonthlyLedgerBalance.findOne({
                where: {
                    account_id: accountId,
                    ledger_head_id: ledgerHeadId,
                    month: 12,
                    year: year - 1
                },
                transaction
            });
            
            if (prevMonthSnapshot) {
                openingBalance = parseFloat(prevMonthSnapshot.closing_balance);
            }
        }

        // 2. Calculate receipts and payments for this month using transaction items
        const monthlyActivity = await db.sequelize.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN ti.side = '+' THEN ti.amount ELSE 0 END), 0) as receipts,
                COALESCE(SUM(CASE WHEN ti.side = '-' THEN ti.amount ELSE 0 END), 0) as payments,
                COALESCE(SUM(CASE 
                    WHEN ti.side = '+' AND (t.cash_type = 'cash' OR (t.cash_type = 'multiple' AND t.cash_amount > 0)) 
                    THEN CASE 
                        WHEN t.cash_type = 'cash' THEN ti.amount 
                        WHEN t.cash_type = 'multiple' THEN ti.amount * (t.cash_amount / t.amount)
                        ELSE 0 
                    END
                    WHEN ti.side = '-' AND (t.cash_type = 'cash' OR (t.cash_type = 'multiple' AND t.cash_amount > 0))
                    THEN -CASE
                        WHEN t.cash_type = 'cash' THEN ti.amount
                        WHEN t.cash_type = 'multiple' THEN ti.amount * (t.cash_amount / t.amount)
                        ELSE 0
                    END
                    ELSE 0 
                END), 0) as cash_balance,
                COALESCE(SUM(CASE 
                    WHEN ti.side = '+' AND (t.cash_type != 'cash' OR (t.cash_type = 'multiple' AND t.bank_amount > 0))
                    THEN CASE
                        WHEN t.cash_type = 'cash' THEN 0
                        WHEN t.cash_type = 'multiple' THEN ti.amount * (t.bank_amount / t.amount)
                        ELSE ti.amount
                    END
                    WHEN ti.side = '-' AND (t.cash_type != 'cash' OR (t.cash_type = 'multiple' AND t.bank_amount > 0))
                    THEN -CASE
                        WHEN t.cash_type = 'cash' THEN 0
                        WHEN t.cash_type = 'multiple' THEN ti.amount * (t.bank_amount / t.amount)
                        ELSE ti.amount
                    END
                    ELSE 0 
                END), 0) as bank_balance
            FROM transaction_items ti
            JOIN transactions t ON ti.transaction_id = t.id
            WHERE ti.ledger_head_id = :ledgerHeadId 
            AND t.account_id = :accountId
            AND t.tx_date BETWEEN :startDate AND :endDate
            AND t.status = 'completed'
        `, {
            replacements: {
                ledgerHeadId,
                accountId,
                startDate: startDateStr,
                endDate: endDateStr
            },
            type: db.sequelize.QueryTypes.SELECT,
            transaction
        });

        const receipts = parseFloat(monthlyActivity[0]?.receipts || 0);
        const payments = parseFloat(monthlyActivity[0]?.payments || 0);
        const cashInHand = parseFloat(monthlyActivity[0]?.cash_balance || 0);
        const cashInBank = parseFloat(monthlyActivity[0]?.bank_balance || 0);

        // 3. Calculate closing balance
        const closingBalance = headType === 'debit' ? 0 : (openingBalance + receipts - payments);

        // 4. Create or update monthly snapshot
        const [snapshot, created] = await db.MonthlyLedgerBalance.findOrCreate({
            where: {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                month,
                year
            },
            defaults: {
                opening_balance: headType === 'debit' ? 0 : openingBalance,
                receipts,
                payments,
                closing_balance: closingBalance,
                cash_in_hand: cashInHand,
                cash_in_bank: cashInBank,
                is_open: false
            },
            transaction
        });

        if (!created) {
            await snapshot.update({
                opening_balance: headType === 'debit' ? 0 : openingBalance,
                receipts,
                payments,
                closing_balance: closingBalance,
                cash_in_hand: cashInHand,
                cash_in_bank: cashInBank
            }, { transaction });
        }

        await transaction.commit();
        
    } catch (error) {
        await transaction.rollback();
        console.error(`      ❌ Error processing ledger ${ledgerHeadId} for ${month}/${year}:`, error.message);
    }
}

// Run the script if called directly
if (require.main === module) {
    rebuildHistoricalSnapshots()
        .then(() => {
            console.log('\n🎉 All done! Exiting...');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Script failed:', error);
            process.exit(1);
        });
}

module.exports = {
    rebuildHistoricalSnapshots,
    rebuildMonthlySnapshot
}; 