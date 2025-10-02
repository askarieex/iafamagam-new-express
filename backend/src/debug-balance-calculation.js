/**
 * Debug script to check balance calculation for the Salary ledger head
 */

const db = require('./models');
const immutableTransactionService = require('./services/immutableTransactionService');

async function debugBalanceCalculation() {
    try {
        console.log('=== DEBUGGING BALANCE CALCULATION ===\n');

        const accountId = 25;

        // Check both ledger heads
        const ledgerHeads = await db.LedgerHead.findAll({
            where: {
                account_id: accountId,
                id: [89, 90] // Donation and Salary
            }
        });

        console.log('1. Ledger heads:');
        ledgerHeads.forEach(lh => {
            console.log(`   - ID: ${lh.id}, Name: ${lh.name}, Type: ${lh.head_type}`);
        });

        // Check all August transactions for both ledgers
        console.log('\n2. August 2025 transactions:');

        for (const ledger of ledgerHeads) {
            console.log(`\n   Ledger ${ledger.id} (${ledger.name}):`);

            const transactions = await db.TransactionLog.findAll({
                where: {
                    account_id: accountId,
                    ledger_head_id: ledger.id,
                    transaction_date: {
                        [db.Sequelize.Op.between]: ['2025-08-01', '2025-08-31']
                    }
                },
                order: [['transaction_date', 'ASC']]
            });

            let totalCredits = 0;
            let totalDebits = 0;

            transactions.forEach(tx => {
                console.log(`     - ${tx.transaction_date}: ${tx.tx_type} ₹${tx.amount}`);
                if (tx.tx_type === 'credit') {
                    totalCredits += parseFloat(tx.amount);
                } else {
                    totalDebits += parseFloat(tx.amount);
                }
            });

            console.log(`   Manual calculation:`);
            console.log(`     Credits: ₹${totalCredits}`);
            console.log(`     Debits: ₹${totalDebits}`);
            console.log(`     Balance (Credits - Debits): ₹${totalCredits - totalDebits}`);

            // Now test the service calculation
            const serviceBalance = await immutableTransactionService.calculateCurrentBalance(
                accountId,
                ledger.id,
                '2025-08-31'
            );

            console.log(`   Service calculation: ₹${serviceBalance}`);
            console.log(`   Match: ${(totalCredits - totalDebits) === serviceBalance ? '✅' : '❌'}`);
        }

        // Check the snapshot data
        console.log('\n3. Current snapshots:');
        const snapshots = await db.MonthlyBalanceSummary.findAll({
            where: {
                account_id: accountId,
                month_year: '2025-08-01'
            },
            order: [['ledger_head_id', 'ASC']]
        });

        snapshots.forEach(snap => {
            console.log(`   Ledger ${snap.ledger_head_id}:`);
            console.log(`     Opening: ₹${snap.opening_balance}`);
            console.log(`     Closing: ₹${snap.closing_balance}`);
            console.log(`     Credits: ₹${snap.total_credits}`);
            console.log(`     Debits: ₹${snap.total_debits}`);
            console.log(`     Expected Balance: ₹${snap.total_credits - snap.total_debits}`);
        });

        console.log('\n=== DEBUG COMPLETED ===');

    } catch (error) {
        console.error('❌ Error during balance calculation debug:', error);
    }
}

// Run the debug
debugBalanceCalculation().then(() => {
    console.log('\nDebug complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Debug failed:', error);
    process.exit(1);
});