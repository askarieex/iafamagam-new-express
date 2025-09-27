/**
 * MonthlyBalanceSummary Model
 *
 * Represents monthly balance summaries for ledger heads, storing opening and closing
 * balances to enable efficient historical reporting and balance continuity tracking.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const MonthlyBalanceSummary = sequelize.define('MonthlyBalanceSummary', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        ledger_head_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'ledger_heads',
                key: 'id'
            },
            validate: {
                notNull: {
                    msg: 'Ledger head ID is required'
                },
                isInt: {
                    msg: 'Ledger head ID must be an integer'
                }
            }
        },
        account_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'accounts',
                key: 'id'
            },
            validate: {
                notNull: {
                    msg: 'Account ID is required'
                },
                isInt: {
                    msg: 'Account ID must be an integer'
                }
            }
        },
        month_year: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            validate: {
                notNull: {
                    msg: 'Month year is required'
                },
                isDate: {
                    msg: 'Month year must be a valid date'
                }
            },
            comment: 'First day of the month (e.g., 2024-04-01 for April 2024)'
        },
        opening_balance: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            validate: {
                isDecimal: {
                    msg: 'Opening balance must be a valid decimal number'
                }
            },
            get() {
                const value = this.getDataValue('opening_balance');
                return value ? parseFloat(value) : 0;
            }
        },
        closing_balance: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            validate: {
                isDecimal: {
                    msg: 'Closing balance must be a valid decimal number'
                }
            },
            get() {
                const value = this.getDataValue('closing_balance');
                return value ? parseFloat(value) : 0;
            }
        },
        total_credits: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            validate: {
                isDecimal: {
                    msg: 'Total credits must be a valid decimal number'
                },
                min: {
                    args: [0],
                    msg: 'Total credits cannot be negative'
                }
            },
            get() {
                const value = this.getDataValue('total_credits');
                return value ? parseFloat(value) : 0;
            }
        },
        total_debits: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            validate: {
                isDecimal: {
                    msg: 'Total debits must be a valid decimal number'
                },
                min: {
                    args: [0],
                    msg: 'Total debits cannot be negative'
                }
            },
            get() {
                const value = this.getDataValue('total_debits');
                return value ? parseFloat(value) : 0;
            }
        },
        cash_amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            validate: {
                isDecimal: {
                    msg: 'Cash amount must be a valid decimal number'
                },
                min: {
                    args: [0],
                    msg: 'Cash amount cannot be negative'
                }
            },
            get() {
                const value = this.getDataValue('cash_amount');
                return value ? parseFloat(value) : 0;
            }
        },
        bank_amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            validate: {
                isDecimal: {
                    msg: 'Bank amount must be a valid decimal number'
                },
                min: {
                    args: [0],
                    msg: 'Bank amount cannot be negative'
                }
            },
            get() {
                const value = this.getDataValue('bank_amount');
                return value ? parseFloat(value) : 0;
            }
        },
        transaction_count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: {
                isInt: {
                    msg: 'Transaction count must be an integer'
                },
                min: {
                    args: [0],
                    msg: 'Transaction count cannot be negative'
                }
            }
        },
        is_finalized: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        last_calculated_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'monthly_balance_summaries',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['ledger_head_id', 'account_id', 'month_year'],
                name: 'unique_monthly_balance_summary'
            },
            {
                fields: ['account_id', 'month_year'],
                name: 'idx_account_month'
            },
            {
                fields: ['ledger_head_id'],
                name: 'idx_ledger_head'
            },
            {
                fields: ['is_finalized'],
                name: 'idx_finalized_status'
            }
        ]
    });

    // Instance methods
    MonthlyBalanceSummary.prototype.calculateNetChange = function() {
        return this.total_credits - this.total_debits;
    };

    MonthlyBalanceSummary.prototype.isBalanceValid = function() {
        const calculatedClosing = this.opening_balance + this.total_credits - this.total_debits;
        return Math.abs(calculatedClosing - this.closing_balance) < 0.01; // Allow for rounding differences
    };

    MonthlyBalanceSummary.prototype.getMonthName = function() {
        const date = new Date(this.month_year);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    MonthlyBalanceSummary.prototype.finalize = function() {
        this.is_finalized = true;
        this.last_calculated_at = new Date();
        return this.save();
    };

    // Class methods
    MonthlyBalanceSummary.findByMonth = function(year, month, accountId = null) {
        const monthYear = `${year}-${month.toString().padStart(2, '0')}-01`;
        const where = { month_year: monthYear };

        if (accountId) {
            where.account_id = accountId;
        }

        return this.findAll({
            where,
            include: [
                {
                    model: sequelize.models.LedgerHead,
                    as: 'ledgerHead',
                    attributes: ['id', 'name', 'type', 'display_name']
                },
                {
                    model: sequelize.models.Account,
                    as: 'account',
                    attributes: ['id', 'name']
                }
            ],
            order: [['ledgerHead', 'name', 'ASC']]
        });
    };

    MonthlyBalanceSummary.findByLedgerHead = function(ledgerHeadId, accountId, startDate, endDate) {
        const where = {
            ledger_head_id: ledgerHeadId,
            account_id: accountId,
            month_year: {
                [sequelize.Sequelize.Op.between]: [startDate, endDate]
            }
        };

        return this.findAll({
            where,
            order: [['month_year', 'ASC']]
        });
    };

    // Define associations
    MonthlyBalanceSummary.associate = function(models) {
        // MonthlyBalanceSummary belongs to LedgerHead
        MonthlyBalanceSummary.belongsTo(models.LedgerHead, {
            foreignKey: 'ledger_head_id',
            as: 'ledgerHead'
        });

        // MonthlyBalanceSummary belongs to Account
        MonthlyBalanceSummary.belongsTo(models.Account, {
            foreignKey: 'account_id',
            as: 'account'
        });
    };

    return MonthlyBalanceSummary;
};