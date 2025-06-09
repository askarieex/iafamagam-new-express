const fs = require('fs');
const path = require('path');

console.log('Fixing monthlyClosureController.js...');

// Path to the controller file
const filePath = path.join(__dirname, 'src', 'controllers', 'monthlyClosureController.js');

try {
    // Read the file
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if the file contains syntax errors
    if (content.includes('    }

        console.log(\'Manual period open completed\');
} catch (error) {
    console.error(\'Error in manual period open:\', error);
    throw error;
}
}')) {
// Fix the indentation/syntax error in manuallyOpenPeriod function
content = content.replace(`    }

        console.log('Manual period open completed');
} catch (error) {
    console.error('Error in manual period open:', error);
    throw error;
}
}`, `        }

        console.log('Manual period open completed');
    } catch (error) {
        console.error('Error in manual period open:', error);
        throw error;
    }
}`);

// Save the fixed file
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Successfully fixed the syntax error in manuallyOpenPeriod function');
  } else {
    console.log('The file doesn\'t contain the specific syntax error pattern, or it has already been fixed');
}

// Now update the openAccountingPeriod in monthlyClosureController.js
if (content.includes(`                // Process each ledger head
                for (const ledger of ledgerHeads) {
                    // Check if a record already exists for this month/year/ledger`)) {
    // Update the code to set is_open=true only for the first ledger
    content = content.replace(`                // Process each ledger head
                for (const ledger of ledgerHeads) {
                    // Check if a record already exists for this month/year/ledger`, `                // Process each ledger head
                // We'll use the first ledger head to determine which one gets is_open=true
                let isFirstLedger = true;
                
                for (const ledger of ledgerHeads) {
                    // Only the first ledger gets is_open=true
                    const isOpen = isFirstLedger;
                    
                    // Check if a record already exists for this month/year/ledger`);

    // Replace the UPDATE statement
    content = content.replace(`                        // Update existing record
                        await db.sequelize.query(
                            "UPDATE monthly_ledger_balances SET is_open = true, updated_at = NOW() WHERE id = ?",
                            { replacements: [existingRecord[0].id] }
                        );`, `                        // Update existing record - only set is_open=true for first ledger
                        await db.sequelize.query(
                            "UPDATE monthly_ledger_balances SET is_open = ?, updated_at = NOW() WHERE id = ?",
                            { replacements: [isOpen, existingRecord[0].id] }
                        );`);

    // Replace the INSERT statement
    content = content.replace(`                        // Create new record
                        await db.sequelize.query(
                            \`INSERT INTO monthly_ledger_balances (
                                account_id, 
                                ledger_head_id, 
                                month, 
                                year, 
                                opening_balance, 
                                receipts, 
                                payments, 
                                closing_balance, 
                                cash_in_hand, 
                                cash_in_bank, 
                                is_open, 
                                created_at, 
                                updated_at
                            ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, 0, 0, true, NOW(), NOW())\`,`, `                        // Create new record - only set is_open=true for first ledger
                        await db.sequelize.query(
                            \`INSERT INTO monthly_ledger_balances (
                                account_id, 
                                ledger_head_id, 
                                month, 
                                year, 
                                opening_balance, 
                                receipts, 
                                payments, 
                                closing_balance, 
                                cash_in_hand, 
                                cash_in_bank, 
                                is_open, 
                                created_at, 
                                updated_at
                            ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, 0, 0, ?, NOW(), NOW())\`,`);

    // Replace the replacements array
    content = content.replace(`                                replacements: [
                                    account_id, 
                                    ledger.id, 
                                    month, 
                                    year, 
                                    ledger.current_balance || 0,
                                    ledger.current_balance || 0
                                ]`, `                                replacements: [
                                    account_id, 
                                    ledger.id, 
                                    month, 
                                    year, 
                                    ledger.current_balance || 0,
                                    ledger.current_balance || 0,
                                    isOpen
                                ]`);

    // Add the isFirstLedger = false line after the loop
    content = content.replace(`                    }`, `                    }
                    
                    // After processing the first ledger, set this to false for the rest
                    isFirstLedger = false;`);

    // Save the updated file
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Successfully updated openAccountingPeriod function to prevent unique constraint violations');
} else {
    console.log('Could not find the openAccountingPeriod pattern, or it has already been updated');
}
  
} catch (error) {
    console.error('Error fixing the file:', error);
    process.exit(1);
}

console.log('Done. Please restart your server to apply the changes.'); 