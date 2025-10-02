/**
 * Simple Monthly Report Controller
 *
 * Provides monthly reporting functionality with proper historical snapshot support.
 * Current month = Real-time calculation, Historical months = Snapshot-based calculation
 */

const db = require('../models');
const { Op } = require('sequelize');
const immutableTransactionService = require('../services/immutableTransactionService');
const monthlySnapshotService = require('../services/monthlySnapshotService');

/**
 * Calculate cash and bank balances from transaction logs
 * IMPORTANT: The cash/bank split represents the composition of the balance
 * proportional to the total balance, either current or historical
 */
async function calculateCashAndBankBalances(accountId, ledgerHeadId, asOfDate = null) {
    try {
        // Get the total balance (current or historical based on asOfDate)
        const totalBalance = await immutableTransactionService.calculateCurrentBalance(
            accountId,
            ledgerHeadId,
            asOfDate
        );

        if (totalBalance <= 0) {
            return { cash: 0, bank: 0 };
        }

        // Get the ledger head to check its type
        const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId);
        if (!ledgerHead) {
            return { cash: 0, bank: 0 };
        }

        const whereCondition = {
            account_id: accountId,
            ledger_head_id: ledgerHeadId
        };

        // If asOfDate is provided, only include transactions up to that date
        if (asOfDate) {
            whereCondition.transaction_date = { [Op.lte]: asOfDate };
        }

        const transactions = await db.TransactionLog.findAll({
            where: whereCondition
        });

        let totalCashInflow = 0;
        let totalBankInflow = 0;
        let totalCashOutflow = 0;
        let totalBankOutflow = 0;

        // Calculate all cash and bank flows
        transactions.forEach(tx => {
            const cashAmount = parseFloat(tx.cash_amount || 0);
            const bankAmount = parseFloat(tx.bank_amount || 0);

            if (tx.tx_type === 'credit') {
                totalCashInflow += cashAmount;
                totalBankInflow += bankAmount;
            } else {
                totalCashOutflow += cashAmount;
                totalBankOutflow += bankAmount;
            }
        });

        // Calculate net cash and bank amounts
        const netCash = totalCashInflow - totalCashOutflow;
        const netBank = totalBankInflow - totalBankOutflow;

        // Simple logic based on ledger head type
        if (ledgerHead.head_type === 'credit') {
            // For credit heads: return net cash/bank amounts (what's available)
            return {
                cash: Math.max(0, netCash),
                bank: Math.max(0, netBank)
            };
        } else {
            // For debit heads: show total amounts spent via each payment method
            return {
                cash: totalCashOutflow,
                bank: totalBankOutflow
            };
        }
    } catch (error) {
        console.error('Error calculating cash and bank balances:', error);
        return { cash: 0, bank: 0 };
    }
}

class SimpleMonthlyReportController {

