/**
 * Debug script to check September transactions that might be affecting the user's expectations
 */

const db = require('./models');

async function checkSeptemberTransactions() {
    try {
        console.log('=== CHECKING SEPTEMBER 2025 TRANSACTIONS ===\n');

        const accountId = 25;
        const ledgerHeadId = 89; // Donation ledger head

        // Check September transactions
        console.log('1. Checking September 2025 transactions...');
        const septTransactions = await db.TransactionLog.findAll({
            where: {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                transaction_date: {
                    [db.Sequelize.Op.between]: ['2025-09-01', '2025-09-30']
                }
            },
            order: [['transaction_date', 'ASC']]
        });

        console.log(`Found ${septTransactions.length} transactions in September 2025:`);
        septTransactions.forEach(tx => {
            console.log(`  - Date: ${tx.transaction_date}, Amount: ₹${tx.amount}, Type: ${tx.tx_type}`);
            console.log(`    UUID: ${tx.transaction_uuid}`);
            console.log(`    Created: ${tx.created_at}`);
        });

        // Check if any September transactions were created around the same time as August transactions
        console.log('\n2. Looking for potentially backdated transactions in September...');
        const recentTransactions = await db.TransactionLog.findAll({
            where: {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                created_at: {
                    [db.Sequelize.Op.gte]: '2025-09-29' // Today's date
                }
            },
            order: [['created_at', 'DESC']]
        });

        console.log(`Found ${recentTransactions.length} recently created transactions:`);
        recentTransactions.forEach(tx => {
            const timeDiff = new Date(tx.created_at) - new Date(tx.transaction_date);
            const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

            console.log(`  - Transaction Date: ${tx.transaction_date}, Amount: ₹${tx.amount}`);
            console.log(`    Created: ${tx.created_at}`);
            console.log(`    Backdated by: ${daysDiff} days`);
            console.log(`    UUID: ${tx.transaction_uuid}`);
        });

        // Check current snapshots
        console.log('\n3. Current snapshot status:');

        const augustSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                month_year: '2025-08-01'
            }
        });

        const septSnapshot = await db.MonthlyBalanceSummary.findOne({
            where: {
                account_id: accountId,
                ledger_head_id: ledgerHeadId,
                month_year: '2025-09-01'
            }
        });

        if (augustSnapshot) {
            console.log('August 2025 Snapshot:');
            console.log(`  - Closing Balance: ₹${augustSnapshot.closing_balance}`);
            console.log(`  - Total Credits: ₹${augustSnapshot.total_credits}`);
            console.log(`  - Transaction Count: ${augustSnapshot.transaction_count}`);
        }

        if (septSnapshot) {
            console.log('September 2025 Snapshot:');
            console.log(`  - Closing Balance: ₹${septSnapshot.closing_balance}`);
            console.log(`  - Total Credits: ₹${septSnapshot.total_credits}`);
            console.log(`  - Transaction Count: ${septSnapshot.transaction_count}`);
        }

        console.log('\n=== ANALYSIS COMPLETE ===');

    } catch (error) {
        console.error('❌ Error during September transaction check:', error);
    }
}

// Run the check
checkSeptemberTransactions().then(() => {
    console.log('\nAnalysis complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Analysis failed:', error);
    process.exit(1);
});