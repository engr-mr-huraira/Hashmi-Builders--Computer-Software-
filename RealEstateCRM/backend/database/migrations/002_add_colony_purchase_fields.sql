-- Migration: Add purchase tracking fields to existing colonies table
-- Run this against an existing database that already has the 001_initial_schema applied.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'colonies' AND column_name = 'purchase_from'
    ) THEN
        ALTER TABLE colonies ADD COLUMN purchase_from VARCHAR(150);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'colonies' AND column_name = 'purchase_amount'
    ) THEN
        ALTER TABLE colonies ADD COLUMN purchase_amount DECIMAL(15, 2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'colonies' AND column_name = 'advance_paid'
    ) THEN
        ALTER TABLE colonies ADD COLUMN advance_paid DECIMAL(15, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'colonies' AND column_name = 'remaining_amount'
    ) THEN
        ALTER TABLE colonies ADD COLUMN remaining_amount DECIMAL(15, 2) GENERATED ALWAYS AS (COALESCE(purchase_amount, 0) - COALESCE(advance_paid, 0)) STORED;
    END IF;
END $$;
