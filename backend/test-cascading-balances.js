const db = require('./src/models');
const balanceCalculationService = require('./src/services/balanceCalculationService');

/**
 * Test script for cascading balance updates
 * This script demonstrates how backdated transactions now trigger cascading balance updates
 */
async function testCascadingBalances() {
    console.log('🧪 Testing Cascading Balance Update System');
    console.log('=========================================');
    
    try {
        // Find an account and ledger head to test with
        const account = await db.Account.findOne({ limit: 1 });
        if (!account) {
            console.error('❌ No accounts found. Please create an account first.');
            return;
        }
        
        const ledgerHead = await db.LedgerHead.findOne({
            where: { 
                account_id: account.id,
                head_type: 'credit' // Only test with credit heads since they carry forward balances
            }
        });
        
        if (!ledgerHead) {
            console.error('❌ No credit ledger heads found for this account.');
            return;
        }
        
        console.log(`📊 Testing with Account: ${account.name} (ID: ${account.id})`);
        console.log(`📊 Testing with Ledger Head: ${ledgerHead.name} (ID: ${ledgerHead.id})`);
        
        // Get current monthly balances to show the problem and solution
        console.log('\n📅 Current Monthly Balance Records:');
        const monthlyBalances = await db.MonthlyLedgerBalance.findAll({
            where: {
                account_id: account.id,
                ledger_head_id: ledgerHead.id
            },
            order: [['year', 'ASC'], ['month', 'ASC']],
            limit: 6
        });
        
        monthlyBalances.forEach(balance => {
            console.log(`   ${balance.month}/${balance.year}: Opening=₹${balance.opening_balance}, Receipts=₹${balance.receipts}, Payments=₹${balance.payments}, Closing=₹${balance.closing_balance}`);
        });
        
        if (monthlyBalances.length >= 2) {
            // Test cascading balance recalculation
            const testMonth = monthlyBalances[0].month;
            const testYear = monthlyBalances[0].year;
            
            console.log(`\n🔄 Testing cascading balance update from ${testMonth}/${testYear}...`);
            
            const transaction = await db.sequelize.transaction();
            
            try {
                await balanceCalculationService.recalculateForwardBalances(
                    account.id,
                    ledgerHead.id,
                    testMonth,
                    testYear,
                    transaction
                );
                
                await transaction.commit();
                console.log('✅ Cascading balance update completed successfully!');
                
                // Show updated balances
                console.log('\n📅 Updated Monthly Balance Records:');
                const updatedBalances = await db.MonthlyLedgerBalance.findAll({
                    where: {
                        account_id: account.id,
                        ledger_head_id: ledgerHead.id
                    },
                    order: [['year', 'ASC'], ['month', 'ASC']],
                    limit: 6
                });
                
                updatedBalances.forEach(balance => {
                    console.log(`   ${balance.month}/${balance.year}: Opening=₹${balance.opening_balance}, Receipts=₹${balance.receipts}, Payments=₹${balance.payments}, Closing=₹${balance.closing_balance}`);
                });
                
                // Verify the chain of balances is correct
                console.log('\n✅ Verification: Checking opening/closing balance chain...');
                let chainValid = true;
                for (let i = 1; i < updatedBalances.length; i++) {
                    const prevClosing = parseFloat(updatedBalances[i-1].closing_balance);
                    const currentOpening = parseFloat(updatedBalances[i].opening_balance);
                    
                    if (Math.abs(prevClosing - currentOpening) > 0.01) {
                        console.log(`   ❌ Chain broken: ${updatedBalances[i-1].month}/${updatedBalances[i-1].year} closing (₹${prevClosing}) != ${updatedBalances[i].month}/${updatedBalances[i].year} opening (₹${currentOpening})`);
                        chainValid = false;
                    } else {
                        console.log(`   ✅ ${updatedBalances[i-1].month}/${updatedBalances[i-1].year} closing (₹${prevClosing}) = ${updatedBalances[i].month}/${updatedBalances[i].year} opening (₹${currentOpening})`);
                    }
                }
                
                if (chainValid) {
                    console.log('\n🎉 SUCCESS: All monthly balance chains are properly linked!');
                } else {
                    console.log('\n⚠️  WARNING: Some balance chains are still broken. This may indicate additional transactions need to be processed.');
                }
                
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        } else {
            console.log('\n⚠️  Not enough monthly balance records to test cascading updates.');
            console.log('   Please add some transactions spanning multiple months first.');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error);
    } finally {
        await db.sequelize.close();
    }
}

// Run the test
if (require.main === module) {
    testCascadingBalances();
}

module.exports = { testCascadingBalances };