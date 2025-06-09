#!/usr/bin/env node

/**
 * One-time script to fix open periods for accounts with current month transactions
 * 
 * This script:
 * 1. Finds all accounts with transactions in the current month
 * 2. Ensures those accounts have the current month marked as open
 */
const db = require('../src/models');
const monthlyClosureService = require('../src/services/monthlyClosureService');

async function fixOpenPeriods() {
    try {
        console.log('Fixing open periods for accounts with current month transactions...');

        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // 1-12
        const currentYear = currentDate.getFullYear();
        
        // Calculate first and last day of current month
        const firstDay = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
        
        // Get the last day of the month
        const lastDate = new Date(currentYear, currentMonth, 0);
        const lastDay = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`;
        
        console.log(`Checking for transactions between ${firstDay} and ${lastDay}`);
        
        // Get all accounts
        const accounts = await db.Account.findAll();
        console.log(`Found ${accounts.length} accounts to check`);
        
        // Check each account for transactions in current month
        for (const account of accounts) {
            console.log(`Checking account ID ${account.id}: ${account.name}`);
            
            // Check if account already has an open period
            const existingOpenPeriod = await monthlyClosureService.getOpenPeriodForAccount(account.id);
            if (existingOpenPeriod) {
                console.log(`Account ${account.id} already has period ${existingOpenPeriod.month}/${existingOpenPeriod.year} open. Skipping.`);
                continue;
            }
            
            // Check for transactions in current month
            const transactionsInCurrentMonth = await db.Transaction.findOne({
                where: {
                    account_id: account.id,
                    tx_date: {
                        [db.Sequelize.Op.between]: [firstDay, lastDay]
                    },
                    status: 'completed'
                }
            });
            
            if (transactionsInCurrentMonth) {
                console.log(`Account ${account.id} has transactions in ${currentMonth}/${currentYear}. Setting period as open.`);
                
                try {
                    // Open the current month since the account has transactions in it
                    await monthlyClosureService.openAccountingPeriod(
                        currentMonth,
                        currentYear,
                        account.id
                    );
                    console.log(`Success: Account ID ${account.id} now has ${currentMonth}/${currentYear} open`);
                } catch (error) {
                    console.error(`Error opening period for account ${account.id}:`, error.message);
                }
            } else {
                console.log(`No transactions found in ${currentMonth}/${currentYear} for account ${account.id}`);
            }
        }
        
        console.log('Open period fix completed!');
        process.exit(0);
    } catch (error) {
        console.error('Error fixing open periods:', error);
        process.exit(1);
    }
}

// Run the script
fixOpenPeriods(); 