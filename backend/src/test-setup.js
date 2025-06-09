const db = require('./models');

async function setupTestData() {
  try {
    console.log('Setting up test data...');
    
    // Create test account if it doesn't exist
    let account = await db.Account.findOne({ where: { name: 'Test Account' } });
    
    if (!account) {
      console.log('Creating test account...');
      account = await db.Account.create({
        name: 'Test Account',
        opening_balance: 10000,
        closing_balance: 10000,
        cash_balance: 5000,
        bank_balance: 5000
      });
      console.log(`Created account with ID ${account.id}`);
    } else {
      console.log(`Using existing account with ID ${account.id}`);
    }
    
    // Create test ledger heads if they don't exist
    const ledgerHeads = [
      { name: 'Cash', type: 'debit', balance: 5000, cashBalance: 5000, bankBalance: 0 },
      { name: 'Bank', type: 'debit', balance: 5000, cashBalance: 0, bankBalance: 5000 },
      { name: 'Income', type: 'credit', balance: 0, cashBalance: 0, bankBalance: 0 },
      { name: 'Expense', type: 'debit', balance: 0, cashBalance: 0, bankBalance: 0 }
    ];
    
    for (const head of ledgerHeads) {
      let ledgerHead = await db.LedgerHead.findOne({ 
        where: { 
          name: head.name, 
          account_id: account.id 
        } 
      });
      
      if (!ledgerHead) {
        console.log(`Creating ledger head: ${head.name}`);
        ledgerHead = await db.LedgerHead.create({
          name: head.name,
          account_id: account.id,
          head_type: head.type,
          current_balance: head.balance,
          cash_balance: head.cashBalance,
          bank_balance: head.bankBalance,
          description: `Test ${head.name} ledger head`
        });
        console.log(`Created ledger head with ID ${ledgerHead.id}`);
      } else {
        console.log(`Using existing ledger head: ${head.name} (ID: ${ledgerHead.id})`);
      }
    }
    
    console.log('Test data setup complete.');
    console.log(`You can now test with account ID: ${account.id}`);
    
    return account.id;
  } catch (error) {
    console.error('Error setting up test data:', error);
    throw error;
  }
}

// Run setup and then test the period opening
async function run() {
  try {
    const accountId = await setupTestData();
    process.exit(0);
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

run(); 