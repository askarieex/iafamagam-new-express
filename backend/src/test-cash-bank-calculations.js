/**
 * Test cash/bank amount calculations with the user's specific example:
 * "when i example i have 50 rupees in donation ledger in which i have 40 in bank and 10 in cash
 * if i send it 30 from bank and 10 from cash so balance should be 10 rupees cash will be 0 and bank in 10 rupees"
 */

const db = require('./models');
const immutableTransactionService = require('./services/immutableTransactionService');

async function testCashBankCalculations() {
    try {
        console.log('=== TESTING CASH/BANK CALCULATIONS ===\n');

        const accountId = 25;
        const donationLedgerId = 91;

        // 1. Check current donation balance before test
        console.log('1. Current donation balance before test:');
        const currentBalance = await immutableTransactionService.calculateCurrentBalance(accountId, donationLedgerId);
        const donationLedger = await db.LedgerHead.findByPk(donationLedgerId);

        console.log(`   Total Balance: ₹${currentBalance}`);
        console.log(`   Cash Balance: ₹${donationLedger.cash_balance}`);
        console.log(`   Bank Balance: ₹${donationLedger.bank_balance}`);

        // 2. Create test scenario: Add to get 50 rupees total (40 bank + 10 cash)
        const neededAmount = 50 - currentBalance;
        const targetCashBalance = 10;
        const targetBankBalance = 40;

        if (neededAmount > 0) {
            console.log(`\n2. Adding ₹${neededAmount} to reach ₹50 total (₹40 bank + ₹10 cash)...`);

            await immutableTransactionService.createCreditTransaction({
                account_id: accountId,
                ledger_head_id: donationLedgerId,
                amount: neededAmount,
                cash_amount: Math.max(0, targetCashBalance - parseFloat(donationLedger.cash_balance)),
                bank_amount: Math.max(0, targetBankBalance - parseFloat(donationLedger.bank_balance)),
                cash_type: 'both',
                transaction_date: new Date().toISOString().split('T')[0],
                description: 'Test setup: Reaching ₹50 (₹40 bank + ₹10 cash)'
            }, {
                userId: 1,
                ipAddress: '127.0.0.1'
            });

            console.log(`✅ Setup transaction completed`);
        }

        // 3. Check intermediate state
        console.log('\n3. State after setup:');
        const setupBalance = await immutableTransactionService.calculateCurrentBalance(accountId, donationLedgerId);
        const setupLedger = await db.LedgerHead.findByPk(donationLedgerId);

        console.log(`   Total Balance: ₹${setupBalance}`);
        console.log(`   Cash Balance: ₹${setupLedger.cash_balance}`);
        console.log(`   Bank Balance: ₹${setupLedger.bank_balance}`);

        // 4. User's example: Spend ₹30 from bank and ₹10 from cash (total ₹40) on Salary expense
        const salaryLedgerId = 93; // Debit-type ledger head
        console.log('\n4. Creating expense transaction: ₹30 from bank + ₹10 from cash (total ₹40) on Salary...');

        const expenseTransaction = await immutableTransactionService.createDebitTransaction({
            account_id: accountId,
            ledger_head_id: salaryLedgerId, // Use Salary (debit type) for spending
            amount: 40, // Total amount
            cash_amount: 10, // From cash
            bank_amount: 30, // From bank
            cash_type: 'both',
            transaction_date: new Date().toISOString().split('T')[0],
            description: 'Test: Spend ₹30 bank + ₹10 cash from Donation funds'
        }, {
            userId: 1,
            ipAddress: '127.0.0.1'
        });

        console.log(`✅ Expense transaction created: ${expenseTransaction.transaction.uuid}`);

        // 5. Check final result
        console.log('\n5. Final balance after spending ₹40:');
        const finalBalance = await immutableTransactionService.calculateCurrentBalance(accountId, donationLedgerId);
        const finalLedger = await db.LedgerHead.findByPk(donationLedgerId);

        console.log(`   Total Balance: ₹${finalBalance}`);
        console.log(`   Cash Balance: ₹${finalLedger.cash_balance}`);
        console.log(`   Bank Balance: ₹${finalLedger.bank_balance}`);

        // 6. Verify user's expected result
        console.log('\n6. User\'s expected result verification:');
        console.log(`   Expected Total: ₹10 | Actual: ₹${finalBalance} | ✅ ${finalBalance == 10 ? 'CORRECT' : 'INCORRECT'}`);
        console.log(`   Expected Cash: ₹0 | Actual: ₹${finalLedger.cash_balance} | ✅ ${finalLedger.cash_balance == 0 ? 'CORRECT' : 'INCORRECT'}`);
        console.log(`   Expected Bank: ₹10 | Actual: ₹${finalLedger.bank_balance} | ✅ ${finalLedger.bank_balance == 10 ? 'CORRECT' : 'INCORRECT'}`);

        // 7. Show transaction flow summary
        console.log('\n7. Transaction Flow Summary:');
        console.log(`   Starting: ₹${currentBalance} total`);
        console.log(`   Setup to: ₹50 (₹40 bank + ₹10 cash)`);
        console.log(`   Spent: ₹40 (₹30 bank + ₹10 cash)`);
        console.log(`   Remaining: ₹10 (₹0 cash + ₹10 bank)`);

        console.log('\n=== CASH/BANK CALCULATION TEST COMPLETED ===');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Details:', error.message);
    }
}

// Run the test
testCashBankCalculations().then(() => {
    console.log('\nTest complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});