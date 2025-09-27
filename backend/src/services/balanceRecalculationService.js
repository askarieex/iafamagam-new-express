/**
 * Balance Recalculation Service
 *
 * This service recalculates all ledger head balances from scratch
 * using the transaction log to ensure accuracy.
 */

const db = require('../models');

class BalanceRecalculationService {

    /**
     * Recalculate all balances for all ledger heads
     */
    async recalculateAllBalances() {
        console.log('🔄 Starting complete balance recalculation...');

        try {
            // Get all ledger heads
            const ledgerHeads = await db.LedgerHead.findAll();

            for (const ledgerHead of ledgerHeads) {
                await this.recalculateLedgerHeadBalance(ledgerHead.id);
            }

            console.log('✅ All balances recalculated successfully');
            return { success: true, message: 'All balances recalculated successfully' };

        } catch (error) {
            console.error('❌ Error recalculating balances:', error);
            throw error;
        }
    }

    /**
     * Recalculate balance for a specific ledger head
     */
    async recalculateLedgerHeadBalance(ledgerHeadId) {
        try {
            console.log(`🔄 Recalculating balance for ledger head ${ledgerHeadId}...`);

            // Get ledger head
            const ledgerHead = await db.LedgerHead.findByPk(ledgerHeadId);
            if (!ledgerHead) {
                throw new Error(`Ledger head not found: ${ledgerHeadId}`);
            }

            // Get all transaction log entries for this ledger head
            const transactions = await db.TransactionLog.findAll({
                where: { ledger_head_id: ledgerHeadId },
                order: [['created_at', 'ASC']]
            });

            // Calculate balance from scratch
            let currentBalance = 0;
            let cashBalance = 0;
            let bankBalance = 0;

            for (const tx of transactions) {
                const amount = parseFloat(tx.amount || 0);
                const cashAmount = parseFloat(tx.cash_amount || 0);
                const bankAmount = parseFloat(tx.bank_amount || 0);

                // Calculate balance change based on transaction type and ledger head type
                let balanceChange = 0;

                if (ledgerHead.head_type === 'credit') {
                    // For credit ledger heads: credit transactions increase balance, debit transactions decrease balance
                    balanceChange = tx.tx_type === 'credit' ? amount : -amount;
                } else if (ledgerHead.head_type === 'debit') {
                    // For debit ledger heads: debit transactions increase balance, credit transactions decrease balance
                    balanceChange = tx.tx_type === 'debit' ? amount : -amount;
                }

                currentBalance += balanceChange;

                // Handle cash/bank breakdown
                if (tx.cash_type === 'cash') {
                    cashBalance += balanceChange;
                } else if (tx.cash_type === 'bank') {
                    bankBalance += balanceChange;
                } else if (tx.cash_type === 'both') {
                    const cashChange = ledgerHead.head_type === 'credit'
                        ? (tx.tx_type === 'credit' ? cashAmount : -cashAmount)
                        : (tx.tx_type === 'debit' ? cashAmount : -cashAmount);

                    const bankChangeAmount = ledgerHead.head_type === 'credit'
                        ? (tx.tx_type === 'credit' ? bankAmount : -bankAmount)
                        : (tx.tx_type === 'debit' ? bankAmount : -bankAmount);

                    cashBalance += cashChange;
                    bankBalance += bankChangeAmount;
                }
            }

            // Update ledger head with recalculated balances
            await ledgerHead.update({
                current_balance: currentBalance,
                cash_balance: cashBalance,
                bank_balance: bankBalance
            });

            console.log(`✅ Ledger head ${ledgerHead.name} balance updated: ₹${currentBalance.toFixed(2)} (Cash: ₹${cashBalance.toFixed(2)}, Bank: ₹${bankBalance.toFixed(2)})`);

            return {
                ledger_head_id: ledgerHeadId,
                ledger_head_name: ledgerHead.name,
                current_balance: currentBalance,
                cash_balance: cashBalance,
                bank_balance: bankBalance,
                transaction_count: transactions.length
            };

        } catch (error) {
            console.error(`❌ Error recalculating balance for ledger head ${ledgerHeadId}:`, error);
            throw error;
        }
    }

    /**
     * Recalculate balances for specific account
     */
    async recalculateAccountBalances(accountId) {
        try {
            console.log(`🔄 Recalculating balances for account ${accountId}...`);

            // Get all ledger heads for this account
            const ledgerHeads = await db.LedgerHead.findAll({
                where: { account_id: accountId }
            });

            const results = [];

            for (const ledgerHead of ledgerHeads) {
                const result = await this.recalculateLedgerHeadBalance(ledgerHead.id);
                results.push(result);
            }

            console.log(`✅ Recalculated ${results.length} ledger heads for account ${accountId}`);
            return { success: true, results };

        } catch (error) {
            console.error(`❌ Error recalculating account ${accountId} balances:`, error);
            throw error;
        }
    }

    /**
     * Validate balances against transaction log
     */
    async validateBalances() {
        try {
            console.log('🔄 Validating all balances against transaction log...');

            const ledgerHeads = await db.LedgerHead.findAll();
            const validationResults = [];

            for (const ledgerHead of ledgerHeads) {
                // Calculate expected balance from transaction log
                const transactions = await db.TransactionLog.findAll({
                    where: { ledger_head_id: ledgerHead.id },
                    order: [['created_at', 'ASC']]
                });

                let expectedBalance = 0;

                for (const tx of transactions) {
                    const amount = parseFloat(tx.amount || 0);
                    let balanceChange = 0;

                    if (ledgerHead.head_type === 'credit') {
                        balanceChange = tx.tx_type === 'credit' ? amount : -amount;
                    } else if (ledgerHead.head_type === 'debit') {
                        balanceChange = tx.tx_type === 'debit' ? amount : -amount;
                    }

                    expectedBalance += balanceChange;
                }

                const actualBalance = parseFloat(ledgerHead.current_balance || 0);
                const isCorrect = Math.abs(expectedBalance - actualBalance) < 0.01; // Allow for rounding

                validationResults.push({
                    ledger_head_id: ledgerHead.id,
                    name: ledgerHead.name,
                    expected_balance: expectedBalance,
                    actual_balance: actualBalance,
                    difference: expectedBalance - actualBalance,
                    is_correct: isCorrect,
                    transaction_count: transactions.length
                });

                if (!isCorrect) {
                    console.log(`❌ Balance mismatch for ${ledgerHead.name}: Expected ₹${expectedBalance.toFixed(2)}, Actual ₹${actualBalance.toFixed(2)}`);
                }
            }

            const incorrectCount = validationResults.filter(r => !r.is_correct).length;
            console.log(`✅ Validation complete: ${incorrectCount} incorrect balances found out of ${validationResults.length}`);

            return {
                success: true,
                total_ledger_heads: validationResults.length,
                incorrect_count: incorrectCount,
                correct_count: validationResults.length - incorrectCount,
                results: validationResults
            };

        } catch (error) {
            console.error('❌ Error validating balances:', error);
            throw error;
        }
    }
}

module.exports = new BalanceRecalculationService();