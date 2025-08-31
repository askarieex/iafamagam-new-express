const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const GlobalPeriod = sequelize.define('GlobalPeriod', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
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
            comment: 'Global period status - affects all accounts simultaneously'
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
                model: 'Users',
                key: 'id'
            },
            comment: 'User who opened this period'
        },
        closed_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'id'
            },
            comment: 'User who closed this period'
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Optional notes about period opening/closing'
        },
        auto_opened: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'True if period was auto-opened by system'
        }
    }, {
        tableName: 'global_periods',
        timestamps: true,
        paranoid: false,
        indexes: [
            {
                unique: true,
                fields: ['month', 'year'],
                name: 'unique_global_period'
            },
            {
                fields: ['status'],
                name: 'idx_global_status'
            },
            {
                fields: ['status', 'month', 'year'],
                name: 'idx_global_status_period'
            }
        ],
        hooks: {
            beforeCreate: async (period, options) => {
                // Auto-set opened_at if status is 'open'
                if (period.status === 'open' && !period.opened_at) {
                    period.opened_at = new Date();
                }
            },
            beforeUpdate: async (period, options) => {
                // Auto-set timestamps based on status changes
                if (period.changed('status')) {
                    if (period.status === 'open' && !period.opened_at) {
                        period.opened_at = new Date();
                        period.closed_at = null;
                    } else if (period.status === 'closed' && !period.closed_at) {
                        period.closed_at = new Date();
                    }
                }
            },
            beforeSave: async (period, options) => {
                // Validation: Only one global period can be open at a time
                if (period.status === 'open') {
                    const existingOpenPeriod = await GlobalPeriod.findOne({
                        where: {
                            status: 'open',
                            id: { [sequelize.Sequelize.Op.ne]: period.id || 0 }
                        },
                        transaction: options.transaction
                    });

                    if (existingOpenPeriod) {
                        throw new Error(`Cannot open period ${period.month}/${period.year}: Period ${existingOpenPeriod.month}/${existingOpenPeriod.year} is already open globally. Only one period can be open at a time.`);
                    }
                }
            }
        }
    });

    // Instance methods
    GlobalPeriod.prototype.getDisplayName = function() {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return `${monthNames[this.month - 1]} ${this.year}`;
    };

    GlobalPeriod.prototype.getDateRange = function() {
        const startDate = new Date(this.year, this.month - 1, 1, 0, 0, 0, 0);
        const endDate = new Date(this.year, this.month, 0, 23, 59, 59, 999);
        
        const startDateUTC = new Date(Date.UTC(this.year, this.month - 1, 1));
        const endDateUTC = new Date(Date.UTC(this.year, this.month, 0));
        
        return {
            start: startDate,
            end: endDate,
            startString: startDateUTC.toISOString().split('T')[0],
            endString: endDateUTC.toISOString().split('T')[0],
            year: this.year,
            month: this.month,
            daysInMonth: endDateUTC.getUTCDate()
        };
    };

    GlobalPeriod.prototype.isDateInPeriod = function(date) {
        let inputDate;
        
        if (typeof date === 'string') {
            if (date.includes('T') || date.includes('Z')) {
                inputDate = new Date(date);
                const utcYear = inputDate.getUTCFullYear();
                const utcMonth = inputDate.getUTCMonth() + 1;
                const utcDay = inputDate.getUTCDate();
                
                if (utcYear !== this.year || utcMonth !== this.month) {
                    return false;
                }
                
                const daysInMonth = new Date(this.year, this.month, 0).getDate();
                return utcDay >= 1 && utcDay <= daysInMonth;
            } else {
                const dateParts = date.split('-');
                if (dateParts.length === 3) {
                    const year = parseInt(dateParts[0]);
                    const month = parseInt(dateParts[1]);
                    const day = parseInt(dateParts[2]);
                    
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
            inputDate = new Date(date);
        }
        
        const inputYear = inputDate.getFullYear();
        const inputMonth = inputDate.getMonth() + 1;
        const inputDay = inputDate.getDate();
        
        if (inputYear !== this.year || inputMonth !== this.month) {
            return false;
        }
        
        const daysInMonth = new Date(this.year, this.month, 0).getDate();
        return inputDay >= 1 && inputDay <= daysInMonth;
    };

    // Class methods
    GlobalPeriod.getCurrentPeriod = function() {
        const now = new Date();
        return {
            month: now.getMonth() + 1,
            year: now.getFullYear()
        };
    };

    GlobalPeriod.getPeriodFromDate = function(date) {
        const dateObj = new Date(date);
        return {
            month: dateObj.getMonth() + 1,
            year: dateObj.getFullYear()
        };
    };

    // Associate with other models
    GlobalPeriod.associate = (models) => {
        // Belongs to Users (for opened_by and closed_by)
        GlobalPeriod.belongsTo(models.User, {
            foreignKey: 'opened_by',
            as: 'openedByUser'
        });

        GlobalPeriod.belongsTo(models.User, {
            foreignKey: 'closed_by',
            as: 'closedByUser'
        });
    };

    return GlobalPeriod;
};