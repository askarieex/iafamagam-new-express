/**
 * IMMEDIATE FIX FOR JUNE 2025 OPENING BALANCE
 * 
 * This script directly fixes the June 2025 opening balance in the database
 * to ensure it doesn't use July's closing balance incorrectly.
 */

const db = require('./src/models');

async function fixJuneBalance() {
  try {
    console.log('Finding all June 2025 snapshots...');
    // Find all snapshots for June 2025
    const juneSnapshots = await db.MonthlyLedgerBalance.findAll({
      where: {
        month: 6,
        year: 2025
      }
    });

    console.log(`Found ${juneSnapshots.length} snapshots for June 2025`);
    
    for (const june of juneSnapshots) {
      console.log(`\nProcessing June snapshot: account=${june.account_id}, ledger=${june.ledger_head_id}`);
      console.log(`Current opening balance: ${june.opening_balance}`);
      
      // Get the correct opening balance from May 2025
      let correctOpeningBalance = 0;
      
      // Try to find May 2025 for this account/ledger
      const may = await db.MonthlyLedgerBalance.findOne({
        where: {
          account_id: june.account_id,
          ledger_head_id: june.ledger_head_id,
          month: 5,
          year: 2025
        }
      });
      
      if (may) {
        correctOpeningBalance = parseFloat(may.closing_balance || 0);
        console.log(`Found May 2025 with closing balance ${may.closing_balance}`);
      } else {
        console.log('No May 2025 snapshot found, using 0 as opening balance');
      }
      
      // Calculate the correct closing balance
      const correctClosingBalance = correctOpeningBalance + 
        parseFloat(june.receipts || 0) - 
        parseFloat(june.payments || 0);
      
      console.log(`Fixing June: opening ${june.opening_balance} -> ${correctOpeningBalance}`);
      console.log(`Fixing June: closing ${june.closing_balance} -> ${correctClosingBalance}`);
      
      // Update June with correct balances
      await june.update({
        opening_balance: correctOpeningBalance,
        closing_balance: correctClosingBalance
      });
      
      console.log('✅ June 2025 opening balance fixed!');
      
      // Now update July's opening balance to match June's new closing
      const july = await db.MonthlyLedgerBalance.findOne({
        where: {
          account_id: june.account_id,
          ledger_head_id: june.ledger_head_id,
          month: 7,
          year: 2025
        }
      });
      
      if (july) {
        const julyClosingBalance = correctClosingBalance + 
          parseFloat(july.receipts || 0) - 
          parseFloat(july.payments || 0);
        
        console.log(`Updating July: opening ${july.opening_balance} -> ${correctClosingBalance}`);
        console.log(`Updating July: closing ${july.closing_balance} -> ${julyClosingBalance}`);
        
        await july.update({
          opening_balance: correctClosingBalance,
          closing_balance: julyClosingBalance
        });
        
        console.log('✅ July 2025 updated to match June closing!');
      }
    }
    
    console.log('\n✅ ALL JUNE 2025 BALANCES FIXED!');
    return true;
  } catch (error) {
    console.error('Error fixing June balances:', error);
    return false;
  }
}

// Run the fix and close the database connection
fixJuneBalance()
  .then(() => {
    console.log('Done.');
    db.sequelize.close();
  })
  .catch(error => {
    console.error('Fatal error:', error);
    db.sequelize.close();
  }); 