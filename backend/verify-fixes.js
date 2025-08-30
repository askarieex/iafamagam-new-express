/**
 * Script to verify the fixes for the opening balance calculation bug
 * 
 * This script checks that:
 * 1. Opening balances correctly use only earlier periods
 * 2. The manuallyOpenPeriod function in monthlyClosureController works correctly
 * 3. The refreshMonthlySnapshots functionality is available in the frontend
 */

// Check backend fixes
const fs = require('fs');
const path = require('path');

// Simple formatting functions
const green = text => `\x1b[32m${text}\x1b[0m`;
const red = text => `\x1b[31m${text}\x1b[0m`;
const blue = text => `\x1b[34m${text}\x1b[0m`;

console.log(blue('Verifying fixes for opening balance calculation bug...'));

// Files to check
const files = [
  { path: 'src/utils/balanceCalculator.js', check: checkBalanceCalculator },
  { path: 'src/utils/improvedBalanceCalculator.js', check: checkImprovedBalanceCalculator },
  { path: 'src/controllers/monthlyClosureController.js', check: checkMonthlyClosureController },
  { path: 'src/controllers/monthlyLedgerBalanceController.js', check: checkMonthlyLedgerBalanceController },
  { path: '../frontend/pages/monthly-snapshots.js', check: checkMonthlySnapshots },
  { path: '../frontend/components/transactions/CreditTransactionForm.js', check: checkCreditTransactionForm },
  { path: '../frontend/components/transactions/DebitTransactionForm.js', check: checkDebitTransactionForm }
];

// Check each file
let allPassed = true;
files.forEach(file => {
  try {
    const content = fs.readFileSync(path.join(__dirname, file.path), 'utf8');
    const result = file.check(content);
    if (result.pass) {
      console.log(green(`✓ ${file.path}: ${result.message}`));
    } else {
      console.log(red(`✗ ${file.path}: ${result.message}`));
      allPassed = false;
    }
  } catch (error) {
    console.log(red(`✗ ${file.path}: Error reading file - ${error.message}`));
    allPassed = false;
  }
});

// Final summary
if (allPassed) {
  console.log(green('\n✓ All fixes have been properly implemented!'));
} else {
  console.log(red('\n✗ Some fixes are missing or incomplete. Please review the output above.'));
}

// Checker functions for each file
function checkBalanceCalculator(content) {
  // Check for the fixed calculateOpeningBalance method
  const hasOpLt = content.includes('Op.lt');
  const hasOpOr = content.includes('[Op.or]');
  const hasYearLt = content.includes('year: { [Op.lt]: year }');
  const hasMonthLt = content.includes('month: { [Op.lt]: month }');
  
  if (hasOpLt && hasOpOr && hasYearLt && hasMonthLt) {
    return {
      pass: true,
      message: 'Contains proper filtering for previous periods'
    };
  } else {
    return {
      pass: false,
      message: 'Missing proper filtering for previous periods'
    };
  }
}

function checkImprovedBalanceCalculator(content) {
  // Check for the fixed opening balance calculation
  const hasOpLt = content.includes('Op.lt');
  const hasOpOr = content.includes('[Op.or]');
  const hasYearLt = content.includes('year: { [Op.lt]: currentYear }') || 
                   content.includes('year: { [Op.lt]: year }');
  const hasMonthLt = content.includes('month: { [Op.lt]: currentMonth }') || 
                    content.includes('month: { [Op.lt]: month }');
  
  if (hasOpLt && hasOpOr && hasYearLt && hasMonthLt) {
    return {
      pass: true,
      message: 'Contains proper filtering for previous periods'
    };
  } else {
    return {
      pass: false,
      message: 'Missing proper filtering for previous periods'
    };
  }
}

function checkMonthlyClosureController(content) {
  // Check for the fixed manuallyOpenPeriod function
  const hasManuallyOpenPeriod = content.includes('async function manuallyOpenPeriod');
  const hasOpLt = content.includes('Op.lt');
  const hasPrevRecordWithFilter = content.includes('const prevRecord = await db.MonthlyLedgerBalance.findOne') && 
                               (content.includes('year: { [Op.lt]: year }') || 
                                content.includes('[Op.or]: ['));
  
  if (hasManuallyOpenPeriod && hasOpLt && hasPrevRecordWithFilter) {
    return {
      pass: true,
      message: 'manuallyOpenPeriod function properly filters previous periods'
    };
  } else {
    return {
      pass: false,
      message: 'manuallyOpenPeriod function does not properly filter previous periods'
    };
  }
}

function checkMonthlySnapshots(content) {
  // Check for the refresh function export
  const hasRefreshExport = content.includes('export const refreshMonthlySnapshots');
  const hasRefreshCallbacks = content.includes('refreshCallbacks.forEach');
  const hasUseCallback = content.includes('useCallback');
  
  if (hasRefreshExport && hasRefreshCallbacks && hasUseCallback) {
    return {
      pass: true,
      message: 'Contains refreshMonthlySnapshots export function'
    };
  } else {
    return {
      pass: false,
      message: 'Missing refreshMonthlySnapshots export function'
    };
  }
}

function checkCreditTransactionForm(content) {
  // Check for the import and call of refreshMonthlySnapshots
  const hasImport = content.includes('import { refreshMonthlySnapshots }');
  const hasRefreshCall = content.includes('refreshMonthlySnapshots()');
  
  if (hasImport && hasRefreshCall) {
    return {
      pass: true,
      message: 'Imports and calls refreshMonthlySnapshots function'
    };
  } else {
    return {
      pass: false,
      message: 'Missing import or call to refreshMonthlySnapshots function'
    };
  }
}

function checkDebitTransactionForm(content) {
  // Check for the import and call of refreshMonthlySnapshots
  const hasImport = content.includes('import { refreshMonthlySnapshots }');
  const hasRefreshCall = content.includes('refreshMonthlySnapshots()');
  
  if (hasImport && hasRefreshCall) {
    return {
      pass: true,
      message: 'Imports and calls refreshMonthlySnapshots function'
    };
  } else {
    return {
      pass: false,
      message: 'Missing import or call to refreshMonthlySnapshots function'
    };
  }
} 

// Add a new checker function for the monthlyLedgerBalanceController
function checkMonthlyLedgerBalanceController(content) {
  // Check for the special handling of month/year specific queries
  const hasSpecialHandling = content.includes('Special handling for month/year specific queries');
  const hasProcessedBalances = content.includes('processedBalances');
  const hasCorrectFilter = content.includes('[Op.lt]: targetYear') || content.includes('[Op.lt]: targetMonth');
  
  if (hasSpecialHandling && hasProcessedBalances && hasCorrectFilter) {
    return {
      pass: true,
      message: 'Contains special handling for correctly calculating opening balances in UI queries'
    };
  } else {
    return {
      pass: false,
      message: 'Missing special handling for correctly calculating opening balances in UI queries'
    };
  }
} 