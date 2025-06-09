#!/usr/bin/env node

/**
 * Simple script to manually open the current period (June 2025) for an account
 */
const db = require('../src/models');

async function openCurrentPeriod() {
    try {
        console.log('Opening June 2025 period...');
        
        // First, make sure all periods are closed
        await db.MonthlyLedgerBalance.update(
            { is_open: false },
            { 
                where: { is_open: true }
            }
        );
        console.log('All existing periods closed');
        
        // Get all records for June 2025
        const juneRecords = await db.MonthlyLedgerBalance.findAll({
            where: {
                month: 6,
                year: 2025
            }
        });
        
        console.log(`Found ${juneRecords.length} records for June 2025`);
        
        // Mark them as open
        for (const record of juneRecords) {
            await record.update({ is_open: true });
            console.log(`Opened period for account ${record.account_id}, ledger ${record.ledger_head_id}`);
        }
        
        console.log('June 2025 period opened successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error opening period:', error);
        process.exit(1);
    }
}

// Run the script
openCurrentPeriod(); 