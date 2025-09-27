/**
 * Simple Monthly Report Controller
 *
 * Provides basic monthly reporting functionality using existing transaction data
 */

const db = require('../models');
const { Op } = require('sequelize');

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
                const openingBalance = ledgerHead.head_type === 'credit' ? (openingBalances[ledgerHeadId] || 0) : 0;

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
                        ledgerSummary[ledgerHeadId].cash_amount = (ledgerSummary[ledgerHeadId].cash_amount || 0) + cashAmount;
                        ledgerSummary[ledgerHeadId].bank_amount = (ledgerSummary[ledgerHeadId].bank_amount || 0) + bankAmount;
                        totalDebits += amount;
                    }

                    ledgerSummary[ledgerHeadId].transaction_count++;
                }
            }

            // Calculate closing balances
            Object.values(ledgerSummary).forEach(summary => {
                if (summary.ledger_head.type === 'credit') {
                    // For credit heads (income): Opening Balance + Credits - Debits
                    summary.closing_balance = summary.opening_balance + summary.total_credits - summary.total_debits;
                } else {
                    // For debit heads (expenses): Only show the amount spent this month
                    summary.closing_balance = summary.total_debits;
                }
            });

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