/**
 * Simple Monthly Report Controller
 *
 * Provides basic monthly reporting functionality using existing transaction data
 */

const db = require('../models');
const { Op } = require('sequelize');
const immutableTransactionService = require('../services/immutableTransactionService');

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

        // For monthly reports, use the actual transaction amounts without proportional adjustment
        // This ensures accurate cash/bank breakdown regardless of backdated transactions
        return {
            cash: Math.max(0, netCash),
            bank: Math.max(0, netBank)
        };
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

            console.log(`🔄 Simple monthly report request: ${year}-${month} for account ${accountId}`);

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

            // Generate simple report using transaction log
            const monthStart = new Date(yearNum, monthNum - 1, 1);
            const monthEnd = new Date(yearNum, monthNum, 0, 23, 59, 59);

            // Check if this should be a combined all-accounts report
            const allAccounts = req.query.all_accounts === 'true';

            // Get ALL ledger heads (regardless of transactions this month) with account info
            const allLedgerHeadsInSystem = await db.LedgerHead.findAll({
                where: allAccounts ? {} : { account_id: accountIdNum },
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
                whereClause.account_id = accountIdNum;
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
            const monthStartForOpening = new Date(yearNum, monthNum - 1, 1);

            for (const ledgerHeadId of uniqueLedgerHeads) {
                const previousTransactions = await db.TransactionLog.findAll({
                    where: {
                        ledger_head_id: ledgerHeadId,
                        transaction_date: {
                            [Op.lt]: monthStartForOpening
                        },
                        ...(allAccounts ? {} : { account_id: accountIdNum })
                    }
                });

                let openingBalance = 0;
                previousTransactions.forEach(tx => {
                    const amount = parseFloat(tx.amount || 0);
                    if (tx.tx_type === 'credit') {
                        openingBalance += amount;
                    } else {
                        openingBalance -= amount;
                    }
                });

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
                        type: ledgerHead.head_type
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
                        ledgerSummary[ledgerHeadId].cash_amount = (ledgerSummary[ledgerHeadId].cash_amount || 0) + cashAmount;
                        ledgerSummary[ledgerHeadId].bank_amount = (ledgerSummary[ledgerHeadId].bank_amount || 0) + bankAmount;
                        totalCredits += amount;
                    } else {
                        ledgerSummary[ledgerHeadId].total_debits += amount;
                        // FIXED: For debit transactions, track the cash/bank breakdown correctly
                        // This shows what type of payment was used for expenses
                        ledgerSummary[ledgerHeadId].cash_amount = (ledgerSummary[ledgerHeadId].cash_amount || 0) + cashAmount;
                        ledgerSummary[ledgerHeadId].bank_amount = (ledgerSummary[ledgerHeadId].bank_amount || 0) + bankAmount;
                        totalDebits += amount;
                    }

                    ledgerSummary[ledgerHeadId].transaction_count++;
                }
            }

            // Calculate HISTORICAL closing balances and cash/bank breakdown
            // IMPORTANT: Always use transaction log calculation to handle backdated transactions correctly
            const ledgerSummaryPromises = Object.values(ledgerSummary).map(async (summary) => {
                try {
                    if (summary.ledger_head.type === 'credit') {
                        // Check if this is the current month
                        const today = new Date();
                        const currentYear = today.getFullYear();
                        const currentMonth = today.getMonth() + 1;
                        const isCurrentMonth = (yearNum === currentYear && monthNum === currentMonth);

                        if (isCurrentMonth) {
                            // For current month: Use current date (includes all transactions up to today)
                            const currentBalance = await immutableTransactionService.calculateCurrentBalance(
                                summary.account.id,
                                summary.ledger_head.id,
                                today.toISOString().split('T')[0] // Use today's date
                            );

                            // Calculate cash/bank breakdown as of today
                            const currentCashBank = await calculateCashAndBankBalances(
                                summary.account.id,
                                summary.ledger_head.id,
                                today.toISOString().split('T')[0]
                            );

                            summary.closing_balance = currentBalance;
                            summary.cash_amount = currentCashBank.cash;
                            summary.bank_amount = currentCashBank.bank;
                        } else {
                            // For historical months: Show balance as of month-end from transaction log
                            const monthEnd = new Date(yearNum, monthNum, 0); // Last day of selected month
                            const historicalBalance = await immutableTransactionService.calculateCurrentBalance(
                                summary.account.id,
                                summary.ledger_head.id,
                                monthEnd.toISOString().split('T')[0] // Always pass asOfDate for consistency
                            );

                            // Calculate historical cash/bank breakdown as of month-end
                            const historicalCashBank = await calculateCashAndBankBalances(
                                summary.account.id,
                                summary.ledger_head.id,
                                monthEnd.toISOString().split('T')[0]
                            );

                            summary.closing_balance = historicalBalance;
                            summary.cash_amount = historicalCashBank.cash;
                            summary.bank_amount = historicalCashBank.bank;
                        }
                    } else {
                        // For debit heads (expenses): Show the amount spent this month
                        summary.closing_balance = summary.total_debits;
                        summary.current_cash_balance = summary.cash_amount;
                        summary.current_bank_balance = summary.bank_amount;
                    }
                } catch (error) {
                    console.error(`Error calculating real-time balance for ledger head ${summary.ledger_head.id}:`, error);
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
                const account = await db.Account.findByPk(accountIdNum);
                accountDisplayName = account?.name || `Account ${accountIdNum}`;
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
                account_id: allAccounts ? 'ALL' : accountIdNum,
                account_display_name: accountDisplayName,
                year: yearNum,
                month: monthNum,
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

            return res.json({
                success: true,
                data: reportData,
                message: `Monthly report for ${reportData.month_name} generated successfully`
            });

        } catch (error) {
            console.error('❌ Error generating simple monthly report:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate monthly report',
                error: error.message
            });
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
}

module.exports = new SimpleMonthlyReportController();