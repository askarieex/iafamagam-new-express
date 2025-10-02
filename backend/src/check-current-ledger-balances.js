/**
 * CHECK CURRENT LEDGER BALANCES
 *
 * This script checks the actual current balances in the ledger_heads table
 * to see if source ledger balance reduction is working correctly.
 */

const db = require('./models');

async function checkCurrentLedgerBalances() {
    console.log('🔍 CHECKING CURRENT LEDGER HEAD BALANCES');
    console.log('=' .repeat(60));

    try {
        // Get current balances from ledger_heads table
        const ledgerHeads = await db.LedgerHead.findAll({
            where: { account_id: 25 },
            attributes: ['id', 'name', 'head_type', 'current_balance', 'cash_balance', 'bank_balance'],
            order: [['name', 'ASC']]
        });

        console.log('\n📊 CURRENT LEDGER HEAD BALANCES (Real-time from database):');
        ledgerHeads.forEach(lh => {
            console.log(`  ${lh.name} (${lh.head_type}):`);
            console.log(`    Current Balance: ₹${lh.current_balance}`);
            console.log(`    Cash Balance: ₹${lh.cash_balance}`);
            console.log(`    Bank Balance: ₹${lh.bank_balance}`);
            console.log(`    Total (Cash + Bank): ₹${parseFloat(lh.cash_balance || 0) + parseFloat(lh.bank_balance || 0)}`);
            console.log('');
        });

        // Get all transaction logs for account 25
        console.log('\n📜 RECENT TRANSACTION LOGS:');
        const transactions = await db.TransactionLog.findAll({
            where: { account_id: 25 },
            include: [{
                model: db.LedgerHead,
                as: 'ledgerHead',
                attributes: ['name', 'head_type']
            }],
            order: [['created_at', 'DESC']],
            limit: 10
        });

        transactions.forEach((tx, index) => {
            console.log(`  ${index + 1}. ${tx.tx_type.toUpperCase()} - ₹${tx.amount} to ${tx.ledgerHead.name}`);
            console.log(`     Date: ${tx.transaction_date}`);
            console.log(`     Cash: ₹${tx.cash_amount}, Bank: ₹${tx.bank_amount}`);
            if (tx.source_ledger_head_id) {
                console.log(`     Source Ledger ID: ${tx.source_ledger_head_id}`);
            }
            console.log('');
        });

        // Check if there's a mismatch between what we expect and what we see
        const donationLedger = ledgerHeads.find(lh => lh.name === 'Donation');
        const expenseLedger = ledgerHeads.find(lh => lh.name === 'Expense');

        if (donationLedger && expenseLedger) {
            console.log('\n🔍 BALANCE ANALYSIS:');
            console.log(`  Donation balance: ₹${donationLedger.current_balance}`);
            console.log(`  Expense balance: ₹${expenseLedger.current_balance}`);
            console.log(`  Net balance: ₹${parseFloat(donationLedger.current_balance) - parseFloat(expenseLedger.current_balance)}`);

            if (parseFloat(donationLedger.current_balance) === 30) {
                console.log('  ✅ CORRECT: Donation balance shows ₹30 (₹50 - ₹20)');
            } else if (parseFloat(donationLedger.current_balance) === 50) {
                console.log('  ❌ PROBLEM: Donation balance still shows ₹50 (source ledger not reduced)');
            } else {
                console.log(`  ❓ UNEXPECTED: Donation balance shows ₹${donationLedger.current_balance}`);
            }
        }

    } catch (error) {
        console.error('❌ Error checking balances:', error.message);
    } finally {
        process.exit(0);
    }
}

checkCurrentLedgerBalances();