-- Drop the existing table
DROP TABLE IF EXISTS cheques;

-- Create the ENUM type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_cheques_status') THEN
        CREATE TYPE enum_cheques_status AS ENUM ('pending', 'cleared', 'cancelled');
    END IF;
END$$;

-- Create the cheques table with all required columns
CREATE TABLE cheques (
    id SERIAL PRIMARY KEY,
    tx_id UUID NOT NULL,
    account_id INTEGER NOT NULL,
    ledger_head_id INTEGER NOT NULL,
    cheque_number VARCHAR(255) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status enum_cheques_status NOT NULL DEFAULT 'pending',
    clearing_date DATE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraints
ALTER TABLE cheques ADD CONSTRAINT cheques_tx_id_fkey 
    FOREIGN KEY (tx_id) REFERENCES transactions(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE cheques ADD CONSTRAINT cheques_account_id_fkey 
    FOREIGN KEY (account_id) REFERENCES accounts(id);

ALTER TABLE cheques ADD CONSTRAINT cheques_ledger_head_id_fkey 
    FOREIGN KEY (ledger_head_id) REFERENCES ledger_heads(id);

-- Add index on tx_id for faster lookups
CREATE INDEX idx_cheques_tx_id ON cheques(tx_id); 