    /**
     * Generate monthly report for all ledger heads
     * @route GET /api/reports/monthly/:year/:month/:accountId
     */
    async generateMonthlyReport(req, res) {
        try {
            const { year, month, accountId } = req.params;

            console.log(`🔄 Monthly report request: ${year}-${month} for account ${accountId}`);

            // Basic validation
            const yearNum = parseInt(year);
            const monthNum = parseInt(month);
            const accountIdNum = parseInt(accountId);

            if (!yearNum || !monthNum || !accountIdNum) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid parameters'
                });
            }

            // Check if this should be a combined all-accounts report
            const allAccounts = req.query.all_accounts === 'true';

            // STEP 1: Determine if this is current month or historical
            const today = new Date();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth() + 1;
            const isCurrentMonth = (yearNum === currentYear && monthNum === currentMonth);

            console.log(`📊 Report type: ${isCurrentMonth ? 'REAL-TIME (Current Month)' : 'HISTORICAL (Snapshot-based)'}`);

            let reportData;

            if (isCurrentMonth) {
                // CURRENT MONTH: Use real-time calculation
                reportData = await this.generateRealTimeReport(yearNum, monthNum, accountIdNum, allAccounts);
            } else {
                // HISTORICAL MONTH: Use snapshots
                reportData = await this.generateHistoricalReport(yearNum, monthNum, accountIdNum, allAccounts);
            }

            return res.json({
                success: true,
                data: reportData,
                message: `Monthly report for ${reportData.month_name} generated successfully`,
                report_type: isCurrentMonth ? 'real_time' : 'historical_snapshot'
            });

        } catch (error) {
            console.error('❌ Error generating monthly report:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate monthly report',
                error: error.message
            });
        }
    }

    /**
     * Generate real-time report for current month
     */
    async generateRealTimeReport(year, month, accountId, allAccounts) {
        try {
            console.log(`⚡ Generating real-time report for ${year}-${month}`);

            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0, 23, 59, 59);

            // Check if this is the current month
            const currentDate = new Date();
            const isCurrentMonth = (currentDate.getFullYear() === year && (currentDate.getMonth() + 1) === month);

        // Get ALL ledger heads (regardless of transactions this month) with account info
        const allLedgerHeadsInSystem = await db.LedgerHead.findAll({
            where: allAccounts ? {} : { account_id: accountId },
                attributes: ['id', 'name', 'head_type', 'account_id'],
                include: [{
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                }]
            });

            // Get all transactions for this month (either specific account or all accounts)
            const whereClause = {
                transaction_date: {
                    [Op.between]: [monthStart, monthEnd]
                }
            };

            // Only filter by account if not requesting all accounts
            if (!allAccounts) {
                whereClause.account_id = accountId;
            }

            const transactions = await db.TransactionLog.findAll({
                where: whereClause,
                include: [{
                    model: db.LedgerHead,
                    as: 'ledgerHead',
                    attributes: ['id', 'name', 'head_type']
                }],
                order: [['transaction_date', 'ASC']]
            });

            // Get all ledger heads from the system (not just ones with transactions)
            const uniqueLedgerHeads = allLedgerHeadsInSystem.map(lh => lh.id);

            // Calculate opening balance for each ledger head (all transactions before this month)
            const openingBalances = {};
            const monthStartForOpening = new Date(year, month - 1, 1);

            for (const ledgerHead of allLedgerHeadsInSystem) {
                const ledgerHeadId = ledgerHead.id;

                const previousTransactions = await db.TransactionLog.findAll({
                    where: {
                        ledger_head_id: ledgerHeadId,
                        transaction_date: {
                            [Op.lt]: monthStartForOpening
                        },
                        ...(allAccounts ? {} : { account_id: accountId })
                    }
                });

                // CRITICAL FIX: Also get source deductions for this ledger (when used as source for expenses)
                const previousSourceDeductions = await db.TransactionLog.findAll({
                    where: {
                        source_ledger_head_id: ledgerHeadId,
                        tx_type: 'debit',
                        transaction_date: {
                            [Op.lt]: monthStartForOpening
                        },
                        ...(allAccounts ? {} : { account_id: accountId })
                    }
                });

                // Calculate opening balance (NET remaining balance from previous months)
                let openingBalance = 0;

                if (ledgerHead.head_type === 'credit') {
                    // For credit heads: Calculate net remaining balance at start of this month

                    // Get all credits received before this month
                    let totalPreviousCredits = 0;
                    previousTransactions.forEach(tx => {
                        const amount = parseFloat(tx.amount || 0);
                        if (tx.tx_type === 'credit') {
                            totalPreviousCredits += amount;
                        }
                    });

                    // Get all debits spent from this source before this month
                    let totalPreviousDebitsFromSource = 0;
                    previousSourceDeductions.forEach(tx => {
                        const amount = parseFloat(tx.amount || 0);
                        totalPreviousDebitsFromSource += amount;
                    });

                    // Opening balance = Total credits received - Total spent from this source
                    openingBalance = totalPreviousCredits - totalPreviousDebitsFromSource;
                } else {
                    // For debit heads: Opening balance is always 0 (expenses start fresh each month)
                    openingBalance = 0;
                }

                openingBalances[ledgerHeadId] = openingBalance;
            }

            // Initialize ledger summary for ALL ledger heads (including those with no transactions)
            const ledgerSummary = {};
            let totalCredits = 0;
            let totalDebits = 0;
            let totalOpeningBalance = 0;

            // First, create entries for all ledger heads in the system
            for (const ledgerHead of allLedgerHeadsInSystem) {
                const ledgerHeadId = ledgerHead.id;
                // FIXED: Calculate opening balance for BOTH credit and debit heads
                const openingBalance = openingBalances[ledgerHeadId] || 0;

                if (ledgerHead.head_type === 'credit') {
                    totalOpeningBalance += openingBalance;
                }

                ledgerSummary[ledgerHeadId] = {
                    ledger_head: {
                        id: ledgerHead.id,
                        name: ledgerHead.name,
                        type: ledgerHead.head_type,
                        head_type: ledgerHead.head_type  // Add this for backwards compatibility
                    },
                    account: {
                        id: ledgerHead.account_id,
                        name: ledgerHead.account?.name || `Account ${ledgerHead.account_id}`
                    },
                    opening_balance: openingBalance,
                    total_credits: 0,
                    total_debits: 0,
                    closing_balance: 0,
                    cash_amount: 0,
                    bank_amount: 0,
                    transaction_count: 0
                };
            }

            // Now process transactions to add amounts to existing ledger heads
            for (const tx of transactions) {
                const ledgerHeadId = tx.ledger_head_id;
                const amount = parseFloat(tx.amount || 0);
                const cashAmount = parseFloat(tx.cash_amount || 0);
                const bankAmount = parseFloat(tx.bank_amount || 0);

                if (ledgerSummary[ledgerHeadId]) {
                    if (tx.tx_type === 'credit') {
                        ledgerSummary[ledgerHeadId].total_credits += amount;

                        // For credit transactions, ensure cash + bank = total amount
                        const txCash = parseFloat(tx.cash_amount || 0);
                        const txBank = parseFloat(tx.bank_amount || 0);
                        const txTotal = parseFloat(tx.amount || 0);

                        // Validate that cash + bank = total, if not, proportionally distribute
                        if (Math.abs((txCash + txBank) - txTotal) > 0.01) {
                            console.warn(`Transaction ${tx.log_id}: cash(${txCash}) + bank(${txBank}) != total(${txTotal}), fixing...`);
                            // If cash/bank don't add up to total, proportionally distribute
                            const totalCashBank = txCash + txBank;
                            if (totalCashBank > 0) {
                                const cashRatio = txCash / totalCashBank;
                                const bankRatio = txBank / totalCashBank;
                                ledgerSummary[ledgerHeadId].cash_amount += txTotal * cashRatio;
                                ledgerSummary[ledgerHeadId].bank_amount += txTotal * bankRatio;
                            } else {
                                // If both are 0, assume all cash
                                ledgerSummary[ledgerHeadId].cash_amount += txTotal;
                                ledgerSummary[ledgerHeadId].bank_amount += 0;
                            }
                        } else {
                            // Normal case: cash + bank = total
                            ledgerSummary[ledgerHeadId].cash_amount += txCash;
                            ledgerSummary[ledgerHeadId].bank_amount += txBank;
                        }
                        totalCredits += amount;
                    } else {
                        ledgerSummary[ledgerHeadId].total_debits += amount;
                        // For debit transactions, track the cash/bank breakdown correctly
                        // Ensure cash + bank = total amount for consistency
                        const txCash = parseFloat(tx.cash_amount || 0);
                        const txBank = parseFloat(tx.bank_amount || 0);
                        const txTotal = parseFloat(tx.amount || 0);

                        // Validate that cash + bank = total, if not, proportionally distribute
                        if (Math.abs((txCash + txBank) - txTotal) > 0.01) {
                            console.warn(`Transaction ${tx.log_id}: cash(${txCash}) + bank(${txBank}) != total(${txTotal}), fixing...`);
                            // If cash/bank don't add up to total, proportionally distribute
                            const totalCashBank = txCash + txBank;
                            if (totalCashBank > 0) {
                                const cashRatio = txCash / totalCashBank;
                                const bankRatio = txBank / totalCashBank;
                                ledgerSummary[ledgerHeadId].cash_amount += txTotal * cashRatio;
                                ledgerSummary[ledgerHeadId].bank_amount += txTotal * bankRatio;
                            } else {
                                // If both are 0, assume all cash
                                ledgerSummary[ledgerHeadId].cash_amount += txTotal;
                                ledgerSummary[ledgerHeadId].bank_amount += 0;
                            }
                        } else {
                            // Normal case: cash + bank = total
                            ledgerSummary[ledgerHeadId].cash_amount += txCash;
                            ledgerSummary[ledgerHeadId].bank_amount += txBank;
                        }
                        totalDebits += amount;
                    }

                    ledgerSummary[ledgerHeadId].transaction_count++;
                }
            }

            // Calculate MONTH-SPECIFIC closing balances
            // IMPORTANT: Show balance at end of THIS MONTH only, not current balance
            const ledgerSummaryPromises = Object.values(ledgerSummary).map(async (summary) => {
                try {
                    console.log(`\n🔍 PROCESSING LEDGER: ${summary.ledger_head.name}`);
                    console.log(`   ID: ${summary.ledger_head.id}`);
                    console.log(`   Type: '${summary.ledger_head.type}'`);
                    console.log(`   Opening Balance: ₹${summary.opening_balance}`);
                    console.log(`   Total Credits: ₹${summary.total_credits}`);
                    console.log(`   Total Debits: ₹${summary.total_debits}`);

                    if (summary.ledger_head.type === 'credit') {
                        // For credit heads: Calculate net balance at end of this month
                        // This shows remaining balance after all expenses up to month end

                        console.log(`🔄 Processing as CREDIT head`);

                        // For current month: get source debits ONLY within this month
                        // For historical months: get source debits up to month end
                        let sourceDebitsFilter;
                        if (isCurrentMonth) {
                            console.log(`   Looking for source debits WITHIN current month: account=${summary.account.id}, source_ledger=${summary.ledger_head.id}, month=${monthStart.toISOString().split('T')[0]} to ${monthEnd.toISOString().split('T')[0]}`);
                            sourceDebitsFilter = {
                                transaction_date: {
                                    [db.Sequelize.Op.between]: [monthStart, monthEnd]
                                }
                            };
                        } else {
                            console.log(`   Looking for source debits UP TO month end: account=${summary.account.id}, source_ledger=${summary.ledger_head.id}, up to ${monthEnd.toISOString().split('T')[0]}`);
                            sourceDebitsFilter = {
                                transaction_date: {
                                    [db.Sequelize.Op.lte]: monthEnd
                                }
                            };
                        }

                        const sourceDebits = await db.TransactionLog.sum('amount', {
                            where: {
                                account_id: summary.account.id,
                                source_ledger_head_id: summary.ledger_head.id,
                                tx_type: 'debit',
                                ...sourceDebitsFilter
                            }
                        });

                        console.log(`   Raw sourceDebits result: ${sourceDebits}`);

                        const totalSourceDebits = parseFloat(sourceDebits || 0);

                        // Calculate net balance: opening + credits - debits spent from this source
                        summary.closing_balance = summary.opening_balance + summary.total_credits - totalSourceDebits;

                        console.log(`   Source Debits from this ledger: ₹${totalSourceDebits}`);
                        console.log(`   Calculated closing balance: ₹${summary.closing_balance}`);

                        // For cash/bank: Calculate proportional remaining amounts
                        const ledgerHead = await db.LedgerHead.findByPk(summary.ledger_head.id);
                        const currentCashBalance = parseFloat(ledgerHead?.cash_balance || 0);
                        const currentBankBalance = parseFloat(ledgerHead?.bank_balance || 0);

                        // Calculate proportional cash/bank based on closing balance
                        const totalBalance = summary.closing_balance;
                        const totalCurrentBalance = currentCashBalance + currentBankBalance;

                        if (totalCurrentBalance > 0 && totalBalance > 0) {
                            const cashRatio = currentCashBalance / totalCurrentBalance;
                            const bankRatio = currentBankBalance / totalCurrentBalance;
                            summary.cash_amount = totalBalance * cashRatio;
                            summary.bank_amount = totalBalance * bankRatio;
                        } else {
                            summary.cash_amount = 0;
                            summary.bank_amount = 0;
                        }
                    } else {
                        // For debit heads (expenses): Show the amount spent this month
                        console.log(`💰 Processing as DEBIT head`);

                        summary.closing_balance = summary.total_debits;

                        console.log(`   Calculated closing balance: ₹${summary.closing_balance}`);
                        // For expenses, cash_amount and bank_amount represent payment methods used
                        // Keep the accumulated amounts as they represent total spent via each method
                    }
                } catch (error) {
                    console.error(`Error calculating month-specific balance for ledger head ${summary.ledger_head.id}:`, error);
                    // Fallback to historical calculation if real-time fails
                    if (summary.ledger_head.type === 'credit') {
                        summary.closing_balance = summary.opening_balance + summary.total_credits - summary.total_debits;
                    } else {
                        summary.closing_balance = summary.total_debits;
                    }
                    // Keep existing cash/bank amounts for fallback
                }
                return summary;
            });

            // Wait for all balance calculations to complete
            await Promise.all(ledgerSummaryPromises);

            // Get account names for the header
            let accountDisplayName = 'ALL ACCOUNTS COMBINED';
            if (!allAccounts) {
                const account = await db.Account.findByPk(accountId);
                accountDisplayName = account?.name || `Account ${accountId}`;
            }

            // Group ledger heads by account
            const accountGroups = {};
            Object.values(ledgerSummary).forEach(summary => {
                const accountId = summary.account.id;
                if (!accountGroups[accountId]) {
                    accountGroups[accountId] = {
                        account: summary.account,
                        credit_heads: [],
                        debit_heads: []
                    };
                }
                if (summary.ledger_head.type === 'credit') {
                    accountGroups[accountId].credit_heads.push(summary);
                } else {
                    accountGroups[accountId].debit_heads.push(summary);
                }
            });

            const reportData = {
                account_id: allAccounts ? 'ALL' : accountId,
                account_display_name: accountDisplayName,
                year: year,
                month: month,
                month_name: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                ledger_heads: Object.values(ledgerSummary),
                account_groups: Object.values(accountGroups),
                totals: {
                    opening_balance: totalOpeningBalance,
                    total_credits: totalCredits,
                    total_debits: totalDebits,
                    closing_balance: totalOpeningBalance + totalCredits - totalDebits,
                    transaction_count: transactions.length
                },
                credit_heads: Object.values(ledgerSummary).filter(s => s.ledger_head.type === 'credit'),
                debit_heads: Object.values(ledgerSummary).filter(s => s.ledger_head.type === 'debit'),
                all_ledger_types: Object.values(ledgerSummary).map(s => s.ledger_head.type),
                generated_at: new Date(),
                is_combined_report: allAccounts
            };

            return reportData;

        } catch (error) {
            console.error('❌ Error generating real-time monthly report:', error);
            throw error;
        }
    }

    /**
     * Get available months for reporting
     * @route GET /api/reports/available-months/:accountId
     */
    async getAvailableMonths(req, res) {
        try {
            const { accountId } = req.params;
            console.log(`🔄 Available months request for account ${accountId}`);

            const accountIdNum = parseInt(accountId);
            if (!accountIdNum) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid account ID'
                });
            }

            // Get distinct months from transaction log (all accounts)
            const months = await db.TransactionLog.findAll({
                attributes: [
                    [db.Sequelize.fn('DATE_PART', 'year', db.Sequelize.col('transaction_date')), 'year'],
                    [db.Sequelize.fn('DATE_PART', 'month', db.Sequelize.col('transaction_date')), 'month'],
                    [db.Sequelize.fn('COUNT', db.Sequelize.col('log_id')), 'transaction_count']
                ],
                group: [
                    db.Sequelize.fn('DATE_PART', 'year', db.Sequelize.col('transaction_date')),
                    db.Sequelize.fn('DATE_PART', 'month', db.Sequelize.col('transaction_date'))
                ],
                order: [
                    [db.Sequelize.fn('DATE_PART', 'year', db.Sequelize.col('transaction_date')), 'DESC'],
                    [db.Sequelize.fn('DATE_PART', 'month', db.Sequelize.col('transaction_date')), 'DESC']
                ]
            });

            const availableMonths = months.map(m => ({
                year: parseInt(m.dataValues.year),
                month: parseInt(m.dataValues.month),
                month_name: new Date(m.dataValues.year, m.dataValues.month - 1, 1)
                    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                transaction_count: parseInt(m.dataValues.transaction_count)
            }));

            return res.json({
                success: true,
                data: availableMonths,
                message: 'Available months retrieved successfully',
                count: availableMonths.length
            });

        } catch (error) {
            console.error('❌ Error getting available months:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get available months',
                error: error.message
            });
        }
    }

    /**
     * Generate historical report using snapshots
     */
    async generateHistoricalReport(year, month, accountId, allAccounts) {
        console.log(`📊 Generating historical report for ${year}-${month} using snapshots`);

        const monthStart = new Date(year, month - 1, 1);

        // STEP 1: Check if snapshots exist for this month
        const monthYear = `${year}-${month.toString().padStart(2, '0')}-01`;
        const whereClause = { month_year: monthYear };

        if (!allAccounts) {
            whereClause.account_id = accountId;
        }

        const existingSnapshots = await db.MonthlyBalanceSummary.findAll({
            where: whereClause,
            include: [
                {
                    model: db.LedgerHead,
                    as: 'ledgerHead',
                    attributes: ['id', 'name', 'head_type'],
                    include: [{
                        model: db.Account,
                        as: 'account',
                        attributes: ['id', 'name']
                    }]
                }
            ],
            order: [['ledgerHead', 'name', 'ASC']]
        });

        if (existingSnapshots.length === 0) {
            // STEP 2: No snapshots exist - generate them now
            console.log(`🔄 No snapshots found for ${year}-${month}, generating now...`);

            // Get all ledger heads that should have snapshots
            const allLedgerHeads = await db.LedgerHead.findAll({
                where: allAccounts ? {} : { account_id: accountId },
                include: [{
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                }]
            });

            // Generate snapshots for each ledger head
            for (const ledgerHead of allLedgerHeads) {
                await monthlySnapshotService.createMonthlySnapshot(
                    ledgerHead.account_id,
                    ledgerHead.id,
                    year,
                    month
                );
            }

            // Re-fetch the newly created snapshots
            const newSnapshots = await db.MonthlyBalanceSummary.findAll({
                where: whereClause,
                include: [
                    {
                        model: db.LedgerHead,
                        as: 'ledgerHead',
                        attributes: ['id', 'name', 'head_type'],
                        include: [{
                            model: db.Account,
                            as: 'account',
                            attributes: ['id', 'name']
                        }]
                    }
                ],
                order: [['ledgerHead', 'name', 'ASC']]
            });

            return this.buildReportFromSnapshots(newSnapshots, year, month, allAccounts);
        }

        // STEP 3: Use existing snapshots
        console.log(`✅ Using existing snapshots for ${year}-${month} (${existingSnapshots.length} snapshots found)`);
        return this.buildReportFromSnapshots(existingSnapshots, year, month, allAccounts);
    }

    /**
     * Build report from snapshot data
     */
    buildReportFromSnapshots(snapshots, year, month, allAccounts) {
        const monthStart = new Date(year, month - 1, 1);

        const reportData = {
            account_id: allAccounts ? 'ALL' : snapshots[0]?.ledgerHead?.account?.id || 'UNKNOWN',
            account_display_name: allAccounts ? 'ALL ACCOUNTS COMBINED' : snapshots[0]?.ledgerHead?.account?.name || 'Unknown Account',
            year: year,
            month: month,
            month_name: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            ledger_heads: [],
            account_groups: {},
            totals: {
                opening_balance: 0,
                total_credits: 0,
                total_debits: 0,
                closing_balance: 0,
                transaction_count: 0
            },
            credit_heads: [],
            debit_heads: [],
            generated_at: new Date(),
            report_type: 'historical_snapshot',
            is_combined_report: allAccounts
        };

        // Group snapshots by account for display
        const accountGroups = {};

        // Process each snapshot with simplified NET balance calculation
        // For now, use the snapshot closing balance as-is for historical reports
        // TODO: Implement proper NET balance calculation for historical reports
        snapshots.forEach(snapshot => {
            let netClosingBalance = snapshot.closing_balance;

            const ledgerData = {
                ledger_head: {
                    id: snapshot.ledgerHead.id,
                    name: snapshot.ledgerHead.name,
                    type: snapshot.ledgerHead.head_type
                },
                account: {
                    id: snapshot.ledgerHead.account.id,
                    name: snapshot.ledgerHead.account.name
                },
                opening_balance: snapshot.opening_balance,
                total_credits: snapshot.total_credits,
                total_debits: snapshot.total_debits,
                closing_balance: netClosingBalance, // Use NET balance for credit heads
                cash_amount: snapshot.cash_amount || 0,
                bank_amount: snapshot.bank_amount || 0,
                transaction_count: snapshot.transaction_count
            };

            reportData.ledger_heads.push(ledgerData);

            // Group by account
            const accountId = snapshot.ledgerHead.account.id;
            if (!accountGroups[accountId]) {
                accountGroups[accountId] = {
                    account: {
                        id: accountId,
                        name: snapshot.ledgerHead.account.name
                    },
                    credit_heads: [],
                    debit_heads: []
                };
            }

            // Separate into credit and debit heads
            if (snapshot.ledgerHead.head_type === 'credit') {
                reportData.credit_heads.push(ledgerData);
                accountGroups[accountId].credit_heads.push(ledgerData);
            } else {
                reportData.debit_heads.push(ledgerData);
                accountGroups[accountId].debit_heads.push(ledgerData);
            }

            // Update totals
            reportData.totals.opening_balance += parseFloat(snapshot.opening_balance);
            reportData.totals.total_credits += parseFloat(snapshot.total_credits);
            reportData.totals.total_debits += parseFloat(snapshot.total_debits);

            // For totals calculation: only add credit head net balances
            // Debit heads (expenses) are already subtracted in the credit head net calculation
            if (snapshot.ledgerHead.head_type === 'credit') {
                reportData.totals.closing_balance += netClosingBalance; // Net remaining balance
            }
            // Don't subtract debit heads again - they're already accounted for in credit calculations

            reportData.totals.transaction_count += snapshot.transaction_count;
        });

        reportData.account_groups = Object.values(accountGroups);

        console.log(`📊 Historical report built: ${reportData.ledger_heads.length} ledger heads, closing balance: ₹${reportData.totals.closing_balance}`);

        return reportData;
    }
}

module.exports = new SimpleMonthlyReportController();