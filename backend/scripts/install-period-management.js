#!/usr/bin/env node

/**
 * Installation script for Period Management System
 * 
 * This script:
 * 1. For each account, initializes the current month as the open period
 * 2. Updates existing monthly ledger balances with proper is_open flags
 */
const db = require('../src/models');
const monthlyClosureService = require('../src/services/monthlyClosureService');

async function initializeOpenPeriodsForAccounts(accounts) {
    console.log('Initializing open periods for accounts...');

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();

    for (const account of accounts) {
        try {
            console.log(`Setting up open period for account ID ${account.id}: ${account.name}`);

            // Check if account already has an open period
            const existingOpenPeriod = await monthlyClosureService.getOpenPeriodForAccount(account.id);
            if (existingOpenPeriod) {
                console.log(`Account ${account.id} already has period ${existingOpenPeriod.month}/${existingOpenPeriod.year} open. Skipping.`);
                continue;
            }

            // Get or create the open period for the current month
            await monthlyClosureService.openAccountingPeriod(currentMonth, currentYear, account.id);

            console.log(`Success: Account ID ${account.id} now has ${currentMonth}/${currentYear} open`);
        } catch (error) {
            console.error(`Error initializing open period for account ${account.id}:`, error.message);
        }
    }
}

async function run() {
    try {
        // 1. Get all accounts
        const { Account } = db;
        const accounts = await Account.findAll();

        console.log(`Found ${accounts.length} accounts`);

        // 2. Initialize open periods for all accounts
        if (accounts.length > 0) {
            await initializeOpenPeriodsForAccounts(accounts);
        } else {
            console.log('No accounts found, skipping period initialization');
        }

        console.log('Period Management System installation completed successfully!');
        console.log('You can now use the system to manage accounting periods.');

        process.exit(0);
    } catch (error) {
        console.error('Error during installation:', error);
        process.exit(1);
    }
}

// Run the installation
run().catch(error => {
    console.error('Unhandled error during installation:', error);
    process.exit(1);
}); 