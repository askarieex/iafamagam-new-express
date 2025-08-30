/**
 * Show all accounts and their ledger heads
 */
const db = require('./src/models');

async function showAccounts() {
  try {
    console.log('Fetching all accounts...');
    const accounts = await db.Account.findAll();
    
    console.log(`\nFound ${accounts.length} accounts:`);
    for (const account of accounts) {
      console.log(`ID: ${account.id}, Name: ${account.name}`);
      
      const ledgerHeads = await db.LedgerHead.findAll({
        where: { account_id: account.id }
      });
      
      console.log(`  - ${ledgerHeads.length} ledger heads:`);
      for (const head of ledgerHeads) {
        console.log(`    * ID: ${head.id}, Name: ${head.name}, Type: ${head.head_type}`);
      }
      
      const snapshots = await db.MonthlyLedgerBalance.findAll({
        where: { account_id: account.id },
        order: [['year', 'ASC'], ['month', 'ASC']]
      });
      
      console.log(`  - ${snapshots.length} monthly snapshots`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.sequelize.close();
  }
}

showAccounts(); 