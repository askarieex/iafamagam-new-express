const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const AccountingPeriod = sequelize.define('AccountingPeriod', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        account_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'accounts',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        month: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 12
            },
            comment: 'Month (1-12)'
        },
        year: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 2000,
                max: 2100
            },
            comment: 'Year (e.g., 2025)'
        },
        status: {
            type: DataTypes.ENUM('open', 'closed'),
            allowNull: false,
            defaultValue: 'closed',
            comment: 'Period status - only one period can be open per account at a time'
        },
        opened_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Timestamp when period was opened'
        },
        closed_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Timestamp when period was closed'
        },
        opened_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            },
            comment: 'User who opened this period'
        },
        closed_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            },
            comment: 'User who closed this period'
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Optional notes about period opening/closing'
        },
        is_auto_opened: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'True if period was auto-opened by system, false if manually opened'
        }
    }, {
        tableName: 'accounting_periods',
        timestamps: true,
        paranoid: false, // We don't want soft deletes for period records
        indexes: [
            {
                unique: true,
                fields: ['account_id', 'month', 'year'],
                name: 'unique_account_period'
            },
            {
                fields: ['account_id', 'status'],
                name: 'idx_account_status'
            },
            {
                fields: ['status', 'month', 'year'],
                name: 'idx_status_period'
            }
        ],
        hooks: {
            beforeCreate: async (period, options) => {
                // Auto-set opened_at if status is 'open' and opened_at is not set
                if (period.status === 'open' && !period.opened_at) {
                    period.opened_at = new Date();
                }
            },
            beforeUpdate: async (period, options) => {
                // Auto-set timestamps based on status changes
                if (period.changed('status')) {
                    if (period.status === 'open' && !period.opened_at) {
                        period.opened_at = new Date();
                    } else if (period.status === 'closed' && !period.closed_at) {
                        period.closed_at = new Date();
                    }
                }
            },
            beforeSave: async (period, options) => {
                // Validation: Ensure only one open period per account (unless force open is specified)
                if (period.status === 'open' && !options.forceOpen) {
                    const existingOpenPeriod = await AccountingPeriod.findOne({
                        where: {
                            account_id: period.account_id,
                            status: 'open',
                            id: { [sequelize.Sequelize.Op.ne]: period.id || 0 }
                        },
                        transaction: options.transaction
                    });

                    if (existingOpenPeriod) {
                        throw new Error(`Cannot open period ${period.month}/${period.year} for account ${period.account_id}: Period ${existingOpenPeriod.month}/${existingOpenPeriod.year} is already open. Only one period can be open per account at a time.`);
                    }
                }
            }
        }
    });

    // Instance methods
    AccountingPeriod.prototype.getDisplayName = function() {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return `${monthNames[this.month - 1]} ${this.year}`;
    };

    AccountingPeriod.prototype.getDateRange = function() {
        // Create dates at midnight local time to avoid timezone issues
        const startDate = new Date(this.year, this.month - 1, 1, 0, 0, 0, 0);
        const endDate = new Date(this.year, this.month, 0, 23, 59, 59, 999); // Last millisecond of month
        
        // Also create UTC versions for consistent string representation
        const startDateUTC = new Date(Date.UTC(this.year, this.month - 1, 1));
        const endDateUTC = new Date(Date.UTC(this.year, this.month, 0));
        
        return {
            start: startDate,
            end: endDate,
            startString: startDateUTC.toISOString().split('T')[0],
            endString: endDateUTC.toISOString().split('T')[0],
            // Additional convenience properties
            year: this.year,
            month: this.month,
            daysInMonth: endDateUTC.getUTCDate()
        };
    };

    AccountingPeriod.prototype.isDateInPeriod = function(date) {
        // Use date-only comparison to avoid timezone issues
        let inputDate;
        
        // Handle different input types and normalize to date parts
        if (typeof date === 'string') {
            if (date.includes('T') || date.includes('Z')) {
                // ISO string with time - extract date parts from UTC to avoid timezone shift
                inputDate = new Date(date);
                // Use UTC methods to avoid timezone conversion issues
                const utcYear = inputDate.getUTCFullYear();
                const utcMonth = inputDate.getUTCMonth() + 1;
                const utcDay = inputDate.getUTCDate();
                
                // Check if the UTC date falls within this period's month/year
                if (utcYear !== this.year || utcMonth !== this.month) {
                    return false;
                }
                
                const daysInMonth = new Date(this.year, this.month, 0).getDate();
                return utcDay >= 1 && utcDay <= daysInMonth;
            } else {
                // Simple date string like "2025-07-31" - parse as date-only
                // Handle YYYY-MM-DD format by creating date directly to avoid timezone issues
                const dateParts = date.split('-');
                if (dateParts.length === 3) {
                    const year = parseInt(dateParts[0]);
                    const month = parseInt(dateParts[1]);
                    const day = parseInt(dateParts[2]);
                    
                    // Direct validation without creating Date object
                    if (year !== this.year || month !== this.month) {
                        return false;
                    }
                    
                    const daysInMonth = new Date(this.year, this.month, 0).getDate();
                    return day >= 1 && day <= daysInMonth;
                } else {
                    inputDate = new Date(date);
                }
            }
        } else {
            // Date object or other type
            inputDate = new Date(date);
        }
        
        const inputYear = inputDate.getFullYear();
        const inputMonth = inputDate.getMonth() + 1; // Convert to 1-12
        const inputDay = inputDate.getDate();
        
        // Check if the date falls within this period's month/year
        if (inputYear !== this.year || inputMonth !== this.month) {
            return false;
        }
        
        // Check if the day is valid for this month
        const daysInMonth = new Date(this.year, this.month, 0).getDate();
        return inputDay >= 1 && inputDay <= daysInMonth;
    };

    // Class methods
    AccountingPeriod.getCurrentPeriod = function() {
        const now = new Date();
        return {
            month: now.getMonth() + 1,
            year: now.getFullYear()
        };
    };

    AccountingPeriod.getPeriodFromDate = function(date) {
        const dateObj = new Date(date);
        return {
            month: dateObj.getMonth() + 1,
            year: dateObj.getFullYear()
        };
    };

    // Associate with other models
    AccountingPeriod.associate = (models) => {
        // Belongs to Account
        AccountingPeriod.belongsTo(models.Account, {
            foreignKey: 'account_id',
            as: 'account'
        });

        // Belongs to Users (for opened_by and closed_by)
        AccountingPeriod.belongsTo(models.User, {
            foreignKey: 'opened_by',
            as: 'openedByUser'
        });

        AccountingPeriod.belongsTo(models.User, {
            foreignKey: 'closed_by',
            as: 'closedByUser'
        });

        // Has many monthly ledger balances (for this period)
        AccountingPeriod.hasMany(models.MonthlyLedgerBalance, {
            foreignKey: 'account_id',
            scope: {
                [sequelize.Sequelize.Op.and]: [
                    sequelize.Sequelize.where(
                        sequelize.Sequelize.col('MonthlyLedgerBalance.month'),
                        sequelize.Sequelize.col('AccountingPeriod.month')
                    ),
                    sequelize.Sequelize.where(
                        sequelize.Sequelize.col('MonthlyLedgerBalance.year'),
                        sequelize.Sequelize.col('AccountingPeriod.year')
                    )
                ]
            },
            as: 'monthlyBalances'
        });
    };

    return AccountingPeriod;
};