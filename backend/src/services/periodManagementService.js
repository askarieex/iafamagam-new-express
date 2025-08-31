const db = require('../models');
const { sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Centralized Period Management Service
 * 
 * This service serves as the single source of truth for all accounting period operations.
 * It replaces the fragmented period management logic spread across multiple services.
 * 
 * Key Features:
 * - Single source of truth for period status
 * - Consistent period opening/closing logic
 * - Smart auto-opening that respects manual overrides
 * - Proper validation and error handling
 * - Integration with existing monthly balance system
 */
class PeriodManagementService {

    /**
     * Get the currently open period for an account
     * @param {number} accountId - Account ID
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<Object|null>} Open period or null if none
     */
    async getCurrentOpenPeriod(accountId, transaction = null) {
        try {
            const openPeriod = await db.AccountingPeriod.findOne({
                where: {
                    account_id: accountId,
                    status: 'open'
                },
                include: [{
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                }],
                transaction
            });

            return openPeriod;
        } catch (error) {
            console.error(`Error getting open period for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Get all open periods across all accounts
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<Array>} Array of open periods
     */
    async getAllOpenPeriods(transaction = null) {
        try {
            const openPeriods = await db.AccountingPeriod.findAll({
                where: {
                    status: 'open'
                },
                include: [{
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                }],
                order: [['account_id', 'ASC'], ['year', 'DESC'], ['month', 'DESC']],
                transaction
            });

            return openPeriods;
        } catch (error) {
            console.error('Error getting all open periods:', error);
            throw error;
        }
    }

    /**
     * Check if a date is within an open accounting period
     * When multiple periods are open (via force open), checks all open periods
     * @param {number} accountId - Account ID
     * @param {string|Date} date - Date to check (YYYY-MM-DD or Date object)
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<boolean>} True if date is in any open period
     */
    async isDateInOpenPeriod(accountId, date, transaction = null) {
        try {
            // Get all open periods for this account (handles force-open scenarios)
            const openPeriods = await db.AccountingPeriod.findAll({
                where: {
                    account_id: accountId,
                    status: 'open'
                },
                include: [{
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                }],
                transaction
            });
            
            if (openPeriods.length === 0) {
                return false;
            }

            // Check if date falls within any of the open periods
            return openPeriods.some(period => period.isDateInPeriod(date));
        } catch (error) {
            console.error(`Error checking date ${date} for account ${accountId}:`, error);
            return false;
        }
    }

    /**
     * Get period information for a specific month/year
     * @param {number} accountId - Account ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<Object|null>} Period info or null if not found
     */
    async getPeriod(accountId, month, year, transaction = null) {
        try {
            const period = await db.AccountingPeriod.findOne({
                where: {
                    account_id: accountId,
                    month,
                    year
                },
                include: [{
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                }],
                transaction
            });

            return period;
        } catch (error) {
            console.error(`Error getting period ${month}/${year} for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Validate if a back-period can be opened (only immediate previous month allowed)
     * IMPORTANT: Current month should ALWAYS be allowed to be opened regardless of any other conditions
     * @param {number} accountId - Account ID
     * @param {number} month - Month to validate (1-12)
     * @param {number} year - Year to validate
     * @returns {Promise<Object>} Validation result { allowed, message, validMonth?, validYear? }
     */
    async validateBackPeriodOpening(accountId, month, year) {
        try {
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1; // 1-12
            const currentYear = currentDate.getFullYear();

            // CRITICAL: Current month should ALWAYS be allowed - this is the primary operating period
            if (month === currentMonth && year === currentYear) {
                return {
                    allowed: true,
                    message: 'Current month period opening allowed - primary operating period',
                    isCurrent: true,
                    isAlwaysAllowed: true
                };
            }

            // Calculate the immediate previous month for backdating
            let validMonth, validYear;
            if (currentMonth > 1) {
                validMonth = currentMonth - 1;
                validYear = currentYear;
            } else {
                validMonth = 12; // December of previous year
                validYear = currentYear - 1;
            }

            // Check if requested period is the valid previous month for backdating
            if (month === validMonth && year === validYear) {
                return {
                    allowed: true,
                    message: 'Previous month period opening allowed for backdating',
                    validMonth,
                    validYear,
                    isPrevious: true
                };
            }

            // Check if requested period is in the future
            const requestedDate = new Date(year, month - 1, 1);
            const currentDateStart = new Date(currentYear, currentMonth - 1, 1);
            
            if (requestedDate > currentDateStart) {
                return {
                    allowed: false,
                    message: `Future periods cannot be opened. Period ${month}/${year} is after current period ${currentMonth}/${currentYear}.`,
                    validMonth,
                    validYear
                };
            }

            // Requested period is older than the allowed previous month
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];

            return {
                allowed: false,
                message: `Only the immediate previous month can be opened for backdate transactions. Current month is ${monthNames[currentMonth - 1]} ${currentYear}, so only ${monthNames[validMonth - 1]} ${validYear} can be opened for backdating.`,
                validMonth,
                validYear
            };

        } catch (error) {
            console.error('Error validating back-period opening:', error);
            throw error;
        }
    }

    /**
     * Validate if a period can be closed
     * @param {number} accountId - Account ID  
     * @param {number} month - Month to close (1-12)
     * @param {number} year - Year to close
     * @returns {Promise<Object>} Validation result { allowed, message }
     */
    async validatePeriodClosure(accountId, month, year) {
        try {
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1; // 1-12
            const currentYear = currentDate.getFullYear();

            // Rule A: Cannot close current calendar month until month is over
            if (month === currentMonth && year === currentYear) {
                // Check if we're still in the current month
                const today = new Date();
                const lastDayOfMonth = new Date(year, month, 0); // Last day of the month
                
                if (today <= lastDayOfMonth) {
                    const monthNames = [
                        'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'
                    ];
                    
                    return {
                        allowed: false,
                        message: `Cannot close ${monthNames[month - 1]} ${year} until the month is complete. Wait until ${monthNames[month]} 1, ${year} or later.`
                    };
                }
            }

            // Rule B: Sequential closing - cannot close if newer periods are open
            const newerOpenPeriods = await db.AccountingPeriod.findAll({
                where: {
                    account_id: accountId,
                    status: 'open',
                    [Op.or]: [
                        { year: { [Op.gt]: year } },
                        {
                            year: year,
                            month: { [Op.gt]: month }
                        }
                    ]
                }
            });

            if (newerOpenPeriods.length > 0) {
                const newerPeriodsList = newerOpenPeriods
                    .map(p => `${p.month}/${p.year}`)
                    .sort()
                    .join(', ');

                return {
                    allowed: false,
                    message: `Cannot close period ${month}/${year} while newer periods remain open: ${newerPeriodsList}. Close periods in reverse chronological order.`
                };
            }

            return {
                allowed: true,
                message: 'Period can be closed'
            };

        } catch (error) {
            console.error('Error validating period closure:', error);
            throw error;
        }
    }

    /**
     * Get the valid months that can be opened (current month and immediate previous month)
     * @param {number} accountId - Account ID
     * @returns {Promise<Object>} Valid month info including current and previous months
     */
    async getValidPreviousMonth(accountId) {
        try {
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1; // 1-12
            const currentYear = currentDate.getFullYear();

            // Calculate the immediate previous month
            let validMonth, validYear;
            if (currentMonth > 1) {
                validMonth = currentMonth - 1;
                validYear = currentYear;
            } else {
                validMonth = 12; // December of previous year
                validYear = currentYear - 1;
            }

            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];

            // Check if the previous month period already exists and its status
            const previousPeriod = await this.getPeriod(accountId, validMonth, validYear);
            const canOpenPrevious = !previousPeriod || previousPeriod.status !== 'open';

            // Check current month period status
            const currentPeriod = await this.getPeriod(accountId, currentMonth, currentYear);
            const canOpenCurrent = !currentPeriod || currentPeriod.status !== 'open';

            // Return information about both current and previous months
            return {
                // Current month info (always available)
                currentMonth: {
                    month: currentMonth,
                    year: currentYear,
                    displayName: `${monthNames[currentMonth - 1]} ${currentYear}`,
                    canOpen: canOpenCurrent,
                    isCurrent: true,
                    isAlwaysAllowed: true
                },
                // Previous month info (for backdating)
                validMonth: validMonth,
                validYear: validYear,
                displayName: `${monthNames[validMonth - 1]} ${validYear}`,
                canOpenBack: canOpenPrevious,
                reason: canOpenPrevious ? 
                    `${monthNames[validMonth - 1]} ${validYear} available for backdating` :
                    `${monthNames[validMonth - 1]} ${validYear} is already open or cannot be reopened`
            };

        } catch (error) {
            console.error('Error getting valid previous month:', error);
            throw error;
        }
    }

    /**
     * Open an accounting period
     * @param {number} accountId - Account ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {Object} options - Options for opening
     * @param {number} [options.userId] - User opening the period
     * @param {string} [options.notes] - Notes about opening
     * @param {boolean} [options.isAutoOpened=false] - Whether this is auto-opened
     * @param {boolean} [options.forceOpen=false] - Whether to bypass single-period rule (admin only)
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} Result of opening operation
     */
    async openPeriod(accountId, month, year, options = {}, transaction = null) {
        const useOwnTransaction = !transaction;
        if (!transaction) {
            transaction = await sequelize.transaction();
        }

        try {
            // Validate account exists
            const account = await db.Account.findByPk(accountId, { transaction });
            if (!account) {
                throw new Error(`Account ${accountId} not found`);
            }

            // Validate month/year
            if (month < 1 || month > 12) {
                throw new Error(`Invalid month: ${month}. Must be 1-12`);
            }
            if (year < 2000 || year > 2100) {
                throw new Error(`Invalid year: ${year}. Must be between 2000-2100`);
            }

            // NEW: Validate back-period opening rules (unless bypassed for auto-opening)
            // CRITICAL: Always allow current month regardless of validation
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = currentDate.getFullYear();
            const isCurrentMonth = (month === currentMonth && year === currentYear);
            
            if (!options.isAutoOpened && !isCurrentMonth) {
                const backPeriodValidation = await this.validateBackPeriodOpening(accountId, month, year);
                
                if (!backPeriodValidation.allowed) {
                    if (useOwnTransaction) await transaction.rollback();
                    return {
                        success: false,
                        message: backPeriodValidation.message,
                        validMonth: backPeriodValidation.validMonth,
                        validYear: backPeriodValidation.validYear
                    };
                }
            } else if (isCurrentMonth) {
                console.log(`✅ Allowing current month ${month}/${year} to be opened without validation restrictions`);
            }

            // NEW: Enforce single open period rule - automatically close other open periods
            let closedPeriods = [];
            
            // Find all currently open periods for this account
            const openPeriods = await db.AccountingPeriod.findAll({
                where: {
                    account_id: accountId,
                    status: 'open'
                },
                transaction
            });

            // Close all open periods except the one we're trying to open
            for (const openPeriod of openPeriods) {
                if (!(openPeriod.month === month && openPeriod.year === year)) {
                    await openPeriod.update({
                        status: 'closed',
                        closed_at: new Date(),
                        closed_by: options.userId || null,
                        notes: `Auto-closed when ${month}/${year} was opened`
                    }, { transaction });
                    
                    closedPeriods.push(`${openPeriod.month}/${openPeriod.year}`);
                    console.log(`✅ Auto-closed period ${openPeriod.month}/${openPeriod.year} when opening ${month}/${year}`);
                }
            }

            // Check if period already exists
            let period = await this.getPeriod(accountId, month, year, transaction);
            
            if (period) {
                if (period.status === 'open') {
                    // Period is already open (and no other periods were closed)
                    if (useOwnTransaction) await transaction.commit();
                    return {
                        success: true,
                        message: 'Period is already open',
                        period,
                        wasAlreadyOpen: true,
                        closedPeriods: closedPeriods
                    };
                }

                // Period exists but is closed - reopen it
                await period.update({
                    status: 'open',
                    opened_at: new Date(),
                    opened_by: options.userId || null,
                    notes: options.notes || null,
                    is_auto_opened: options.isAutoOpened || false
                }, { transaction });

            } else {
                // Create new period
                period = await db.AccountingPeriod.create({
                    account_id: accountId,
                    month,
                    year,
                    status: 'open',
                    opened_at: new Date(),
                    opened_by: options.userId || null,
                    notes: options.notes || null,
                    is_auto_opened: options.isAutoOpened || false
                }, { transaction });
            }

            // Ensure monthly ledger balance records exist for all ledger heads
            await this.ensureMonthlyBalanceRecords(accountId, month, year, transaction);

            // Load the complete period data
            await period.reload({
                include: [{
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                }],
                transaction
            });

            if (useOwnTransaction) await transaction.commit();

            // Create appropriate success message
            let message = `Period ${month}/${year} opened successfully`;
            let warning = null;
            
            if (closedPeriods.length > 0) {
                warning = `Automatically closed periods: ${closedPeriods.join(', ')} to maintain single open period rule.`;
                message += ` (Previous periods auto-closed: ${closedPeriods.join(', ')})`;
                console.log(`✅ Period ${month}/${year} opened and auto-closed periods: ${closedPeriods.join(', ')}`);
            } else {
                console.log(`✅ Period ${month}/${year} opened for account ${accountId} (${options.isAutoOpened ? 'auto' : 'manual'})`);
            }

            return {
                success: true,
                message,
                period,
                wasAlreadyOpen: false,
                warning,
                closedPeriods
            };

        } catch (error) {
            if (useOwnTransaction) await transaction.rollback();
            console.error(`Error opening period ${month}/${year} for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Close an accounting period
     * @param {number} accountId - Account ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {Object} options - Options for closing
     * @param {number} [options.userId] - User closing the period
     * @param {string} [options.notes] - Notes about closing
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} Result of closing operation
     */
    async closePeriod(accountId, month, year, options = {}, transaction = null) {
        const useOwnTransaction = !transaction;
        if (!transaction) {
            transaction = await sequelize.transaction();
        }

        try {
            // NEW: Validate period closure rules
            const closureValidation = await this.validatePeriodClosure(accountId, month, year);
            
            if (!closureValidation.allowed) {
                if (useOwnTransaction) await transaction.rollback();
                return {
                    success: false,
                    message: closureValidation.message
                };
            }

            // Find the period
            const period = await this.getPeriod(accountId, month, year, transaction);
            
            if (!period) {
                if (useOwnTransaction) await transaction.rollback();
                return {
                    success: false,
                    message: `Period ${month}/${year} not found for account ${accountId}`
                };
            }

            if (period.status === 'closed') {
                if (useOwnTransaction) await transaction.commit();
                return {
                    success: true,
                    message: 'Period is already closed',
                    period,
                    wasAlreadyClosed: true
                };
            }

            // Update monthly balance is_open flags to false
            await db.MonthlyLedgerBalance.update(
                { is_open: false },
                {
                    where: {
                        account_id: accountId,
                        month,
                        year
                    },
                    transaction
                }
            );

            // Close the period
            await period.update({
                status: 'closed',
                closed_at: new Date(),
                closed_by: options.userId || null,
                notes: options.notes || null
            }, { transaction });

            // Reload with associations
            await period.reload({
                include: [{
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                }],
                transaction
            });

            if (useOwnTransaction) await transaction.commit();

            console.log(`✅ Period ${month}/${year} closed for account ${accountId}`);

            return {
                success: true,
                message: `Period ${month}/${year} closed successfully`,
                period,
                wasAlreadyClosed: false
            };

        } catch (error) {
            if (useOwnTransaction) await transaction.rollback();
            console.error(`Error closing period ${month}/${year} for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Auto-ensure current period is open for an account
     * This is called by the system to ensure there's always an open period for transactions
     * @param {number} accountId - Account ID
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} Result of auto-opening operation
     */
    async autoEnsureCurrentPeriodOpen(accountId, transaction = null) {
        try {
            // Check if any period is already open
            const existingOpenPeriod = await this.getCurrentOpenPeriod(accountId, transaction);
            
            if (existingOpenPeriod) {
                return {
                    success: true,
                    message: 'Period already open',
                    period: existingOpenPeriod,
                    autoOpened: false
                };
            }

            // No period is open, so auto-open the current month
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = currentDate.getFullYear();

            console.log(`Auto-opening current period ${currentMonth}/${currentYear} for account ${accountId}`);

            const result = await this.openPeriod(
                accountId, 
                currentMonth, 
                currentYear,
                {
                    isAutoOpened: true,
                    notes: `Auto-opened by system on ${currentDate.toISOString()}`
                },
                transaction
            );

            return {
                success: result.success,
                message: result.message,
                period: result.period,
                autoOpened: true
            };

        } catch (error) {
            console.error(`Error auto-ensuring period for account ${accountId}:`, error);
            return {
                success: false,
                message: `Failed to auto-open period: ${error.message}`,
                autoOpened: false
            };
        }
    }

    /**
     * Ensure monthly balance records exist for all ledger heads in a period
     * @param {number} accountId - Account ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {Object} [transaction] - Sequelize transaction
     */
    async ensureMonthlyBalanceRecords(accountId, month, year, transaction = null) {
        try {
            // Get all ledger heads for this account
            const ledgerHeads = await db.LedgerHead.findAll({
                where: { account_id: accountId },
                transaction
            });

            for (const ledgerHead of ledgerHeads) {
                // Find or create monthly balance record
                const [monthlyBalance, created] = await db.MonthlyLedgerBalance.findOrCreate({
                    where: {
                        account_id: accountId,
                        ledger_head_id: ledgerHead.id,
                        month,
                        year
                    },
                    defaults: {
                        opening_balance: 0,
                        receipts: 0,
                        payments: 0,
                        closing_balance: 0,
                        cash_in_hand: 0,
                        cash_in_bank: 0,
                        is_open: true
                    },
                    transaction
                });

                if (!created) {
                    // Record exists, ensure it's marked as open
                    await monthlyBalance.update({ is_open: true }, { transaction });
                }
            }

            console.log(`✅ Monthly balance records ensured for ${ledgerHeads.length} ledger heads in ${month}/${year}`);
        } catch (error) {
            console.error(`Error ensuring monthly balance records for ${accountId} ${month}/${year}:`, error);
            throw error;
        }
    }

    /**
     * Get period history for an account
     * @param {number} accountId - Account ID
     * @param {number} [limit=12] - Maximum number of periods to return
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<Array>} Array of periods ordered by date
     */
    async getPeriodHistory(accountId, limit = 12, transaction = null) {
        try {
            const periods = await db.AccountingPeriod.findAll({
                where: {
                    account_id: accountId
                },
                include: [{
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                }],
                order: [['year', 'DESC'], ['month', 'DESC']],
                limit,
                transaction
            });

            return periods;
        } catch (error) {
            console.error(`Error getting period history for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Migrate existing period data from monthly_ledger_balances.is_open to accounting_periods
     * This is used during system upgrade to preserve existing period states
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} Migration results
     */
    async migrateExistingPeriodData(transaction = null) {
        const useOwnTransaction = !transaction;
        if (!transaction) {
            transaction = await sequelize.transaction();
        }

        try {
            console.log('🔄 Starting period data migration...');

            // Find all unique account/month/year combinations where is_open = true
            const openPeriods = await db.MonthlyLedgerBalance.findAll({
                attributes: ['account_id', 'month', 'year'],
                where: {
                    is_open: true
                },
                group: ['account_id', 'month', 'year'],
                raw: true,
                transaction
            });

            console.log(`Found ${openPeriods.length} open periods to migrate`);

            let migratedCount = 0;
            let existingCount = 0;

            for (const period of openPeriods) {
                // Check if accounting period already exists
                const existingPeriod = await db.AccountingPeriod.findOne({
                    where: {
                        account_id: period.account_id,
                        month: period.month,
                        year: period.year
                    },
                    transaction
                });

                if (existingPeriod) {
                    existingCount++;
                    continue;
                }

                // Create new accounting period
                await db.AccountingPeriod.create({
                    account_id: period.account_id,
                    month: period.month,
                    year: period.year,
                    status: 'open',
                    opened_at: new Date(),
                    is_auto_opened: true,
                    notes: 'Migrated from existing monthly_ledger_balances.is_open flag'
                }, { transaction });

                migratedCount++;
            }

            if (useOwnTransaction) await transaction.commit();

            console.log(`✅ Period migration completed: ${migratedCount} migrated, ${existingCount} already existed`);

            return {
                success: true,
                migratedCount,
                existingCount,
                totalFound: openPeriods.length
            };

        } catch (error) {
            if (useOwnTransaction) await transaction.rollback();
            console.error('Error migrating period data:', error);
            throw error;
        }
    }

    /**
     * Validate period consistency across the system
     * Checks for any inconsistencies between accounting_periods and monthly_ledger_balances
     * @param {Object} [transaction] - Sequelize transaction
     * @returns {Promise<Object>} Validation results
     */
    async validatePeriodConsistency(transaction = null) {
        try {
            console.log('🔍 Starting period consistency validation...');

            const inconsistencies = [];

            // Check 1: Ensure all open accounting periods have corresponding open monthly balances
            const openPeriods = await this.getAllOpenPeriods(transaction);
            
            for (const period of openPeriods) {
                const openBalances = await db.MonthlyLedgerBalance.count({
                    where: {
                        account_id: period.account_id,
                        month: period.month,
                        year: period.year,
                        is_open: true
                    },
                    transaction
                });

                if (openBalances === 0) {
                    inconsistencies.push({
                        type: 'missing_open_balances',
                        account_id: period.account_id,
                        month: period.month,
                        year: period.year,
                        description: `Accounting period is open but no monthly balances are marked as open`
                    });
                }
            }

            // Check 2: Ensure no more than one period is open per account
            const accountOpenCounts = await db.AccountingPeriod.findAll({
                attributes: [
                    'account_id',
                    [sequelize.fn('COUNT', sequelize.col('*')), 'open_count']
                ],
                where: {
                    status: 'open'
                },
                group: ['account_id'],
                having: sequelize.where(sequelize.fn('COUNT', sequelize.col('*')), '>', 1),
                transaction
            });

            for (const account of accountOpenCounts) {
                inconsistencies.push({
                    type: 'multiple_open_periods',
                    account_id: account.account_id,
                    description: `Account has ${account.get('open_count')} open periods (should have at most 1)`
                });
            }

            console.log(`✅ Period consistency validation completed: ${inconsistencies.length} issues found`);

            return {
                success: true,
                isConsistent: inconsistencies.length === 0,
                inconsistencies,
                totalChecked: openPeriods.length
            };

        } catch (error) {
            console.error('Error validating period consistency:', error);
            throw error;
        }
    }
}

module.exports = new PeriodManagementService();