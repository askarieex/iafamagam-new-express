/**
 * Test script to verify the fix for the opening balance calculation issue
 * Specifically ensures that opening a previous month doesn't copy future month balances
 */
const db = require('../models');
const BalanceCalculator = require('../utils/balanceCalculator');
const monthlyClosureService = require('../services/monthlyClosureService');

// Test account and ledger details
const TEST_ACCOUNT_ID = 1;
const TEST_LEDGER_HEAD_ID = 1;

async function testOpeningBalanceFix() {
    console.log('Running test for opening balance fix...');
    
    try {
        // Start a transaction to rollback all changes after test
        const transaction = await db.sequelize.transaction();
        
        try {
            // 1. First, set up our test environment
            // Ensure we have test account and ledger head
            let account = await db.Account.findByPk(TEST_ACCOUNT_ID, { transaction });
            if (!account) {
                console.log('Creating test account...');
                account = await db.Account.create({
                    id: TEST_ACCOUNT_ID,
                    name: 'Test Account',
                    last_closed_date: '2025-03-31'
                }, { transaction });
            }
            
            let ledgerHead = await db.LedgerHead.findByPk(TEST_LEDGER_HEAD_ID, { transaction });
            if (!ledgerHead) {
                console.log('Creating test ledger head...');
                ledgerHead = await db.LedgerHead.create({
                    id: TEST_LEDGER_HEAD_ID,
                    account_id: TEST_ACCOUNT_ID,
                    name: 'Test Ledger',
                    head_type: 'credit', // Required field with enum values 'debit' or 'credit'
                    description: 'Test ledger for balance calculation testing',
                    current_balance: 0,
                    cash_balance: 0,
                    bank_balance: 0
                }, { transaction });
            }
            
            // 2. Clear all existing monthly balances for our test
            await db.MonthlyLedgerBalance.destroy({
                where: {
                    account_id: TEST_ACCOUNT_ID,
                    ledger_head_id: TEST_LEDGER_HEAD_ID
                },
                transaction
            });
            console.log('Cleared existing monthly balances for test');
            
            // 3. Create July 2025 with a balance of 1000
            await db.MonthlyLedgerBalance.create({
                account_id: TEST_ACCOUNT_ID,
                ledger_head_id: TEST_LEDGER_HEAD_ID,
                month: 7,
                year: 2025,
                opening_balance: 0,
                receipts: 1000,
                payments: 0,
                closing_balance: 1000,
                is_open: true,
                cash_in_hand: 1000,
                cash_in_bank: 0
            }, { transaction });
            console.log('Created July 2025 with 1000 balance');
            
            // 4. Now open June 2025 - this should NOT have July's balance as opening
            const juneResult = await monthlyClosureService.openAccountingPeriod(6, 2025, TEST_ACCOUNT_ID, transaction);
            console.log('Opened June 2025, result:', JSON.stringify(juneResult, null, 2));
            
            // 5. Check what opening balance was calculated for June
            const juneBalance = await db.MonthlyLedgerBalance.findOne({
                where: {
                    account_id: TEST_ACCOUNT_ID,
                    ledger_head_id: TEST_LEDGER_HEAD_ID,
                    month: 6,
                    year: 2025
                },
                transaction
            });
            
            console.log('June opening balance:', juneBalance.opening_balance);
            console.log('TEST RESULT: June opening balance should be 0 (not 1000)');
            
            if (parseInt(juneBalance.opening_balance) === 0) {
                console.log('✅ TEST PASSED: June opening balance is correctly set to 0');
            } else {
                console.error('❌ TEST FAILED: June opening balance is incorrectly set to ' + juneBalance.opening_balance);
            }
            
            // 6. Add a transaction to June
            await db.Transaction.create({
                account_id: TEST_ACCOUNT_ID,
                ledger_head_id: TEST_LEDGER_HEAD_ID,
                tx_date: '2025-06-15',
                tx_type: 'credit',
                amount: 500,
                description: 'Test transaction',
                status: 'completed'
            }, { transaction });
            console.log('Added 500 credit transaction to June 2025');
            
            // 7. Recalculate June
            await BalanceCalculator.recalculateMonthlySnapshots(
                TEST_ACCOUNT_ID,
                TEST_LEDGER_HEAD_ID,
                '2025-06-01',
                transaction
            );
            
            // 8. Check June and July balances after recalculation
            const updatedJune = await db.MonthlyLedgerBalance.findOne({
                where: {
                    account_id: TEST_ACCOUNT_ID,
                    ledger_head_id: TEST_LEDGER_HEAD_ID,
                    month: 6,
                    year: 2025
                },
                transaction
            });
            
            const updatedJuly = await db.MonthlyLedgerBalance.findOne({
                where: {
                    account_id: TEST_ACCOUNT_ID,
                    ledger_head_id: TEST_LEDGER_HEAD_ID,
                    month: 7,
                    year: 2025
                },
                transaction
            });
            
            console.log('After recalculation:');
            console.log('June balance:', {
                opening: updatedJune.opening_balance,
                receipts: updatedJune.receipts,
                closing: updatedJune.closing_balance
            });
            console.log('July balance:', {
                opening: updatedJuly.opening_balance,
                receipts: updatedJuly.receipts,
                closing: updatedJuly.closing_balance
            });
            
            // 9. Now open May 2025 - this should have 0 balance, not June's balance
            const mayResult = await monthlyClosureService.openAccountingPeriod(5, 2025, TEST_ACCOUNT_ID, transaction);
            console.log('Opened May 2025');
            
            // 10. Check what opening balance was calculated for May
            const mayBalance = await db.MonthlyLedgerBalance.findOne({
                where: {
                    account_id: TEST_ACCOUNT_ID,
                    ledger_head_id: TEST_LEDGER_HEAD_ID,
                    month: 5,
                    year: 2025
                },
                transaction
            });
            
            console.log('May opening balance:', mayBalance.opening_balance);
            console.log('TEST RESULT: May opening balance should be 0 (not 500)');
            
            if (parseInt(mayBalance.opening_balance) === 0) {
                console.log('✅ TEST PASSED: May opening balance is correctly set to 0');
            } else {
                console.error('❌ TEST FAILED: May opening balance is incorrectly set to ' + mayBalance.opening_balance);
            }
            
            console.log('TEST COMPLETED');
            
        } catch (error) {
            console.error('Test error:', error);
        }
        
        // Roll back all changes made during the test
        await transaction.rollback();
        console.log('Test transaction rolled back successfully');
        
    } catch (error) {
        console.error('Test setup error:', error);
    }
    
    // Close the database connection when done
    await db.sequelize.close();
}

// Run the test
testOpeningBalanceFix(); 