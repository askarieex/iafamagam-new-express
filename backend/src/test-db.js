const db = require('./models');

async function checkOpenPeriods() {
  try {
    console.log('Checking database for open periods...');
    
    // Find all open periods
    const openPeriods = await db.MonthlyLedgerBalance.findAll({
      where: { is_open: true },
      raw: true
    });
    
    console.log(`Found ${openPeriods.length} open periods:`);
    
    // Group by account ID
    const groupedByAccount = {};
    
    openPeriods.forEach(period => {
      if (!groupedByAccount[period.account_id]) {
        groupedByAccount[period.account_id] = [];
      }
      groupedByAccount[period.account_id].push(period);
    });
    
    // Print results
    Object.keys(groupedByAccount).forEach(accountId => {
      console.log(`\nAccount ${accountId}:`);
      groupedByAccount[accountId].forEach(period => {
        console.log(`  - Month ${period.month}/${period.year} (Ledger Head: ${period.ledger_head_id})`);
      });
    });
    
    if (openPeriods.length === 0) {
      console.log('No open periods found in database');
    }
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    process.exit();
  }
}

// Run the check
checkOpenPeriods(); 