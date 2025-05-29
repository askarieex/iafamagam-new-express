'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // First, modify the ENUM type
        await queryInterface.sequelize.query(`
      -- Create a new ENUM type with the additional value
      CREATE TYPE "enum_transactions_cash_type_new" AS ENUM ('cash', 'bank', 'upi', 'card', 'netbank', 'cheque', 'multiple');
      
      -- Update the column to use the new type
      ALTER TABLE "transactions" 
        ALTER COLUMN "cash_type" TYPE "enum_transactions_cash_type_new" 
        USING "cash_type"::text::"enum_transactions_cash_type_new";
      
      -- Drop the old type
      DROP TYPE "enum_transactions_cash_type";
      
      -- Rename the new type to the old name
      ALTER TYPE "enum_transactions_cash_type_new" RENAME TO "enum_transactions_cash_type";
    `);
    },

    down: async (queryInterface, Sequelize) => {
        // For the down migration, we would revert back by removing 'multiple' from the ENUM
        await queryInterface.sequelize.query(`
      -- Create a new ENUM type without the 'multiple' value
      CREATE TYPE "enum_transactions_cash_type_new" AS ENUM ('cash', 'bank', 'upi', 'card', 'netbank', 'cheque');
      
      -- Update the column to use the new type (with potential data loss if 'multiple' is used)
      ALTER TABLE "transactions" 
        ALTER COLUMN "cash_type" TYPE "enum_transactions_cash_type_new" 
        USING CASE 
          WHEN "cash_type" = 'multiple'::text THEN 'bank'::text 
          ELSE "cash_type"::text 
        END::"enum_transactions_cash_type_new";
      
      -- Drop the old type
      DROP TYPE "enum_transactions_cash_type";
      
      -- Rename the new type to the old name
      ALTER TYPE "enum_transactions_cash_type_new" RENAME TO "enum_transactions_cash_type";
    `);
    }
}; 