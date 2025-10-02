/**
 * Test script to debug snapshot calculation for source ledger reduction
 */

const db = require('./models');
const immutableTransactionService = require('./services/immutableTransactionService');

async function testSnapshotCalculation() {
    try {
        console.log('=== TESTING SNAPSHOT CALCULATION LOGIC ===\n');

        const accountId = 25;
        const donationLedgerId = 100; // From our clean test data
        const expenseLedgerId = 101;

        // 1. Check what immutableTransactionService returns for donation on August 31
        console.log('1. What immutableTransactionService.calculateCurrentBalance returns for donation on August 31:');
        const donationBalance = await immutableTransactionService.calculateCurrentBalance(
            accountId,
            donationLedgerId,
            '2025-08-31'
        );
        console.log(`   Donation balance: ₹${donationBalance}`);

        // 2. Check what it returns for expense
        console.log('\n2. What immutableTransactionService.calculateCurrentBalance returns for expense on August 31:');
        const expenseBalance = await immutableTransactionService.calculateCurrentBalance(
            accountId,
            expenseLedgerId,
            '2025-08-31'
        );
        console.log(`   Expense balance: ₹${expenseBalance}`);

        // 3. Check current snapshot data
        console.log('\n3. Current snapshot data:');
        const snapshots = await db.MonthlyBalanceSummary.findAll({
            where: {
                account_id: accountId,
                month_year: '2025-08-01'
            },
            include: [{
                model: db.LedgerHead,
                as: 'ledgerHead',
                attributes: ['name', 'head_type']
            }]
        });

        snapshots.forEach(snapshot => {
            console.log(`   ${snapshot.ledgerHead.name} (${snapshot.ledgerHead.head_type}): ₹${snapshot.closing_balance}`);
        });

        // 4. Check all August transactions to understand the flow
        console.log('\n4. All August transactions:');
        const augustTransactions = await db.TransactionLog.findAll({
            where: {
                account_id: accountId,
                transaction_date: {
                    [db.Sequelize.Op.between]: ['2025-08-01', '2025-08-31']
                }
            },
            include: [{
                model: db.LedgerHead,
                as: 'ledgerHead',
                attributes: ['name', 'head_type']
            }],
            order: [['transaction_date', 'ASC'], ['log_sequence', 'ASC']]
        });

        augustTransactions.forEach(tx => {
            console.log(`   ${tx.transaction_date} | ${tx.ledgerHead.name} | ${tx.tx_type} | ₹${tx.amount} | ₹${tx.cash_amount} cash + ₹${tx.bank_amount} bank`);
            if (tx.tx_type === 'debit') {
                console.log(`      SOURCE: This debit should reduce some credit ledger's balance`);
            }
        });

        // 5. Check if any debit transactions have source_ledger_head_id
        console.log('\n5. Checking if debit transactions have source_ledger_head_id:');
        const debitTransactions = await db.TransactionLog.findAll({
            where: {
                account_id: accountId,
                tx_type: 'debit',
                transaction_date: {
                    [db.Sequelize.Op.between]: ['2025-08-01', '2025-08-31']
                }
            }
        });

        if (debitTransactions.length > 0) {
            console.log('   Debit transactions found:');
            debitTransactions.forEach(tx => {
                console.log(`     Transaction ${tx.transaction_uuid}: source_ledger_head_id = ${tx.source_ledger_head_id}`);
                if (!tx.source_ledger_head_id) {
                    console.log('     ⚠️ ISSUE: This debit transaction has no source ledger specified!');
                }
            });
        } else {
            console.log('   No debit transactions found in August');
        }

        console.log('\n=== DIAGNOSIS ===');
        console.log('Expected: Donation should show ₹55 (₹80 - ₹25 expense)');
        console.log(`Actual: Donation shows ₹${donationBalance} in calculateCurrentBalance`);
        console.log('If these don\'t match, the issue is in the transaction logic');
        console.log('If they match but snapshot shows different, the issue is in snapshot calculation');

        console.log('\n=== TEST COMPLETED ===');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Details:', error.message);
    }
}

// Run the test
testSnapshotCalculation().then(() => {
    console.log('\nTest complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});