/**
 * Check how the monthly report is displaying the data
 */

const db = require('./models');

async function checkReportLogic() {
    try {
        console.log('=== CHECKING REPORT LOGIC ===\n');

        const accountId = 25;

        // 1. Check the current snapshots
        console.log('1. Current August 2025 snapshots:');
        const snapshots = await db.MonthlyBalanceSummary.findAll({
            where: {
                account_id: accountId,
                month_year: '2025-08-01'
            },
            include: [{
                model: db.LedgerHead,
                as: 'ledgerHead',
                attributes: ['id', 'name', 'head_type']
            }],
            order: [['ledger_head_id', 'ASC']]
        });

        snapshots.forEach(snap => {
            console.log(`Ledger ${snap.ledger_head_id} (${snap.ledgerHead.name}) - Type: ${snap.ledgerHead.head_type}:`);
            console.log(`   Opening: ₹${snap.opening_balance}`);
            console.log(`   Credits: ₹${snap.total_credits}`);
            console.log(`   Debits: ₹${snap.total_debits}`);
            console.log(`   Closing: ₹${snap.closing_balance}`);
            console.log(`   Expected for ${snap.ledgerHead.head_type}: ${snap.ledgerHead.head_type === 'credit' ? 'Credits - Debits' : 'Debits - Credits'}`);
        });

        // 2. The problem might be that we're treating all ledgers the same way
        // For credit heads: Balance = Credits - Debits (positive balance means money available)
        // For debit heads: Balance = Debits - Credits (positive balance means money spent)

        console.log('\n2. How balances SHOULD be displayed in reports:');
        snapshots.forEach(snap => {
            const correctBalance = snap.ledgerHead.head_type === 'credit'
                ? (snap.total_credits - snap.total_debits)  // For credit heads
                : (snap.total_debits - snap.total_credits); // For debit heads (expenses)

            console.log(`${snap.ledgerHead.name} (${snap.ledgerHead.head_type}):`);
            console.log(`   Current DB Balance: ₹${snap.closing_balance}`);
            console.log(`   Correct Display Balance: ₹${correctBalance}`);
            console.log(`   Match: ${snap.closing_balance === correctBalance ? '✅' : '❌'}`);

            if (snap.ledgerHead.head_type === 'debit' && snap.total_debits > 0) {
                console.log(`   NOTE: This is an expense of ₹${snap.total_debits}, should show as positive expense amount`);
            }
        });

        console.log('\n3. Understanding the original problem:');
        console.log('   User expects: Donation balance to reduce from ₹60 to ₹30 after ₹30 salary payment');
        console.log('   Reality: System recorded ₹30 as expense in Salary ledger (which is correct)');
        console.log('   Solution: Report should show Salary as ₹30 expense, Donation should remain ₹60');

        console.log('\n=== ANALYSIS COMPLETED ===');

    } catch (error) {
        console.error('❌ Error during analysis:', error);
    }
}

// Run the analysis
checkReportLogic().then(() => {
    console.log('\nAnalysis complete. Exiting...');
    process.exit(0);
}).catch(error => {
    console.error('Analysis failed:', error);
    process.exit(1);
});