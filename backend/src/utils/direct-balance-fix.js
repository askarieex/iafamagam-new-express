/**
 * Direct Fix for Opening Balance Calculation Issue
 * 
 * This is a minimal patch that ensures when reopening any month,
 * the system ONLY considers earlier months for the opening balance,
 * never future months.
 */
const db = require('../models');
const { Op } = require('sequelize');

/**
 * Get the correct opening balance for a month/year
 * ONLY looking at earlier periods (months before the target)
 */
async function getCorrectOpeningBalance(accountId, ledgerHeadId, month, year) {
  console.log(`Getting correct opening balance for ${month}/${year}`);
  
  // This is the key query - only find snapshots from EARLIER months
  const prevSnapshot = await db.MonthlyLedgerBalance.findOne({
    where: {
      account_id: accountId,
      ledger_head_id: ledgerHeadId,
      [Op.or]: [
        { year: { [Op.lt]: year } },             // Any months in earlier years
        { year, month: { [Op.lt]: month } }      // Earlier months same year
      ]
    },
    order: [['year', 'DESC'], ['month', 'DESC']], // Get most recent earlier month
  });
  
  if (prevSnapshot) {
    console.log(`Found prior month ${prevSnapshot.month}/${prevSnapshot.year} with closing ${prevSnapshot.closing_balance}`);
    return parseFloat(prevSnapshot.closing_balance);
  }
  
  // If no prior snapshots found, this is the first month - start with 0
  console.log('No prior months found, using 0 as opening balance');
  return 0;
}

/**
 * Fix a specific month's opening balance
 */
async function fixMonthOpeningBalance(accountId, ledgerHeadId, month, year) {
  try {
    // Get the correct opening balance (only from earlier months)
    const correctOpeningBalance = await getCorrectOpeningBalance(accountId, ledgerHeadId, month, year);
    
    // Find the month's snapshot
    const snapshot = await db.MonthlyLedgerBalance.findOne({
      where: {
        account_id: accountId,
        ledger_head_id: ledgerHeadId,
        month,
        year
      }
    });
    
    if (!snapshot) {
      console.log(`No snapshot found for ${month}/${year}`);
      return false;
    }
    
    // Calculate the correct closing balance based on activity
    const correctClosingBalance = correctOpeningBalance + 
                                 parseFloat(snapshot.receipts || 0) - 
                                 parseFloat(snapshot.payments || 0);
    
    // Update the snapshot with correct balances
    await snapshot.update({
      opening_balance: correctOpeningBalance,
      closing_balance: correctClosingBalance
    });
    
    console.log(`Updated ${month}/${year}: opening=${correctOpeningBalance}, closing=${correctClosingBalance}`);
    return true;
  } catch (error) {
    console.error(`Error fixing ${month}/${year}:`, error);
    return false;
  }
}

/**
 * Fix all months after the specified starting point
 */
async function fixBalancesForward(accountId, ledgerHeadId, startMonth, startYear) {
  // Get all months from the start month onward, ordered chronologically
  const snapshots = await db.MonthlyLedgerBalance.findAll({
    where: {
      account_id: accountId,
      ledger_head_id: ledgerHeadId,
      [Op.or]: [
        { year: { [Op.gt]: startYear } },                      // All future years
        { year: startYear, month: { [Op.gte]: startMonth } }   // Same year, this month and forward
      ]
    },
    order: [['year', 'ASC'], ['month', 'ASC']]  // Process in chronological order
  });
  
  let prevClosing = null;
  
  // Process each month in sequence, carrying balances forward
  for (const snapshot of snapshots) {
    const month = snapshot.month;
    const year = snapshot.year;
    
    console.log(`Processing ${month}/${year}`);
    
    let openingBalance;
    if (month === startMonth && year === startYear) {
      // For the first month, get opening from earlier periods
      openingBalance = await getCorrectOpeningBalance(accountId, ledgerHeadId, month, year);
    } else if (prevClosing !== null) {
      // For subsequent months, use previous month's closing
      openingBalance = prevClosing;
    } else {
      // Should not happen with our query ordering, but just in case
      openingBalance = await getCorrectOpeningBalance(accountId, ledgerHeadId, month, year);
    }
    
    // Calculate closing balance
    const closingBalance = openingBalance + 
                          parseFloat(snapshot.receipts || 0) - 
                          parseFloat(snapshot.payments || 0);
    
    // Update the snapshot
    await snapshot.update({
      opening_balance: openingBalance,
      closing_balance: closingBalance
    });
    
    console.log(`Updated ${month}/${year}: opening=${openingBalance}, closing=${closingBalance}`);
    
    // Remember this month's closing for next month's opening
    prevClosing = closingBalance;
  }
  
  return snapshots.length > 0;
}

/**
 * Add the corrected version of the function to the BalanceCalculator
 */
function patchBalanceCalculator() {
  const BalanceCalculator = require('./balanceCalculator');
  
  // Override the calculateOpeningBalance method with our fixed version
  BalanceCalculator.calculateOpeningBalance = async function(ledgerHeadId, accountId, month, year, transaction = null) {
    console.log(`[PATCHED] Calculating opening balance for ${month}/${year}`);
    
    // Only look at periods BEFORE the target month
    const prevMonthBalance = await db.MonthlyLedgerBalance.findOne({
      where: {
        ledger_head_id: ledgerHeadId,
        account_id: accountId,
        [Op.or]: [
          { year: { [Op.lt]: year } },                // Earlier years
          { year, month: { [Op.lt]: month } }         // Earlier months same year
        ]
      },
      order: [['year', 'DESC'], ['month', 'DESC']],   // Most recent earlier month
      transaction
    });
    
    if (prevMonthBalance) {
      console.log(`Found previous period ${prevMonthBalance.month}/${prevMonthBalance.year} with closing balance ${prevMonthBalance.closing_balance}`);
      return parseFloat(prevMonthBalance.closing_balance);
    }
    
    console.log(`No previous periods found, calculating from historical transactions`);
    // No previous period, use 0 or calculate from transactions before this month
    if (this.calculateBalanceFromTransactions) {
      return await this.calculateBalanceFromTransactions(
        ledgerHeadId,
        accountId,
        null,  // From beginning of time
        new Date(year, month - 1, 1),  // Up to first day of target month
        transaction
      );
    } else {
      return 0;  // Safe fallback if method not available
    }
  };
  
  console.log('Balance calculator patched with correct opening balance calculation');
}

module.exports = {
  getCorrectOpeningBalance,
  fixMonthOpeningBalance,
  fixBalancesForward,
  patchBalanceCalculator
}; 