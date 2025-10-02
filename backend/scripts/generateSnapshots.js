/**
 * Script to generate historical snapshots for existing data
 * Run this once to populate the monthly_balance_summaries table
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const monthlySnapshotService = require('../src/services/monthlySnapshotService');

async function generateHistoricalSnapshots() {
    try {
        console.log('🚀 Starting historical snapshot generation...');
        console.log('📊 This will analyze all existing transactions and create monthly snapshots');

        const snapshotsCreated = await monthlySnapshotService.generateHistoricalSnapshots();

        console.log(`✅ Successfully generated ${snapshotsCreated} historical snapshots`);
        console.log('🎯 Monthly reports will now use fast snapshot-based calculations');
        console.log('📸 Future transactions will automatically update snapshots');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error generating historical snapshots:', error);
        process.exit(1);
    }
}

generateHistoricalSnapshots();