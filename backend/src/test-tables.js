const db = require('./models');

async function checkDatabase() {
  console.log('Checking database tables...');
  
  try {
    // Check accounts
    const accounts = await db.Account.findAll({ raw: true });
    console.log(`\nFound ${accounts.length} accounts:`);
    accounts.forEach(acc => {
      console.log(`- ID: ${acc.id}, Name: ${acc.name}`);
    });
    
    // Check if account 1 exists
    const account1 = await db.Account.findByPk(1, { raw: true });
    if (account1) {
      console.log(`\nAccount 1 exists: ${account1.name}`);
    } else {
      console.log('\nAccount 1 does NOT exist');
    }
    
    // Check ledger heads
    const ledgerHeads = await db.LedgerHead.findAll({ raw: true });
    console.log(`\nFound ${ledgerHeads.length} ledger heads:`);
    ledgerHeads.forEach(lh => {
      console.log(`- ID: ${lh.id}, Name: ${lh.name}, Account: ${lh.account_id}`);
    });
    
    // Check ledger heads for account 1
    const ledgerHeadsAcc1 = await db.LedgerHead.findAll({ 
      where: { account_id: 1 },
      raw: true 
    });
    console.log(`\nFound ${ledgerHeadsAcc1.length} ledger heads for account 1`);
    
    // Check monthly ledger balances
    const mlb = await db.MonthlyLedgerBalance.findAll({ raw: true });
    console.log(`\nFound ${mlb.length} monthly ledger balance entries`);
    
    // Check open periods
    const openPeriods = await db.MonthlyLedgerBalance.findAll({
      where: { is_open: true },
      raw: true
    });
    console.log(`\nFound ${openPeriods.length} open periods`);
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    process.exit();
  }
}

checkDatabase(); 