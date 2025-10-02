/**
 * Debug script to test if source_ledger_head_id is being saved correctly
 */

const db = require('./models');
const immutableTransactionService = require('./services/immutableTransactionService');

async function debugSourceLedgerInsert() {
    try {
        console.log('=== DEBUGGING SOURCE LEDGER HEAD ID INSERTION ===\n');

        // Clear previous test data
        await db.TransactionLog.destroy({ where: { description: { [db.Sequelize.Op.like]: '%DEBUG%' } } });

        console.log('1. Testing direct database insert with source_ledger_head_id...');

        // Test direct insert to see if the field saves
        const directInsert = await db.TransactionLog.create({
            transaction_uuid: 'debug-direct-insert',
            log_sequence: 1,
            action_type: 'CREATE',
            account_id: 25,
            ledger_head_id: 109,
            source_ledger_head_id: 108,  // EXPLICITLY SET
            amount: 10,
            cash_amount: 6,
            bank_amount: 4,
            tx_type: 'debit',
            cash_type: 'both',  // Added required field
            transaction_date: '2025-09-25',
            description: 'DEBUG: Direct insert test',
            created_by: 1,
            client_ip: '127.0.0.1',
            user_agent: 'Debug',
            session_id: 'debug',
            previous_hash: '',
            current_hash: 'debug-hash'
        });

        console.log(`   ✅ Direct insert result: source_ledger_head_id = ${directInsert.source_ledger_head_id}`);

        console.log('\n2. Testing through immutableTransactionService...');

        // Set up required balances first
        await db.LedgerHead.update({
            current_balance: 1000,
            cash_balance: 600,
            bank_balance: 400
        }, { where: { id: 108 } });

        const userContext = {
            userId: 1,
            ipAddress: '127.0.0.1',
            userAgent: 'Debug Service Test',
            sessionId: 'debug-service'
        };

        console.log('   Creating debit transaction through service...');

        const serviceResult = await immutableTransactionService.createDebitTransaction({
            account_id: 25,
            ledger_head_id: 109,
            source_ledger_head_id: 108,  // EXPLICITLY PROVIDED
            amount: 20,
            cash_amount: 12,
            bank_amount: 8,
            cash_type: 'both',
            transaction_date: '2025-09-26',
            description: 'DEBUG: Service insert test'
        }, userContext);

        console.log(`   ✅ Service transaction created: ${serviceResult.transaction.uuid}`);

        // Check what was actually saved
        const savedTransaction = await db.TransactionLog.findOne({
            where: {
                transaction_uuid: serviceResult.transaction.uuid,
                tx_type: 'debit'
            }
        });

        console.log(`   📊 Service insert result: source_ledger_head_id = ${savedTransaction.source_ledger_head_id}`);

        console.log('\n3. Comparison of results:');
        console.log(`   Direct insert source_ledger_head_id: ${directInsert.source_ledger_head_id}`);
        console.log(`   Service insert source_ledger_head_id: ${savedTransaction.source_ledger_head_id}`);

        const directWorking = directInsert.source_ledger_head_id == 108;
        const serviceWorking = savedTransaction.source_ledger_head_id == 108;

        console.log(`\n   ✅ Direct database insert: ${directWorking ? 'WORKING ✓' : 'FAILED ✗'}`);
        console.log(`   ✅ Service insert: ${serviceWorking ? 'WORKING ✓' : 'FAILED ✗'}`);

        if (directWorking && !serviceWorking) {
            console.log('\n   🔍 DIAGNOSIS: Database supports the field, but service is not saving it correctly');
            console.log('   📋 The issue is in the immutableTransactionService.js logic');
        } else if (!directWorking) {
            console.log('\n   🔍 DIAGNOSIS: Database schema or model issue');
        } else {
            console.log('\n   🎉 Both methods work - something else is causing the issue');
        }

        // Clean up test data
        await db.TransactionLog.destroy({ where: { description: { [db.Sequelize.Op.like]: '%DEBUG%' } } });

    } catch (error) {
        console.error('❌ Debug test failed:', error);
        console.error('Details:', error.message);
    }
}

// Run the debug test
debugSourceLedgerInsert().then(() => {
    console.log('\nDebug test complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Debug test error:', error);
    process.exit(1);
});