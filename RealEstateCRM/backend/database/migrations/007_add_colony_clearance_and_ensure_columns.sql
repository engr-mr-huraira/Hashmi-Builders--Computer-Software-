-- Migration 007: Safely ensure colonies table columns and add clearance_duration
-- This fixes the missing purchase_from issue and adds the new clearance_duration field.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'colonies' AND column_name = 'purchase_from') THEN
        ALTER TABLE colonies ADD COLUMN purchase_from VARCHAR(150);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'colonies' AND column_name = 'purchase_amount') THEN
        ALTER TABLE colonies ADD COLUMN purchase_amount DECIMAL(15, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'colonies' AND column_name = 'advance_paid') THEN
        ALTER TABLE colonies ADD COLUMN advance_paid DECIMAL(15, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'colonies' AND column_name = 'remaining_amount') THEN
        ALTER TABLE colonies ADD COLUMN remaining_amount DECIMAL(15, 2) GENERATED ALWAYS AS (COALESCE(purchase_amount, 0) - COALESCE(advance_paid, 0)) STORED;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'colonies' AND column_name = 'clearance_duration') THEN
        ALTER TABLE colonies ADD COLUMN clearance_duration VARCHAR(100);
    END IF;
END $$;
