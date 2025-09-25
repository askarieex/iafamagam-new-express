'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. CREATE IMMUTABLE TRANSACTION LOG TABLE
    await queryInterface.createTable('transaction_log', {
      log_id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },

      // Transaction Identity
      transaction_uuid: {
        type: Sequelize.UUID,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4
      },
      log_sequence: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },

      // Action Types for Immutable System
      action_type: {
        type: Sequelize.ENUM(
          'CREATE',           // New transaction
          'CORRECT_AMOUNT',   // Amount correction
          'CORRECT_DATE',     // Date correction
          'REVERSE',          // Complete reversal
          'VOID'             // Mark as void
        ),
        allowNull: false,
        defaultValue: 'CREATE'
      },

      // Transaction Data (Immutable)
      account_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'accounts',
          key: 'id'
        }
      },
      ledger_head_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ledger_heads',
          key: 'id'
        }
      },

      // Amount Information
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      cash_amount: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      bank_amount: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },

      // Transaction Type
      tx_type: {
        type: Sequelize.ENUM('credit', 'debit'),
        allowNull: false
      },
      cash_type: {
        type: Sequelize.STRING(20),
        allowNull: false
      },

      // Enhanced Dating System
      transaction_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      transaction_time: {
        type: Sequelize.TIME,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      date_override_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      // Descriptions
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      correction_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      // Reference System for Corrections
      reference_log_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'transaction_log',
          key: 'log_id'
        }
      },
      original_log_id: {
        type: Sequelize.BIGINT,
        allowNull: true
      },

      // Audit Trail (NEVER change these)
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      client_ip: {
        type: Sequelize.INET,
        allowNull: false
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      session_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },

      // Cryptographic Security
      previous_hash: {
        type: Sequelize.STRING(64),
        allowNull: true
      },
      current_hash: {
        type: Sequelize.STRING(64),
        allowNull: false
      },
      daily_hash: {
        type: Sequelize.STRING(64),
        allowNull: true
      },

      // Approval System
      requires_approval: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      approval_level: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      approved_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      approval_notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      // System Validation
      system_validated: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      validation_errors: {
        type: Sequelize.JSONB,
        allowNull: true
      },

      // Additional Fields
      booklet_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'booklets',
          key: 'id'
        }
      },
      donor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'donors',
          key: 'id'
        }
      }
    });

    // 2. CREATE CORRECTION APPROVAL WORKFLOW TABLE
    await queryInterface.createTable('correction_approvals', {
      approval_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },

      // Request Information
      original_log_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'transaction_log',
          key: 'log_id'
        }
      },
      requested_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      request_date: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      },

      // Correction Details
      correction_type: {
        type: Sequelize.ENUM('AMOUNT', 'DATE', 'REVERSAL', 'VOID'),
        allowNull: false
      },
      original_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      corrected_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      correction_reason: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      business_justification: {
        type: Sequelize.TEXT,
        allowNull: false
      },

      // Impact Analysis
      affected_accounts: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      balance_impact: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      overdraft_risk: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },

      // Approval Status
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'expired'),
        defaultValue: 'pending'
      },
      reviewed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      review_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      review_notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      // Execution
      correction_log_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'transaction_log',
          key: 'log_id'
        }
      },
      executed_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // 3. CREATE DAILY CLOSURE LOG TABLE
    await queryInterface.createTable('daily_closure_log', {
      closure_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      closure_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        unique: true
      },

      // Daily Statistics
      total_transactions_count: {
        type: Sequelize.BIGINT,
        allowNull: false
      },
      total_debit_amount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false
      },
      total_credit_amount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false
      },

      // Cryptographic Protection
      transactions_hash: {
        type: Sequelize.STRING(64),
        allowNull: false
      },
      balances_hash: {
        type: Sequelize.STRING(64),
        allowNull: false
      },
      previous_closure_hash: {
        type: Sequelize.STRING(64),
        allowNull: true
      },
      closure_hash: {
        type: Sequelize.STRING(64),
        allowNull: false
      },

      // Integrity Verification
      hash_chain_valid: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      balance_reconciled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },

      // Closure Information
      sealed_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      },
      sealed_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      }
    });

    // 4. CREATE BALANCE SNAPSHOTS TABLE
    await queryInterface.createTable('balance_snapshots', {
      snapshot_id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true
      },
      snapshot_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      account_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'accounts',
          key: 'id'
        }
      },
      ledger_head_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ledger_heads',
          key: 'id'
        }
      },

      // Balance Information
      opening_balance: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      closing_balance: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      cash_balance: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      bank_balance: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },

      // Daily Activity
      total_debits: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      total_credits: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      transaction_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },

      // Cryptographic Verification
      calculation_hash: {
        type: Sequelize.STRING(64),
        allowNull: false
      },
      source_transactions_hash: {
        type: Sequelize.STRING(64),
        allowNull: false
      },

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // 5. CREATE INDEXES FOR PERFORMANCE
    await queryInterface.addIndex('transaction_log', ['account_id', 'transaction_date'], {
      name: 'idx_tx_log_account_date'
    });

    await queryInterface.addIndex('transaction_log', ['ledger_head_id', 'transaction_date'], {
      name: 'idx_tx_log_ledger_date'
    });

    await queryInterface.addIndex('transaction_log', ['transaction_uuid'], {
      name: 'idx_tx_log_uuid'
    });

    await queryInterface.addIndex('transaction_log', ['current_hash'], {
      name: 'idx_tx_log_hash'
    });

    await queryInterface.addIndex('transaction_log', ['requires_approval'], {
      name: 'idx_tx_log_approval',
      where: {
        requires_approval: true,
        approved_by: null
      }
    });

    await queryInterface.addIndex('balance_snapshots', ['account_id', 'ledger_head_id', 'snapshot_date'], {
      name: 'idx_balance_account_ledger_date',
      unique: true
    });

    // 6. ADD CONSTRAINTS TO PREVENT MODIFICATIONS
    await queryInterface.addConstraint('transaction_log', {
      fields: ['transaction_uuid', 'log_sequence'],
      type: 'unique',
      name: 'unique_tx_sequence'
    });

    await queryInterface.addConstraint('transaction_log', {
      fields: ['amount'],
      type: 'check',
      name: 'positive_amount',
      where: {
        amount: {
          [Sequelize.Op.gt]: 0
        }
      }
    });

    console.log('✅ Log-based system tables created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Drop tables in reverse order due to foreign key constraints
    await queryInterface.dropTable('balance_snapshots');
    await queryInterface.dropTable('daily_closure_log');
    await queryInterface.dropTable('correction_approvals');
    await queryInterface.dropTable('transaction_log');

    console.log('❌ Log-based system tables dropped');
  }
};