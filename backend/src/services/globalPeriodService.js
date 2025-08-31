const db = require('../models');
const { sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Global Period Management Service
 * 
 * This service manages periods globally across ALL accounts.
 * When a period is opened/closed, it affects the entire system.
 * 
 * Key Features:
 * - Single global period can be open at a time
 * - Opening/closing affects all accounts simultaneously
 * - Proper validation and error handling
 * - Integration with existing monthly balance system
 * - Migration support for existing account-specific periods
 */
class GlobalPeriodService {

    /**
     * Get the currently open global period
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<Object|null>} Open period or null if none
     */
    async getCurrentOpenPeriod(transaction = null) {
        try {
            const openPeriod = await db.GlobalPeriod.findOne({
                where: {
                    status: 'open'
                },
                include: [
                    {
                        model: db.User,
                        as: 'openedByUser',
                        attributes: ['id', 'name', 'email']
                    }
                ],
                transaction
            });

            return openPeriod;
        } catch (error) {
            console.error('Error getting current open global period:', error);
            throw error;
        }
    }

    /**
     * Check if a date is within the open global period
     * @param {string|Date} date - Date to check (YYYY-MM-DD or Date object)
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<boolean>} True if date is in open period
     */
    async isDateInOpenPeriod(date, transaction = null) {
        try {
            const openPeriod = await this.getCurrentOpenPeriod(transaction);
            
            if (!openPeriod) {
                return false;
            }

            return openPeriod.isDateInPeriod(date);
        } catch (error) {
            console.error('Error checking if date is in open period:', error);
            return false;
        }
    }

    /**
     * Open a global period
     * @param {number} month - Month to open (1-12)
     * @param {number} year - Year to open
     * @param {number} userId - User ID opening the period
     * @param {string} [notes] - Optional notes
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} Result object
     */
    async openPeriod(month, year, userId, notes = null, transaction = null) {
        const t = transaction || await sequelize.transaction();
        
        try {
            console.log(`🔓 Opening global period: ${month}/${year} by user ${userId}`);

            // Check if period already exists
            let period = await db.GlobalPeriod.findOne({
                where: { month, year },
                transaction: t
            });

            if (period) {
                if (period.status === 'open') {
                    return {
                        success: false,
                        message: `Period ${month}/${year} is already open`,
                        data: period
                    };
                }

                // Reopen closed period
                await period.update({
                    status: 'open',
                    opened_at: new Date(),
                    opened_by: userId,
                    closed_at: null,
                    closed_by: null,
                    notes: notes || `Reopened on ${new Date().toISOString()}`
                }, { transaction: t });

                console.log(`✅ Reopened global period: ${month}/${year}`);
            } else {
                // Create new period
                period = await db.GlobalPeriod.create({
                    month,
                    year,
                    status: 'open',
                    opened_by: userId,
                    notes: notes || `Opened on ${new Date().toISOString()}`,
                    auto_opened: false
                }, { transaction: t });

                console.log(`✅ Created new global period: ${month}/${year}`);
            }

            // Auto-close any other open periods
            await db.GlobalPeriod.update({
                status: 'closed',
                closed_at: new Date(),
                closed_by: userId,
                notes: 'Auto-closed when new period was opened'
            }, {
                where: {
                    status: 'open',
                    id: { [Op.ne]: period.id }
                },
                transaction: t
            });

            // Sync with account-specific periods (for backward compatibility)
            await this.syncAccountPeriods(month, year, userId, 'open', t);

            if (!transaction) await t.commit();

            return {
                success: true,
                message: `Successfully opened global period: ${month}/${year}`,
                data: period
            };

        } catch (error) {
            if (!transaction) await t.rollback();
            console.error('Error opening global period:', error);
            throw error;
        }
    }

    /**
     * Close the currently open global period
     * @param {number} userId - User ID closing the period
     * @param {string} [notes] - Optional notes
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} Result object
     */
    async closePeriod(userId, notes = null, transaction = null) {
        const t = transaction || await sequelize.transaction();
        
        try {
            console.log(`🔒 Closing current global period by user ${userId}`);

            const openPeriod = await this.getCurrentOpenPeriod(t);
            
            if (!openPeriod) {
                return {
                    success: false,
                    message: 'No open period found to close',
                    data: null
                };
            }

            // Close the period
            await openPeriod.update({
                status: 'closed',
                closed_at: new Date(),
                closed_by: userId,
                notes: notes || `Closed on ${new Date().toISOString()}`
            }, { transaction: t });

            // Sync with account-specific periods (for backward compatibility)
            await this.syncAccountPeriods(
                openPeriod.month, 
                openPeriod.year, 
                userId, 
                'closed', 
                t
            );

            if (!transaction) await t.commit();

            console.log(`✅ Closed global period: ${openPeriod.month}/${openPeriod.year}`);

            return {
                success: true,
                message: `Successfully closed global period: ${openPeriod.month}/${openPeriod.year}`,
                data: openPeriod
            };

        } catch (error) {
            if (!transaction) await t.rollback();
            console.error('Error closing global period:', error);
            throw error;
        }
    }

    /**
     * Get global period status for a specific month/year
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<Object|null>} Period status or null
     */
    async getPeriodStatus(month, year, transaction = null) {
        try {
            const period = await db.GlobalPeriod.findOne({
                where: { month, year },
                include: [
                    {
                        model: db.User,
                        as: 'openedByUser',
                        attributes: ['id', 'name', 'email']
                    },
                    {
                        model: db.User,
                        as: 'closedByUser',
                        attributes: ['id', 'name', 'email']
                    }
                ],
                transaction
            });

            if (!period) {
                return {
                    month,
                    year,
                    status: 'closed',
                    isOpen: false,
                    period: null
                };
            }

            return {
                month,
                year,
                status: period.status,
                isOpen: period.status === 'open',
                period: period
            };

        } catch (error) {
            console.error(`Error getting period status for ${month}/${year}:`, error);
            throw error;
        }
    }

    /**
     * Get year status with all months
     * @param {number} year - Year to check
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} Year status object
     */
    async getYearStatus(year, transaction = null) {
        try {
            const periods = await db.GlobalPeriod.findAll({
                where: { year },
                include: [
                    {
                        model: db.User,
                        as: 'openedByUser',
                        attributes: ['id', 'name', 'email']
                    },
                    {
                        model: db.User,
                        as: 'closedByUser',
                        attributes: ['id', 'name', 'email']
                    }
                ],
                order: [['month', 'ASC']],
                transaction
            });

            const monthsStatus = {};
            
            // Initialize all months as closed
            for (let month = 1; month <= 12; month++) {
                monthsStatus[month] = {
                    month,
                    status: 'closed',
                    isOpen: false,
                    period: null
                };
            }

            // Update with actual period data
            periods.forEach(period => {
                monthsStatus[period.month] = {
                    month: period.month,
                    status: period.status,
                    isOpen: period.status === 'open',
                    period: period
                };
            });

            return {
                year,
                periods: monthsStatus,
                openCount: periods.filter(p => p.status === 'open').length,
                closedCount: periods.filter(p => p.status === 'closed').length
            };

        } catch (error) {
            console.error(`Error getting year status for ${year}:`, error);
            throw error;
        }
    }

    /**
     * Auto-ensure current period is open (system startup)
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} Result object
     */
    async autoEnsureCurrentPeriodOpen(transaction = null) {
        try {
            const openPeriod = await this.getCurrentOpenPeriod(transaction);
            
            if (openPeriod) {
                console.log(`Found existing open period: ${openPeriod.month}/${openPeriod.year}`);
                return {
                    success: true,
                    autoOpened: false,
                    data: openPeriod
                };
            }

            // No open period found, auto-open current month
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();

            console.log(`Auto-opening current period: ${currentMonth}/${currentYear}`);

            const result = await this.openPeriod(
                currentMonth, 
                currentYear, 
                null, // System auto-open
                'Auto-opened current period during system startup',
                transaction
            );

            if (result.success) {
                // Mark as auto-opened
                await result.data.update({
                    auto_opened: true,
                    opened_by: null
                }, { transaction });
            }

            return {
                success: result.success,
                autoOpened: true,
                data: result.data
            };

        } catch (error) {
            console.error('Error auto-ensuring current period open:', error);
            return {
                success: false,
                autoOpened: false,
                error: error.message
            };
        }
    }

    /**
     * Sync global periods with account-specific periods (for backward compatibility)
     * @param {number} month - Month
     * @param {number} year - Year
     * @param {number} userId - User ID
     * @param {string} status - 'open' or 'closed'
     * @param {Object} transaction - Sequelize transaction
     * @returns {Promise<void>}
     */
    async syncAccountPeriods(month, year, userId, status, transaction) {
        try {
            // Get all accounts
            const accounts = await db.Account.findAll({ 
                attributes: ['id'],
                transaction 
            });

            for (const account of accounts) {
                // Check if account-specific period exists
                let accountPeriod = await db.AccountingPeriod.findOne({
                    where: {
                        account_id: account.id,
                        month,
                        year
                    },
                    transaction
                });

                const periodData = {
                    status,
                    [status === 'open' ? 'opened_by' : 'closed_by']: userId,
                    [status === 'open' ? 'opened_at' : 'closed_at']: new Date(),
                    notes: `Synced from global period management`
                };

                if (accountPeriod) {
                    // Update existing
                    await accountPeriod.update(periodData, { 
                        transaction,
                        forceOpen: true // Allow multiple open periods during sync
                    });
                } else {
                    // Create new
                    await db.AccountingPeriod.create({
                        account_id: account.id,
                        month,
                        year,
                        ...periodData,
                        is_auto_opened: userId === null
                    }, { 
                        transaction,
                        forceOpen: true // Allow multiple open periods during sync
                    });
                }

                // If closing, ensure monthly balances are finalized
                if (status === 'closed') {
                    await this.ensureMonthlyBalances(account.id, month, year, transaction);
                }
            }

            console.log(`Synced account periods for ${month}/${year} to ${status}`);

        } catch (error) {
            console.error(`Error syncing account periods for ${month}/${year}:`, error);
            throw error;
        }
    }

    /**
     * Ensure monthly balances exist for a specific account/period
     * @param {number} accountId - Account ID
     * @param {number} month - Month
     * @param {number} year - Year
     * @param {Object} transaction - Sequelize transaction
     * @returns {Promise<void>}
     */
    async ensureMonthlyBalances(accountId, month, year, transaction) {
        try {
            // Check if balances already exist
            const existingBalances = await db.MonthlyLedgerBalance.findAll({
                where: {
                    account_id: accountId,
                    month,
                    year
                },
                transaction
            });

            if (existingBalances.length > 0) {
                console.log(`Monthly balances already exist for account ${accountId}, ${month}/${year}`);
                return;
            }

            // Generate monthly balances
            const balanceService = require('./balanceCalculationService');
            await balanceService.generateMonthlyBalances(accountId, month, year, transaction);

            console.log(`Generated monthly balances for account ${accountId}, ${month}/${year}`);

        } catch (error) {
            console.error(`Error ensuring monthly balances for account ${accountId}, ${month}/${year}:`, error);
            throw error;
        }
    }
}

module.exports = new GlobalPeriodService();